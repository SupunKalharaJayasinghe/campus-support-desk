import { connectDB } from "@/lib/mongodb";
import ReplyVote from "@/model/replyVote";

export async function POST(req: Request) {

  await connectDB();

  const body = await req.json();

  const vote = await ReplyVote.create(body);

  return Response.json(vote);
}