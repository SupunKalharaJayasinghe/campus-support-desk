import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import CommunityReply from "@/models/communityReply";
import { UserModel } from "@/models/User";
import mongoose from "mongoose";

function toNormalizedEmail(name: string) {
  return `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")}@demo.local`;
}

function toBaseUsername(name: string) {
  const compact = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact || "USER";
}

async function createUniqueUsername(base: string) {
  let candidate = base.slice(0, 20);
  let suffix = 1;

  while (await UserModel.exists({ username: candidate })) {
    const suffixText = String(suffix);
    const allowedBaseLength = Math.max(1, 20 - suffixText.length);
    candidate = `${base.slice(0, allowedBaseLength)}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}

async function resolveAuthorId(author: unknown, authorName: unknown) {
  if (typeof author === "string" && mongoose.Types.ObjectId.isValid(author)) {
    return author;
  }

  if (typeof authorName !== "string" || !authorName.trim()) {
    return null;
  }

  const normalizedName = authorName.trim();
  const normalizedEmail = toNormalizedEmail(normalizedName);

  let dbUser = await UserModel.findOne({ email: normalizedEmail });
  if (!dbUser) {
    const baseUsername = toBaseUsername(normalizedName);
    const username = await createUniqueUsername(baseUsername);

    dbUser = await UserModel.create({
      username,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(`temp-${Date.now()}`, 10),
      role: "STUDENT",
      status: "ACTIVE",
      mustChangePassword: false,
    });
  }

  return dbUser?._id ? dbUser._id.toString() : null;
}

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

    const authorId = await resolveAuthorId(author, authorName);

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

    const createdReply = await reply.populate("author", "username");

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
      .populate("author", "username");

    return Response.json(replies);
  } catch (error) {
    console.error("community-replies GET failed", error);
    return Response.json({ error: "Failed to fetch replies" }, { status: 500 });
  }
}
