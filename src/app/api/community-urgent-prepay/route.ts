import { connectDB } from "@/lib/mongodb";
import { getUrgentConfig, type UrgentLevel } from "@/lib/community-urgent";
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

const PREPAY_TTL_MS = 30 * 60 * 1000;

type Body = {
  userId?: unknown;
  username?: unknown;
  email?: unknown;
  name?: unknown;
  urgentLevel?: unknown;
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

    const raw = toTrimmedString(body.urgentLevel) as UrgentLevel;
    const urgentLevel: UrgentLevel =
      raw === "5days" || raw === "7days" ? raw : "2days";
    const cfg = getUrgentConfig(urgentLevel);
    const feePoints = cfg.feePoints;

    // Reserve an urgent prepayment token (no deduction yet).
    // Points are deducted only when the urgent post is successfully created (consuming this prepay).
    const profile = await CommunityProfileModel.findOne({ userRef: userId }).lean();
    const currentPoints = Number(profile?.points ?? 0);
    if (!Number.isFinite(currentPoints) || currentPoints < feePoints) {
      return Response.json(
        { error: "Not enough points for this urgent fee." },
        { status: 402 }
      );
    }

    const expiresAt = new Date(Date.now() + PREPAY_TTL_MS);
    const prepay = await CommunityUrgentPrepayModel.create({
      userRef: userId,
      urgentLevel,
      feePoints,
      expiresAt,
    });

    return Response.json({
      prepayId: String(prepay._id),
      newPoints: currentPoints,
      urgentLevel,
      feePoints,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("community-urgent-prepay POST failed", error);
    return Response.json({ error: "Failed to process urgent payment" }, { status: 500 });
  }
}
