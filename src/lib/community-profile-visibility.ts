export function normalizeCommunityProfileStatus(value: unknown): "PUBLIC" | "PRIVATE" {
  return String(value ?? "PUBLIC").toUpperCase() === "PRIVATE" ? "PRIVATE" : "PUBLIC";
}

export function shouldExposeCommunityPointsToViewer(options: {
  profileStatus: "PUBLIC" | "PRIVATE";
  profileUserId: string;
  viewerUserId: string | null | undefined;
  viewerIsCommunityAdmin: boolean;
  /**
   * Sidebar “Members Details” is a shared list: PRIVATE profiles must not show points here,
   * even to the profile owner (they still see points on their own profile page / feed).
   */
  memberDirectoryList?: boolean;
}): boolean {
  if (options.viewerIsCommunityAdmin) return true;
  const vid = String(options.viewerUserId ?? "").trim();
  if (
    !options.memberDirectoryList &&
    vid &&
    vid === options.profileUserId
  ) {
    return true;
  }
  if (options.profileStatus === "PRIVATE") return false;
  return true;
}

/** Feed: hide points for PRIVATE profiles unless viewer is self or community admin. */
export function authorMemberPointsForViewer(options: {
  member: { points: number; status: "PUBLIC" | "PRIVATE" } | undefined;
  authorUserId: string;
  viewerUserId: string | null | undefined;
  viewerIsCommunityAdmin: boolean;
}): number | undefined {
  const { member, authorUserId, viewerUserId, viewerIsCommunityAdmin } = options;
  if (!member) return 0;
  const ok = shouldExposeCommunityPointsToViewer({
    profileStatus: member.status,
    profileUserId: authorUserId,
    viewerUserId,
    viewerIsCommunityAdmin,
  });
  return ok ? member.points : undefined;
}
