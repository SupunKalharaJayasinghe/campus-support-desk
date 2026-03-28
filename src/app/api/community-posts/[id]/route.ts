import { connectDB } from "@/lib/mongodb";
import CommunityPost from "@/models/communityPost";
import CommunityPostLike from "@/models/communityPostLike";
import CommunityPostReport from "@/models/communityPostReport";
import CommunityReply from "@/models/communityReply";
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

    await Promise.all([
      CommunityPostReport.deleteMany({ postId: params.id }),
      CommunityPostLike.deleteMany({ postId: params.id }),
      CommunityReply.deleteMany({ postId: params.id }),
    ]);

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

type UpdatePostPayload = {
  status?: unknown;
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid post id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as UpdatePostPayload;
    const nextStatus = typeof body.status === "string" ? body.status.trim() : "";

    if (!["open", "resolved", "archived"].includes(nextStatus)) {
      return Response.json(
        { error: "Valid status is required" },
        { status: 400 }
      );
    }

    const updated = await CommunityPost.findByIdAndUpdate(
      params.id,
      { $set: { status: nextStatus } },
      { new: true }
    );

    if (!updated) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("community-posts/[id] PATCH failed", error);
    return Response.json({ error: "Failed to update post" }, { status: 500 });
  }
}
