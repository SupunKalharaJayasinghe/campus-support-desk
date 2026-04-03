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

    // If a valid, unconsumed prepay already exists (e.g., user paid earlier but draft didn't store the id),
    // reuse it instead of deducting points again.
    const now = new Date();
    const existing = await CommunityUrgentPrepayModel.findOne({
      userRef: userId,
      urgentLevel,
      feePoints,
      consumedAt: null,
      expiresAt: { $gt: now },
    })
      .lean()
      .exec()
      .catch(() => null);

    if (existing && !Array.isArray(existing)) {
      const profile = await CommunityProfileModel.findOne({ userRef: userId })
        .lean()
        .exec()
        .catch(() => null);
      const pts = Number((profile as { points?: number } | null)?.points ?? 0);
      return Response.json({
        prepayId: String((existing as { _id?: unknown })._id ?? ""),
        newPoints: Number.isFinite(pts) ? pts : 0,
        urgentLevel,
        feePoints,
        expiresAt:
          (existing as { expiresAt?: Date | string | null }).expiresAt
            ? new Date((existing as { expiresAt?: Date | string }).expiresAt!).toISOString()
            : new Date(Date.now() + PREPAY_TTL_MS).toISOString(),
        reused: true,
      });
    }

    // Deduct points now and create a refundable prepay token.
    // If the user cancels before consuming it, we refund the points.
    const session = await mongoose.startSession();
    let prepayId: string | null = null;
    let newPoints: number | null = null;
    let expiresAtIso: string | null = null;
    try {
      await session.withTransaction(async () => {
        const displayName = toTrimmedString(body.name) || "Current User";
        const username = toTrimmedString(body.username);
        const email = toTrimmedString(body.email).toLowerCase();

        const profile =
          (await CommunityProfileModel.findOne({ userRef: userId }, null, { session })
            .exec()
            .catch(() => null)) ?? null;

        const ensured =
          profile ??
          (await CommunityProfileModel.create(
            [
              {
                userRef: userId,
                displayName,
                username,
                email,
                points: 0,
                level: "BEGINNER",
              },
            ],
            { session }
          ).then((rows) => rows[0] ?? null));

        if (!ensured) {
          return;
        }

        const currentPoints = Number(ensured.points ?? 0);
        if (!Number.isFinite(currentPoints) || currentPoints < feePoints) {
          return;
        }

        ensured.points = currentPoints - feePoints;
        ensured.level = getLevel(ensured.points);
        await ensured.save({ session });

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
        newPoints = Number(ensured.points ?? 0);
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
