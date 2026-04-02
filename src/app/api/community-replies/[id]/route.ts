import { connectDB } from "@/lib/mongodb";
import { resolveCommunityActorId } from "@/lib/community-user";
import {
  applyCommunityProfileInc,
  COMMUNITY_POINTS_ACCEPTED_ANSWER,
} from "@/lib/community-profile-points";
import CommunityPost from "@/models/communityPost";
import CommunityReply from "@/models/communityReply";
import mongoose from "mongoose";

type UpdateReplyPayload = {
  isAccepted?: unknown;
  author?: unknown;
  authorUsername?: unknown;
  authorEmail?: unknown;
  authorName?: unknown;
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid reply id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as UpdateReplyPayload;
    if (body.isAccepted !== true) {
      return Response.json(
        { error: "Only accepting a reply is supported" },
        { status: 400 }
      );
    }

    const actorId = await resolveCommunityActorId({
      userId: body.author,
      username: body.authorUsername,
      email: body.authorEmail,
      name: body.authorName,
    });
    if (!actorId) {
      return Response.json({ error: "Only logged-in users can accept replies" }, { status: 401 });
    }

    const targetReplyRaw = await CommunityReply.findById(params.id)
      .select({ postId: 1, author: 1, isAccepted: 1, acceptPointsAwarded: 1 })
      .lean();
    if (!targetReplyRaw || Array.isArray(targetReplyRaw)) {
      return Response.json({ error: "Reply not found" }, { status: 404 });
    }
    const targetReply = targetReplyRaw as unknown as {
      postId: mongoose.Types.ObjectId;
      author: mongoose.Types.ObjectId;
      isAccepted?: boolean;
      acceptPointsAwarded?: boolean;
    };

    const postId = targetReply.postId;
    const postRaw = await CommunityPost.findById(postId).select({ author: 1 }).lean();
    if (!postRaw || Array.isArray(postRaw)) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }
    const post = postRaw as unknown as { author?: mongoose.Types.ObjectId | null };

    const postAuthorId = post.author != null ? String(post.author) : "";
    if (!postAuthorId || postAuthorId !== String(actorId)) {
      return Response.json(
        { error: "Only the post author can accept a reply" },
        { status: 403 }
      );
    }

    const replyAuthorId =
      targetReply.author != null ? String(targetReply.author) : "";
    const shouldAwardAcceptPoints =
      targetReply.acceptPointsAwarded !== true && Boolean(replyAuthorId);

    await CommunityReply.updateMany(
      { postId },
      { $set: { isAccepted: false } }
    );

    const updated = await CommunityReply.findByIdAndUpdate(
      params.id,
      {
        $set: {
          isAccepted: true,
          ...(shouldAwardAcceptPoints ? { acceptPointsAwarded: true } : {}),
        },
      },
      { new: true }
    );

    if (shouldAwardAcceptPoints) {
      await applyCommunityProfileInc(replyAuthorId, {
        points: COMMUNITY_POINTS_ACCEPTED_ANSWER,
      });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("community-replies/[id] PATCH failed", error);
    return Response.json({ error: "Failed to update reply" }, { status: 500 });
  }
}
