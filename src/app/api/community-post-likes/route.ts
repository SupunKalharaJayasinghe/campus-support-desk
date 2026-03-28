import { connectDB } from "@/lib/mongodb";
import { resolveCommunityActorId } from "@/lib/community-user";
import CommunityPost from "@/models/communityPost";
import CommunityPostLike from "@/models/communityPostLike";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { postId, userId, username, email, name } = body;

    if (!postId || !userId) {
      return Response.json(
        { error: "postId and userId are required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return Response.json({ error: "Invalid postId" }, { status: 400 });
    }

    const validUserId = await resolveCommunityActorId({
      userId,
      username,
      email,
      name,
    });
    if (!validUserId) {
      return Response.json(
        { error: "Only logged-in users can like posts" },
        { status: 401 }
      );
    }

    const postExists = await CommunityPost.exists({ _id: postId });
    if (!postExists) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    const existingLike = await CommunityPostLike.findOne({
      postId,
      userId: validUserId,
    });

    let liked = false;
    if (existingLike) {
      await CommunityPostLike.deleteOne({ _id: existingLike._id });
      liked = false;
    } else {
      await CommunityPostLike.create({ postId, userId: validUserId });
      liked = true;
    }

    const likesCount = await CommunityPostLike.countDocuments({ postId });
    return Response.json({ liked, likesCount });
  } catch (error) {
    console.error("community-post-likes POST failed", error);
    return Response.json(
      { error: "Failed to toggle post like" },
      { status: 500 }
    );
  }
}
