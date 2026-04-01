import { connectDB } from "@/lib/mongodb";
import { resolveCommunityActorId } from "@/lib/community-user";
import { normalizeOptionalPictureUrl } from "@/lib/community-post-picture";
import { calcUrgentExpiresAt, getUrgentConfig, type UrgentLevel, type UrgentPaymentMethod } from "@/lib/community-urgent";
import {
  dedupeStringsPreserveOrder,
  validateCommunityPostLikeContent,
} from "@/lib/validate-community-post-body";
import { CommunityProfileModel } from "@/models/CommunityProfile";
import { CommunityUrgentPrepayModel } from "@/models/communityUrgentPrepay";
import CommunityPost from "@/models/communityPost";
import CommunityPostLike from "@/models/communityPostLike";
import CommunityPostReport from "@/models/communityPostReport";
import mongoose from "mongoose";

type CreatePostPayload = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  attachments?: unknown;
  pictureUrl?: unknown;
  status?: unknown;
  author?: unknown;
  authorUsername?: unknown;
  authorEmail?: unknown;
  authorName?: unknown;
  authorDisplayName?: unknown;
  isUrgent?: unknown;
  urgentLevel?: unknown;
  urgentPaymentMethod?: unknown;
  urgentCardLast4?: unknown;
  urgentPrepayId?: unknown;
};

const ALLOWED_CATEGORIES = new Set([
  "lost_item",
  "study_material",
  "academic_question",
]);

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getLevel(points: number) {
  if (points >= 500) return "EXPERT";
  if (points >= 100) return "HELPER";
  return "BEGINNER";
}

