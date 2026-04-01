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

    // Deduct points now and create a refundable prepay token.
    // If the user cancels before consuming it, we refund the points.
    const session = await mongoose.startSession();
    let prepayId: string | null = null;
    let newPoints: number | null = null;
    let expiresAtIso: string | null = null;
    try {
      await session.withTransaction(async () => {
        const updated = await CommunityProfileModel.findOneAndUpdate(
          { userRef: userId, points: { $gte: feePoints } },
          { $inc: { points: -feePoints } },
          { new: true, session }
        );
        if (!updated) {
          return;
        }

        updated.level = getLevel(updated.points);
        await updated.save({ session });

        const expiresAt = new Date(Date.now() + PREPAY_TTL_MS);
        expiresAtIso = expiresAt.toISOString();
        const prepay = await CommunityUrgentPrepayModel.create(
          [
            {
              userRef: userId,
              urgentLevel,
              feePoints,
              expiresAt,
            },
          ],
          { session }
        );

        prepayId = String(prepay[0]?._id ?? "");
        newPoints = Number(updated.points ?? 0);
      });
    } finally {
      session.endSession();
    }

    if (!prepayId || !Number.isFinite(newPoints ?? NaN) || !expiresAtIso) {
      return Response.json(
        { error: "Not enough points for this urgent fee." },
        { status: 402 }
      );
    }

    return Response.json({
      prepayId,
      newPoints,
      urgentLevel,
      feePoints,
      expiresAt: expiresAtIso,
    });
  } catch (error) {
    console.error("community-urgent-prepay POST failed", error);
    return Response.json({ error: "Failed to process urgent payment" }, { status: 500 });
  }
}
