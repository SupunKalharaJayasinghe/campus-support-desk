import { archiveCommunityPostsOlderThanDays } from "@/lib/community-post-archive";

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function POST(req: Request) {
  try {
    const secret =
      process.env.CRON_SECRET ?? process.env.COMMUNITY_CRON_SECRET ?? "";
    if (secret) {
      const token = getBearerToken(req);
      if (!token || token !== secret) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "Server misconfigured: COMMUNITY_CRON_SECRET missing" },
        { status: 500 }
      );
    }

    const result = await archiveCommunityPostsOlderThanDays(7);
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("community-posts/archive POST failed", error);
    return Response.json({ error: "Failed to archive posts" }, { status: 500 });
  }
}

