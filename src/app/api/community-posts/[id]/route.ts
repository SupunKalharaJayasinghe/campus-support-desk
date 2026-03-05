import { connectDB } from "@/lib/mongodb";
import CommunityPost from "@/model/communityPost";
import mongoose from "mongoose";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid post id" }, { status: 400 });
    }

    const post = await CommunityPost.findById(params.id);

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    return Response.json(post);
  } catch (error) {
    console.error("community-posts/[id] GET failed", error);
    return Response.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid post id" }, { status: 400 });
    }

    const deleted = await CommunityPost.findByIdAndDelete(params.id);

    if (!deleted) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    return Response.json({ message: "Post deleted" });
  } catch (error) {
    console.error("community-posts/[id] DELETE failed", error);
    return Response.json({ error: "Failed to delete post" }, { status: 500 });
  }
}