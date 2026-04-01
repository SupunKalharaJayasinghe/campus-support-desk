import { connectDB } from "@/lib/mongodb";
import { CommunityProfileModel } from "@/models/CommunityProfile";
import { CommunityUrgentPrepayModel } from "@/models/communityUrgentPrepay";
import mongoose from "mongoose";

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getLevel(points: number) {
  if (points >= 500) return "EXPERT";
  if (points >= 100) return "HELPER";
  return "BEGINNER";
}

type Body = {
  userId?: unknown;
  username?: unknown;
  email?: unknown;
  name?: unknown;
  prepayId?: unknown;
};

export async function POST(req: Request) {
  try {
    await connectDB();
    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const userId = toTrimmedString(body.userId);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return Response.json({ error: "Valid userId is required" }, { status: 401 });
    }

    const prepayIdRaw = toTrimmedString(body.prepayId);
    if (!prepayIdRaw || !mongoose.Types.ObjectId.isValid(prepayIdRaw)) {
      return Response.json({ error: "Valid prepayId is required" }, { status: 400 });
    }

    // Prepay no longer deducts points up-front, so cancel just removes the reservation token.
    const prepay = await CommunityUrgentPrepayModel.findOne({
      _id: prepayIdRaw,
      userRef: userId,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (prepay) {
      await prepay.deleteOne();
    }

    const profile = await CommunityProfileModel.findOne({ userRef: userId }).lean();
    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    return Response.json({ newPoints: Number(profile.points ?? 0) });
  } catch (error) {
    console.error("community-urgent-prepay cancel failed", error);
    return Response.json({ error: "Failed to cancel prepayment" }, { status: 500 });
  }
}