export async function POST(req: Request) {
  try {
    await connectDB();
    let body: CreatePostPayload;
    try {
      body = (await req.json()) as CreatePostPayload;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const title = toTrimmedString(body.title);
    const description = toTrimmedString(body.description);
    const category = toTrimmedString(body.category);
    const status = body.status === "resolved" ? "resolved" : "open";
    const authorDisplayName =
      toTrimmedString(body.authorDisplayName) ||
      toTrimmedString(body.authorName) ||
      "Community User";

    if (!title || !description || !ALLOWED_CATEGORIES.has(category)) {
      return Response.json(
        { error: "title, description, and valid category are required" },
        { status: 400 }
      );
    }

    const tags = dedupeStringsPreserveOrder(
      Array.isArray(body.tags)
        ? body.tags
            .map((item) => toTrimmedString(item))
            .filter((item) => Boolean(item))
        : []
    );
    const attachments = dedupeStringsPreserveOrder(
      Array.isArray(body.attachments)
        ? body.attachments
            .map((item) => toTrimmedString(item))
            .filter((item) => Boolean(item))
        : []
    );

    const contentCheck = validateCommunityPostLikeContent({
      title,
      description,
      tags,
      attachments,
      authorDisplayName,
    });
    if (!contentCheck.ok) {
      return Response.json({ error: contentCheck.error }, { status: 400 });
    }

    const authorId = await resolveCommunityActorId({
      userId: body.author,
      username: body.authorUsername,
      email: body.authorEmail,
      name: body.authorName,
    });
    if (!authorId) {
      return Response.json(
        { error: "Only logged-in users can create posts" },
        { status: 401 }
      );
    }

    const pictureNorm = normalizeOptionalPictureUrl(body.pictureUrl);
    if (!pictureNorm.ok) {
      return Response.json({ error: pictureNorm.error }, { status: 400 });
    }

    const isUrgent = Boolean(body.isUrgent);
    const urgentLevelRaw = toTrimmedString(body.urgentLevel) as UrgentLevel;
    const urgentLevel: UrgentLevel =
      urgentLevelRaw === "5days" || urgentLevelRaw === "7days" ? urgentLevelRaw : "2days";
    const urgentPaymentMethodRaw = toTrimmedString(body.urgentPaymentMethod) as UrgentPaymentMethod;
    const urgentPaymentMethod: UrgentPaymentMethod =
      urgentPaymentMethodRaw === "card" ? "card" : "points";
    const urgentCardLast4 = toTrimmedString(body.urgentCardLast4);

    let urgentPatch: Record<string, unknown> = {};
    if (isUrgent) {
      const cfg = getUrgentConfig(urgentLevel);
      const feePoints = cfg.feePoints;

      if (urgentPaymentMethod === "points") {
        const prepayIdRaw = toTrimmedString(body.urgentPrepayId);
        const prepayId =
          prepayIdRaw && mongoose.Types.ObjectId.isValid(prepayIdRaw) ? prepayIdRaw : "";

        if (prepayId) {
          const session = await mongoose.startSession();
          try {
            let consumedOk = false;
            await session.withTransaction(async () => {
              const now = new Date();
              const prepay = await CommunityUrgentPrepayModel.findOne(
                {
                  _id: prepayId,
                  userRef: authorId,
                  urgentLevel,
                  feePoints,
                  consumedAt: null,
                  expiresAt: { $gt: now },
                },
                null,
                { session }
              );
              if (!prepay) {
                return;
              }

              const updated = await CommunityProfileModel.findOneAndUpdate(
                { userRef: authorId, points: { $gte: feePoints } },
                { $inc: { points: -feePoints } },
                { new: true, session }
              );
              if (!updated) {
                // Insufficient points at consume-time (points may have changed since prepay).
                return;
              }

              updated.level = getLevel(updated.points);
              await updated.save({ session });

              prepay.consumedAt = now;
              await prepay.save({ session });
              consumedOk = true;
            });

            if (!consumedOk) {
              return Response.json(
                {
                  error:
                    "Urgent prepayment is invalid/expired, already used, or you don't have enough points. Pay again or use card.",
                },
                { status: 400 }
              );
            }
          } finally {
            session.endSession();
          }
        } else {
          const profile = await CommunityProfileModel.findOne({ userRef: authorId });
          const currentPoints = Number(profile?.points ?? 0);
          if (currentPoints < feePoints) {
            return Response.json(
              { error: "Not enough points for urgent. Pay the fee first or use card." },
              { status: 402 }
            );
          }
          const updated = await CommunityProfileModel.findOneAndUpdate(
            { userRef: authorId, points: { $gte: feePoints } },
            { $inc: { points: -feePoints } },
            { new: true }
          );
          if (!updated) {
            return Response.json(
              { error: "Not enough points for urgent. Pay the fee first or use card." },
              { status: 402 }
            );
          }
          updated.level = getLevel(updated.points);
          await updated.save();
        }

        urgentPatch = {
          isUrgent: true,
          urgentLevel,
          urgentExpiresAt: calcUrgentExpiresAt(urgentLevel),
          urgentFeePoints: feePoints,
          urgentPaymentMethod: "points",
          urgentPaymentStatus: "paid",
          urgentPointsUsed: feePoints,
          urgentCardPaymentRef: null,
        };
      } else {
        if (!urgentCardLast4 || !/^\d{4}$/.test(urgentCardLast4)) {
          return Response.json(
            { error: "Card payment details are required for urgent." },
            { status: 400 }
          );
        }
        urgentPatch = {
          isUrgent: true,
          urgentLevel,
          urgentExpiresAt: calcUrgentExpiresAt(urgentLevel),
          urgentFeePoints: feePoints,
          urgentPaymentMethod: "card",
          urgentPaymentStatus: "paid",
          urgentPointsUsed: 0,
          urgentCardPaymentRef: `CARD-${Date.now()}-${urgentCardLast4}`,
        };
      }
    } else {
      urgentPatch = {
        isUrgent: false,
        urgentLevel: null,
        urgentExpiresAt: null,
        urgentFeePoints: null,
        urgentPaymentMethod: null,
        urgentPaymentStatus: "unpaid",
        urgentPointsUsed: 0,
        urgentCardPaymentRef: null,
      };
    }

    const createdPost = await CommunityPost.create({
      title,
      description,
      category,
      tags,
      attachments,
      pictureUrl: pictureNorm.value ?? null,
      status,
      author: authorId,
      authorDisplayName,
      ...urgentPatch,
    });

    return Response.json(
      {
        ...createdPost.toObject(),
        likesCount: 0,
        likedByCurrentUser: false,
        reportedByCurrentUser: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("community-posts POST failed", error);
    return Response.json({ error: "Failed to create post" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const viewerId = toTrimmedString(searchParams.get("viewerId"));

    const posts = await CommunityPost.find({})
      .sort({ createdAt: -1 })
      .lean();

    const postIds = posts
      .map((post) => post._id)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

    const likeCountsRaw =
      postIds.length === 0
        ? []
        : await CommunityPostLike.aggregate<{
            _id: mongoose.Types.ObjectId;
            count: number;
          }>([
            { $match: { postId: { $in: postIds } } },
            { $group: { _id: "$postId", count: { $sum: 1 } } },
          ]);
    const likeCountByPostId = new Map(
      likeCountsRaw.map((row) => [String(row._id), row.count])
    );

    const viewerObjectId = mongoose.Types.ObjectId.isValid(viewerId)
      ? viewerId
      : null;

    const likedByViewerRaw =
      viewerObjectId && postIds.length > 0
        ? await CommunityPostLike.find({
            userId: viewerObjectId,
            postId: { $in: postIds },
          })
            .select({ postId: 1 })
            .lean()
        : [];
    const likedByViewerSet = new Set(
      likedByViewerRaw.map((row) => String(row.postId))
    );

    const reportedByViewerRaw =
      viewerObjectId && postIds.length > 0
        ? await CommunityPostReport.find({
            userId: viewerObjectId,
            postId: { $in: postIds },
          })
            .select({ postId: 1 })
            .lean()
        : [];
    const reportedByViewerSet = new Set(
      reportedByViewerRaw.map((row) => String(row.postId))
    );

    const enrichedPosts = posts.map((post) => {
      const postId = String(post._id);
      return {
        ...post,
        likesCount: likeCountByPostId.get(postId) ?? 0,
        likedByCurrentUser: likedByViewerSet.has(postId),
        reportedByCurrentUser: reportedByViewerSet.has(postId),
      };
    });

    return Response.json(enrichedPosts);
  } catch (error) {
    console.error("community-posts GET failed", error);
    return Response.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}
