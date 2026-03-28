import { connectDB } from "@/lib/mongodb";
import CommunityPost from "@/models/communityPost";
import CommunityPostLike from "@/models/communityPostLike";
import CommunityReply from "@/models/communityReply";
import mongoose from "mongoose";

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const userId = toTrimmedString(searchParams.get("userId"));

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return Response.json({ error: "Valid userId is required" }, { status: 400 });
    }

    const posts = await CommunityPost.find({ author: userId })
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

    const replies = postIds.length
      ? await CommunityReply.find({ postId: { $in: postIds } })
          .sort({ createdAt: -1 })
          .lean()
      : [];

    const repliesByPostId = new Map<string, unknown[]>();
    for (const reply of replies) {
      const key = String((reply as { postId?: unknown }).postId ?? "");
      if (!key) continue;
      const bucket = repliesByPostId.get(key) ?? [];
      bucket.push(reply);
      repliesByPostId.set(key, bucket);
    }

    const enrichedPosts = posts.map((post) => {
      const postId = String(post._id);
      const postReplies = repliesByPostId.get(postId) ?? [];
      return {
        ...post,
        likesCount: likeCountByPostId.get(postId) ?? 0,
        repliesCount: postReplies.length,
        replies: postReplies,
      };
    });

    return Response.json(enrichedPosts);
  } catch (error) {
    console.error("community-user-posts GET failed", error);
    return Response.json(
      { error: "Failed to fetch user posts" },
      { status: 500 }
    );
  }
}

