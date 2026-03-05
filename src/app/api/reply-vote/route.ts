import { connectDB } from "@/lib/mongodb";
import ReplyVote from "@/model/replyVote";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const { replyId, userId } = body;

    if (!replyId || !userId) {
      return Response.json({ error: "replyId and userId are required" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(replyId)) {
      return Response.json({ error: "Invalid replyId" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return Response.json({ error: "Invalid userId" }, { status: 400 });
    }

    const vote = await ReplyVote.create(body);

    return Response.json(vote, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return Response.json({ error: "You have already voted for this reply" }, { status: 409 });
    }

    console.error("reply-vote POST failed", error);
    return Response.json({ error: "Failed to create vote" }, { status: 500 });
  }
}