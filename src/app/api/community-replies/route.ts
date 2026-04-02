import { connectDB } from "@/lib/mongodb";
import {
  COMMUNITY_PROFILE_REQUIRED_MESSAGE,
  userHasCommunityProfile,
} from "@/lib/community-profile-guard";
import { resolveCommunityActorId } from "@/lib/community-user";
import {
  normalizeOptionalReplyAttachmentUrl,
  normalizeReplyAttachmentName,
} from "@/lib/community-reply-attachment";
import { getCommunityMemberFieldsByUserRefs } from "@/lib/community-feed-member-fields";
import CommunityPost from "@/models/communityPost";
import CommunityReply from "@/models/communityReply";
import CommunityReplyLike from "@/models/communityReplyLike";
import {
  applyCommunityProfileInc,
  COMMUNITY_POINTS_PER_REPLY,
} from "@/lib/community-profile-points";
import mongoose from "mongoose";

const MAX_REPLIES_PER_USER_PER_POST = 3;

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const {
      postId,
      author,
      authorUsername,
      authorEmail,
      authorName,
      authorDisplayName,
      message,
      attachmentUrl,
      attachmentName,
    } = body;

    if (!postId) {
      return Response.json({ error: "postId is required" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return Response.json({ error: "Invalid postId" }, { status: 400 });
    }

    const authorId = await resolveCommunityActorId({
      userId: author,
      username: authorUsername,
      email: authorEmail,
      name: authorName,
    });
    if (!authorId) {
      return Response.json(
        { error: "Only logged-in users can reply" },
        { status: 401 }
      );
    }

    if (!(await userHasCommunityProfile(authorId))) {
      return Response.json({ error: COMMUNITY_PROFILE_REQUIRED_MESSAGE }, { status: 403 });
    }

    const postExists = await CommunityPost.exists({ _id: postId });
    if (!postExists) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    const existingReplyCount = await CommunityReply.countDocuments({
      postId,
      author: authorId,
    });
    if (existingReplyCount >= MAX_REPLIES_PER_USER_PER_POST) {
      return Response.json(
        { error: "Reply limit reached for this post" },
        { status: 429 }
      );
    }

    const attachmentNorm = normalizeOptionalReplyAttachmentUrl(attachmentUrl);
    if (!attachmentNorm.ok) {
      return Response.json({ error: attachmentNorm.error }, { status: 400 });
    }
    const messageTrim = String(message ?? "").trim();
    if (!messageTrim && !attachmentNorm.value) {
      return Response.json(
        { error: "Add a message or attach a file." },
        { status: 400 }
      );
    }
    const attachmentLabel = normalizeReplyAttachmentName(attachmentName);

    const reply = await CommunityReply.create({
      postId,
      author: authorId,
      authorDisplayName:
        String(authorDisplayName ?? "").trim() ||
        String(authorName ?? "").trim() ||
        "Community User",
      message: messageTrim,
      attachmentUrl: attachmentNorm.value ?? null,
      attachmentName: attachmentNorm.value ? (attachmentLabel ?? null) : null,
    });

    await applyCommunityProfileInc(authorId, {
      repliesCount: 1,
      points: COMMUNITY_POINTS_PER_REPLY,
    });

    const memberByAuthor = await getCommunityMemberFieldsByUserRefs([authorId]);
    const member = memberByAuthor.get(String(authorId));
    const snapshotName = String(reply.authorDisplayName ?? "").trim();
    const liveName = (member?.displayName ?? "").trim();

    return Response.json(
      {
        ...reply.toObject(),
        likesCount: 0,
        likedByCurrentUser: false,
        authorMemberDisplayName: liveName || snapshotName || "Community User",
        authorMemberPoints: member != null ? member.points : 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("community-replies POST failed", error);
    return Response.json({ error: "Failed to create reply" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");
    const viewerId = searchParams.get("viewerId");

    if (!postId) {
      return Response.json(
        { error: "postId query param is required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return Response.json({ error: "Invalid postId" }, { status: 400 });
    }

    const replies = await CommunityReply.find({ postId })
      .sort({ createdAt: -1 })
      .lean();

    const replyIds = replies
      .map((reply) => reply._id)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

    const likeCountsRaw =
      replyIds.length === 0
        ? []
        : await CommunityReplyLike.aggregate<{
            _id: mongoose.Types.ObjectId;
            count: number;
          }>([
            { $match: { replyId: { $in: replyIds } } },
            { $group: { _id: "$replyId", count: { $sum: 1 } } },
          ]);
    const likeCountByReplyId = new Map(
      likeCountsRaw.map((row) => [String(row._id), row.count])
    );

    const viewerObjectId =
      viewerId && mongoose.Types.ObjectId.isValid(viewerId) ? viewerId : null;

    const likedByViewerRaw =
      viewerObjectId && replyIds.length > 0
        ? await CommunityReplyLike.find({
            userId: viewerObjectId,
            replyId: { $in: replyIds },
          })
            .select({ replyId: 1 })
            .lean()
        : [];
    const likedByViewerSet = new Set(
      likedByViewerRaw.map((row) => String(row.replyId))
    );

    const memberByAuthor = await getCommunityMemberFieldsByUserRefs(
      replies.map((r) => r.author)
    );

    const enrichedReplies = replies.map((reply) => {
      const replyId = String(reply._id);
      const authorKey = String(reply.author);
      const member = memberByAuthor.get(authorKey);
      const snapshotName = String(reply.authorDisplayName ?? "").trim();
      const liveName = (member?.displayName ?? "").trim();
      return {
        ...reply,
        likesCount: likeCountByReplyId.get(replyId) ?? 0,
        likedByCurrentUser: likedByViewerSet.has(replyId),
        authorMemberDisplayName: liveName || snapshotName || "Community User",
        authorMemberPoints: member != null ? member.points : 0,
      };
    });

    return Response.json(enrichedReplies);
  } catch (error) {
    console.error("community-replies GET failed", error);
    return Response.json({ error: "Failed to fetch replies" }, { status: 500 });
  }
}
