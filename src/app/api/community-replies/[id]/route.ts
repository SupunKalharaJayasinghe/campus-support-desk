import { connectDB } from "@/lib/mongodb";
import CommunityReply from "@/models/communityReply";
import mongoose from "mongoose";

type UpdateReplyPayload = {
  isAccepted?: unknown;
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid reply id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as UpdateReplyPayload;
    if (body.isAccepted !== true) {
      return Response.json(
        { error: "Only accepting a reply is supported" },
        { status: 400 }
      );
    }

    const targetReply = await CommunityReply.findById(params.id).select({
      postId: 1,
    });
    if (!targetReply) {
      return Response.json({ error: "Reply not found" }, { status: 404 });
    }

    await CommunityReply.updateMany(
      { postId: targetReply.postId },
      { $set: { isAccepted: false } }
    );

    const updated = await CommunityReply.findByIdAndUpdate(
      params.id,
      { $set: { isAccepted: true } },
      { new: true }
    );

    return Response.json(updated);
  } catch (error) {
    console.error("community-replies/[id] PATCH failed", error);
    return Response.json({ error: "Failed to update reply" }, { status: 500 });
  }
}
