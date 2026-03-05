import { connectDB } from "@/lib/mongodb";
import UserBadge from "@/model/userBadge";
import mongoose from "mongoose";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid user id" }, { status: 400 });
    }

    const badges = await UserBadge.find({ userId: params.id }).populate("badgeId");

    return Response.json(badges);
  } catch (error) {
    console.error("user/[id]/badges GET failed", error);
    return Response.json({ error: "Failed to fetch user badges" }, { status: 500 });
  }
}