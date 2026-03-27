import { connectDB } from "@/lib/mongodb";
import { resolveCommunityActorId } from "@/lib/community-user";
import { normalizeOptionalPictureUrl } from "@/lib/community-post-picture";
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
};

const ALLOWED_CATEGORIES = new Set([
  "lost_item",
  "study_material",
  "academic_question",
]);

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = (await req.json()) as CreatePostPayload;

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

    const tags = Array.isArray(body.tags)
      ? body.tags
          .map((item) => toTrimmedString(item))
          .filter((item) => Boolean(item))
      : [];
    const attachments = Array.isArray(body.attachments)
      ? body.attachments
          .map((item) => toTrimmedString(item))
          .filter((item) => Boolean(item))
      : [];

    const pictureNorm = normalizeOptionalPictureUrl(body.pictureUrl);
    if (!pictureNorm.ok) {
      return Response.json({ error: pictureNorm.error }, { status: 400 });
    }

    const createdPost = await CommunityPost.create({
      title,
      description,
      category,
      tags,
      attachments,
      ...(pictureNorm.value ? { pictureUrl: pictureNorm.value } : {}),
      status,
      author: authorId,
      authorDisplayName,
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
