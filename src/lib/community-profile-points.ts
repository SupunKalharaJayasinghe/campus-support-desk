import { CommunityProfileModel } from "@/models/CommunityProfile";

/** Awarded when a member publishes a community post. */
export const COMMUNITY_POINTS_PER_POST = 2;
/** Awarded when a member replies to a post. */
export const COMMUNITY_POINTS_PER_REPLY = 3;
/** Awarded to the reply author when the post owner marks that reply as accepted (once per reply). */
export const COMMUNITY_POINTS_ACCEPTED_ANSWER = 5;

export type CommunityProfileLevel = "BEGINNER" | "HELPER" | "EXPERT";

export function communityLevelForPoints(points: number): CommunityProfileLevel {
  if (points >= 500) return "EXPERT";
  if (points >= 100) return "HELPER";
  return "BEGINNER";
}

type IncFields = {
  points?: number;
  postsCount?: number;
  repliesCount?: number;
};

/**
 * Atomically increments profile counters/points and syncs `level` to match point thresholds.
 */
export async function applyCommunityProfileInc(
  userRef: string,
  inc: IncFields
): Promise<void> {
  const $inc: Record<string, number> = {};
  if (typeof inc.points === "number" && inc.points !== 0) {
    $inc.points = inc.points;
  }
  if (typeof inc.postsCount === "number" && inc.postsCount !== 0) {
    $inc.postsCount = inc.postsCount;
  }
  if (typeof inc.repliesCount === "number" && inc.repliesCount !== 0) {
    $inc.repliesCount = inc.repliesCount;
  }
  if (Object.keys($inc).length === 0) {
    return;
  }

  const updatedRaw = await CommunityProfileModel.findOneAndUpdate(
    { userRef },
    { $inc },
    { new: true, lean: true }
  );

  if (!updatedRaw || Array.isArray(updatedRaw)) {
    return;
  }
  const updated = updatedRaw as { points?: unknown; level?: unknown };

  const nextPoints = Number(updated.points) || 0;
  const level = communityLevelForPoints(nextPoints);
  if (String(updated.level ?? "") !== level) {
    await CommunityProfileModel.updateOne({ userRef }, { $set: { level } });
  }
}
