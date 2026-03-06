import { connectDB } from "@/lib/mongodb";
import CommunityPost from "@/model/communityPost";
import User from "@/model/user";
import mongoose from "mongoose";

const VALID_CATEGORIES = new Set([
  "lost_item",
  "study_material",
  "academic_question",
]);

export async function GET() {
  try {
    await connectDB();

    const posts = await CommunityPost.find()
      .sort({ createdAt: -1 })
      .populate("author", "name");

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

    const createdPost = await post.populate("author", "name");
    return Response.json(createdPost, { status: 201 });
  } catch (error) {
    console.error("community-posts POST failed", error);
    return Response.json({ error: "Failed to create post" }, { status: 500 });
  }
}
