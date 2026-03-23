import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import CommunityPost from "@/models/communityPost";
import { UserModel } from "@/models/User";
import mongoose from "mongoose";

const VALID_CATEGORIES = new Set([
  "lost_item",
  "study_material",
  "academic_question",
]);

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

export async function GET() {
  try {
    await connectDB();

    const posts = await CommunityPost.find()
      .sort({ createdAt: -1 })
      .populate("author", "username");

    return Response.json(posts);
  } catch (error) {
    console.error("community-posts GET failed", error);
    return Response.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const { title, description, category, tags, attachments, status, author, authorName } = body;

    if (!title || !description || !category) {
      return Response.json(
        { error: "title, description, and category are required" },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIES.has(category)) {
      return Response.json({ error: "Invalid category" }, { status: 400 });
    }

    const authorId = await resolveAuthorId(author, authorName);

    if (!authorId) {
      return Response.json(
        { error: "Valid author id or authorName is required" },
        { status: 400 }
      );
    }

    const safeTags = Array.isArray(tags)
      ? tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [];
    const safeAttachments = Array.isArray(attachments)
      ? attachments.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0
        )
      : [];
    const safeStatus = status === "resolved" ? "resolved" : "open";

    const post = await CommunityPost.create({
      title,
      description,
      category,
      tags: safeTags,
      attachments: safeAttachments,
      status: safeStatus,
      author: authorId,
    });

    const createdPost = await post.populate("author", "username");
    return Response.json(createdPost, { status: 201 });
  } catch (error) {
    console.error("community-posts POST failed", error);
    return Response.json({ error: "Failed to create post" }, { status: 500 });
  }
}
