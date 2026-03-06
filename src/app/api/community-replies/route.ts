import { connectDB } from "@/lib/mongodb";
import CommunityReply from "@/model/communityReply";
import User from "@/model/user";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const { postId, author, authorName, message } = body;

    if (!postId || !message) {
      return Response.json(
        { error: "postId and message are required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return Response.json({ error: "Invalid postId" }, { status: 400 });
    }

    let authorId: string | null = null;

    if (typeof author === "string" && mongoose.Types.ObjectId.isValid(author)) {
      authorId = author;
    } else if (typeof authorName === "string" && authorName.trim()) {
      const normalizedName = authorName.trim();
      const normalizedEmail = `${normalizedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "")}@demo.local`;

      let dbUser = await User.findOne({ email: normalizedEmail });
      if (!dbUser) {
        dbUser = await User.create({
          name: normalizedName,
          email: normalizedEmail,
          password: "demo-password",
          role: "student",
        });
      }

      authorId = dbUser._id.toString();
    }

    if (!authorId) {
      return Response.json(
        { error: "Valid author id or authorName is required" },
        { status: 400 }
      );
    }

    const reply = await CommunityReply.create({
      postId,
      author: authorId,
      message,
    });

    const createdReply = await reply.populate("author", "name");

    return Response.json(createdReply, { status: 201 });
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

    const replies = await CommunityReply.find({ postId })
      .sort({ createdAt: -1 })
      .populate("author", "name");

    return Response.json(replies);
  } catch (error) {
    console.error("community-replies GET failed", error);
    return Response.json({ error: "Failed to fetch replies" }, { status: 500 });
  }
}
