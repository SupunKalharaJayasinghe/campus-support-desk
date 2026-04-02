import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { CommunityProfileModel } from "@/models/CommunityProfile";
import { connectDB } from "@/lib/mongodb";
import { withMongoRetry } from "@/lib/mongo-retry";
import { isCommunityAdminRole, resolveActiveApiUser } from "@/lib/resolve-api-user";

const BONUS_POINTS = 20;

function getLevel(points: number) {
  if (points >= 500) return "EXPERT";
  if (points >= 100) return "HELPER";
  return "BEGINNER";
}

type BonusOutcome =
  | { ok: true; points: number; level: string }
  | { ok: false; notFound: true }
  | { ok: false; conflict: true };

async function applyOneTimeBonus(userObjectId: mongoose.Types.ObjectId): Promise<BonusOutcome> {
  const updated = await CommunityProfileModel.findOneAndUpdate(
    { userRef: userObjectId, adminBonus20Used: { $ne: true } },
    { $inc: { points: BONUS_POINTS }, $set: { adminBonus20Used: true } },
    { new: true, lean: true }
  );

  if (!updated) {
    const doc = await CommunityProfileModel.findOne({ userRef: userObjectId })
      .select("points level adminBonus20Used")
      .lean();
    if (!doc) return { ok: false, notFound: true };
    const row = doc as { points?: unknown; level?: unknown; adminBonus20Used?: unknown };
    if (row.adminBonus20Used === true) {
      const pts = Number(row.points) || 0;
      const level = getLevel(pts);
      const storedLvl = String(row.level ?? "");
      if (storedLvl !== level) {
        await CommunityProfileModel.updateOne(
          { userRef: userObjectId },
          { $set: { level } }
        );
      }
      return { ok: true, points: pts, level };
    }
    return { ok: false, conflict: true };
  }

  const nextPoints = Number(updated.points) || 0;
  const nextLevel = getLevel(nextPoints);
  const prevLevel = String(updated.level ?? "");
  if (prevLevel !== nextLevel) {
    await CommunityProfileModel.updateOne(
      { _id: updated._id },
      { $set: { level: nextLevel } }
    );
  }
  return { ok: true, points: nextPoints, level: nextLevel };
}

/** Community admin: add fixed bonus points to a member's community profile. */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const actor = await resolveActiveApiUser(req);
    if (!actor) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!isCommunityAdminRole(actor.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "Valid userId is required" }, { status: 400 });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const outcome = await withMongoRetry(() => applyOneTimeBonus(userObjectId), {
      attempts: 4,
      baseDelayMs: 500,
    });

    if (!outcome.ok) {
      if (outcome.notFound) {
        return NextResponse.json(
          { message: "Community profile not found for this user." },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          message: "The one-time +20 bonus could not be applied. Try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: "20 points added",
      points: outcome.points,
      level: outcome.level,
      adminBonus20Used: true,
    });
  } catch (error) {
    console.error("[community-profile/admin-points]", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to award community points. Check your network and MongoDB Atlas access.",
        hint:
          error instanceof Error && error.name === "MongoNetworkError"
            ? "Transient DB connection reset — retry from the UI; ensure Atlas Network Access allows your IP (0.0.0.0/0 for dev or your current IP)."
            : undefined,
      },
      { status: 500 }
    );
  }
}
