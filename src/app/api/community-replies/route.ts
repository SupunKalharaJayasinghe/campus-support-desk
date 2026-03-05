import { connectDB } from "@/lib/mongodb";
import CommunityReply from "@/model/communityReply";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const { postId, author, message } = body;

    if (!postId || !author || !message) {
      return Response.json(
        { error: "postId, author, and message are required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return Response.json({ error: "Invalid postId" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(author)) {
      return Response.json({ error: "Invalid author id" }, { status: 400 });
    }

    const reply = await CommunityReply.create(body);

    return Response.json(reply, { status: 201 });
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

    if (!postId) {
      return Response.json({ error: "postId query param is required" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return Response.json({ error: "Invalid postId" }, { status: 400 });
    }

    const replies = await CommunityReply.find({ postId }).sort({ createdAt: -1 });

    return Response.json(replies);
  } catch (error) {
    console.error("community-replies GET failed", error);
    return Response.json({ error: "Failed to fetch replies" }, { status: 500 });
  }
}