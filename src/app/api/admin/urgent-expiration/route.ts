import { connectDB } from "@/lib/mongodb";
import {
  archiveExpiredUrgentPosts,
  countExpiredUrgentPosts,
  getExpiredUrgentPosts,
} from "@/lib/community-urgent-expiration";
import { resolveActiveApiUser, isCommunityAdminRole } from "@/lib/resolve-api-user";

/**
 * Admin-only endpoint to manage expired urgent post archival.
 *
 * GET: Check status of expired urgent posts
 * POST: Trigger archival of expired urgent posts
 *
 * Query params:
 *   - action: "check" (default) | "archive" | "details"
 *   - limit: number of posts to return in details (default: 100)
 */

export async function GET(req: Request) {
  try {
    await connectDB();

    const actor = await resolveActiveApiUser(req);
    if (!actor || !isCommunityAdminRole(actor.role)) {
      return Response.json(
        { error: "Only community admins can access this endpoint" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "check";

    if (action === "check") {
      const count = await countExpiredUrgentPosts();
      return Response.json({
        status: "ok",
        action: "check",
        expiredUrgentPostsCount: count,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === "details") {
      const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
      const posts = await getExpiredUrgentPosts(limit);
      return Response.json({
        status: "ok",
        action: "details",
        posts,
        count: posts.length,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json(
      { error: `Unknown action: ${action}. Use "check" or "details"` },
      { status: 400 }
    );
  } catch (error) {
    console.error("admin/urgent-expiration GET failed", error);
    return Response.json(
      { error: "Failed to check expired urgent posts" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const actor = await resolveActiveApiUser(req);
    if (!actor || !isCommunityAdminRole(actor.role)) {
      return Response.json(
        { error: "Only community admins can access this endpoint" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "archive";

    if (action === "archive") {
      const result = await archiveExpiredUrgentPosts();
      return Response.json({
        status: "ok",
        action: "archive",
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        timestamp: result.timestamp.toISOString(),
      });
    }

    return Response.json(
      { error: `Unknown action: ${action}. Use "archive"` },
      { status: 400 }
    );
  } catch (error) {
    console.error("admin/urgent-expiration POST failed", error);
    return Response.json(
      { error: "Failed to archive expired urgent posts" },
      { status: 500 }
    );
  }
}
