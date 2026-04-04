import { connectDB } from "@/lib/mongodb";
import CommunityPost from "@/models/communityPost";

/**
 * Archives urgent posts that have passed their expiration time.
 * Moves expired urgent posts to "archived" status with status2 marked as appropriate.
 */
export async function archiveExpiredUrgentPosts() {
  await connectDB();

  const now = new Date();

  const result = await CommunityPost.updateMany(
    {
      isUrgent: true,
      urgentExpiresAt: { $lt: now },
      status: { $ne: "archived" }, // Don't re-archive already archived posts
    },
    {
      $set: {
        status: "archived",
        // Keep status2 as-is (resolved/not_resolved) to preserve resolution state
      },
    }
  );

  return {
    matchedCount: result.matchedCount ?? 0,
    modifiedCount: result.modifiedCount ?? 0,
    timestamp: now,
  };
}

/**
 * Returns count of urgent posts that have expired but not yet archived.
 */
export async function countExpiredUrgentPosts() {
  await connectDB();

  const now = new Date();

  const count = await CommunityPost.countDocuments({
    isUrgent: true,
    urgentExpiresAt: { $lt: now },
    status: { $ne: "archived" },
  });

  return count;
}

/**
 * Gets details of expired urgent posts (for monitoring/debugging).
 */
export async function getExpiredUrgentPosts(limit: number = 100) {
  await connectDB();

  const now = new Date();

  const posts = await CommunityPost.find({
    isUrgent: true,
    urgentExpiresAt: { $lt: now },
    status: { $ne: "archived" },
  })
    .select({
      _id: 1,
      title: 1,
      author: 1,
      urgentLevel: 1,
      urgentExpiresAt: 1,
      status: 1,
      createdAt: 1,
    })
    .sort({ urgentExpiresAt: -1 })
    .limit(limit)
    .lean();

  return posts;
}
