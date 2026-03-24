import { connectDB } from "@/lib/mongodb";
import { resolveCommunityActorId } from "@/lib/community-user";
import CommunityReply from "@/models/communityReply";
import CommunityReplyLike from "@/models/communityReplyLike";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { replyId, userId, username, email, name } = body;

    if (!replyId || !userId) {
      return Response.json(
        { error: "replyId and userId are required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(replyId)) {
      return Response.json({ error: "Invalid replyId" }, { status: 400 });
    }

    const validUserId = await resolveCommunityActorId({
      userId,
      username,
      email,
      name,
    });
    if (!validUserId) {
      return Response.json(
        { error: "Only logged-in users can like replies" },
        { status: 401 }
      );
    }

    const replyExists = await CommunityReply.exists({ _id: replyId });
    if (!replyExists) {
      return Response.json({ error: "Reply not found" }, { status: 404 });
    }

    const existingLike = await CommunityReplyLike.findOne({
      replyId,
      userId: validUserId,
    });

    let liked = false;
    if (existingLike) {
      await CommunityReplyLike.deleteOne({ _id: existingLike._id });
      liked = false;
    } else {
      await CommunityReplyLike.create({ replyId, userId: validUserId });
      liked = true;
    }

    const likesCount = await CommunityReplyLike.countDocuments({ replyId });
    return Response.json({ liked, likesCount });
  } catch (error) {
    console.error("community-reply-likes POST failed", error);
    return Response.json(
      { error: "Failed to toggle reply like" },
      { status: 500 }
    );
  }
}
