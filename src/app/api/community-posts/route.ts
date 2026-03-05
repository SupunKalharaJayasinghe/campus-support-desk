import { connectDB } from "@/lib/mongodb";
import CommunityPost from "@/model/communityPost";
import mongoose from "mongoose";

const VALID_CATEGORIES = new Set([
  "lost_item",
  "study_material",
  "academic_question",
]);

export async function GET() {
  try {
    await connectDB();

    const posts = await CommunityPost.find().sort({ createdAt: -1 });

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
    const { title, description, category, author } = body;

    if (!title || !description || !category || !author) {
      return Response.json(
        { error: "title, description, category, and author are required" },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIES.has(category)) {
      return Response.json({ error: "Invalid category" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(author)) {
      return Response.json({ error: "Invalid author id" }, { status: 400 });
    }

    const post = await CommunityPost.create(body);

    return Response.json(post, { status: 201 });
  } catch (error) {
    console.error("community-posts POST failed", error);
    return Response.json({ error: "Failed to create post" }, { status: 500 });
  }
}