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

    // Cancel refunds points (only if prepay not consumed).
    const session = await mongoose.startSession();
    let newPoints: number | null = null;
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const prepay = await CommunityUrgentPrepayModel.findOne(
          {
            _id: prepayIdRaw,
            userRef: userId,
            consumedAt: null,
            expiresAt: { $gt: now },
          },
          null,
          { session }
        );
        if (!prepay) {
          const profile = await CommunityProfileModel.findOne(
            { userRef: userId },
            null,
            { session }
          ).lean();
          const row = profile && !Array.isArray(profile) ? profile : null;
          newPoints = Number((row as { points?: number } | null)?.points ?? 0);
          return;
        }

        const feePoints = Number(prepay.feePoints ?? 0);
        const updated = await CommunityProfileModel.findOneAndUpdate(
          { userRef: userId },
          { $inc: { points: feePoints } },
          { new: true, session }
        );
        if (!updated) {
          return;
        }
        updated.level = getLevel(updated.points);
        await updated.save({ session });

        await prepay.deleteOne({ session });
        newPoints = Number(updated.points ?? 0);
      });
    } finally {
      session.endSession();
    }

    if (!Number.isFinite(newPoints ?? NaN)) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    return Response.json({ newPoints });
  } catch (error) {
    console.error("community-urgent-prepay cancel failed", error);
    return Response.json({ error: "Failed to cancel prepayment" }, { status: 500 });
  }
}
