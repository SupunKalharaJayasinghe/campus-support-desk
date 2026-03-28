import { connectDB } from "@/lib/mongodb";
import CommunityPost from "@/models/communityPost";

export async function archiveCommunityPostsOlderThanDays(days: number) {
  await connectDB();

  const ms = Math.max(0, Math.floor(days)) * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - ms);

  const result = await CommunityPost.updateMany(
    { status: { $ne: "archived" }, createdAt: { $lte: cutoff } },
    { $set: { status: "archived" } }
  );

  return {
    matchedCount: result.matchedCount ?? 0,
    modifiedCount: result.modifiedCount ?? 0,
    cutoff,
    days: Math.max(0, Math.floor(days)),
  };
}

