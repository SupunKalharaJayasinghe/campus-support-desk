import { CommunityProfileModel } from "@/models/CommunityProfile";

/** Returned in API JSON `error` when participation is blocked. */
export const COMMUNITY_PROFILE_REQUIRED_MESSAGE =
  "You need a community profile to participate. Ask a community admin to add you to the community.";

export async function userHasCommunityProfile(userId: string): Promise<boolean> {
  const doc = await CommunityProfileModel.exists({ userRef: userId });
  return Boolean(doc);
}
