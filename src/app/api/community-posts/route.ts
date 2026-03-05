import { connectDB } from "@/lib/mongodb";
import CommunityPost from "@/model/communityPost";

export async function GET() {
  await connectDB();

  const posts = await CommunityPost.find().sort({ createdAt: -1 });

  return Response.json(posts);
}