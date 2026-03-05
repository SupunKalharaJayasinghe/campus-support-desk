import { connectDB } from "@/lib/mongodb";
import CommunityReply from "@/model/communityReply";

export async function POST(req: Request) {

  await connectDB();

  const body = await req.json();

  const reply = await CommunityReply.create(body);

  return Response.json(reply);
}

export async function GET(req: Request) {

  await connectDB();

  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("postId");

  const replies = await CommunityReply.find({ postId });

  return Response.json(replies);
}