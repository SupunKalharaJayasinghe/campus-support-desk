import mongoose from "mongoose";
import { normalizeCommunityProfileStatus } from "@/lib/community-profile-visibility";
import { CommunityProfileModel } from "@/models/CommunityProfile";

export type CommunityMemberFeedFields = {
  displayName: string;
  points: number;
  status: "PUBLIC" | "PRIVATE";
};

/** Batch-load community profile fields for feed authors (display name, points, visibility). */
export async function getCommunityMemberFieldsByUserRefs(
  userRefs: unknown[]
): Promise<Map<string, CommunityMemberFeedFields>> {
  const idSet = new Set<string>();
  for (const ref of userRefs) {
    const s = ref != null ? String(ref) : "";
    if (s && mongoose.Types.ObjectId.isValid(s)) {
      idSet.add(s);
    }
  }
  if (idSet.size === 0) {
    return new Map();
  }

  const objectIds = [...idSet].map((id) => new mongoose.Types.ObjectId(id));
  const profiles = await CommunityProfileModel.find({ userRef: { $in: objectIds } })
    .select({ userRef: 1, displayName: 1, points: 1, status: 1 })
    .lean()
    .exec();

  const map = new Map<string, CommunityMemberFeedFields>();
  for (const p of profiles) {
    map.set(String(p.userRef), {
      displayName: String(p.displayName ?? "").trim(),
      points: Number(p.points ?? 0),
      status: normalizeCommunityProfileStatus((p as { status?: unknown }).status),
    });
  }
  return map;
}
