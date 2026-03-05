import { connectDB } from "@/lib/mongodb";
import CommunityPost from "@/model/communityPost";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {

  await connectDB();

  const post = await CommunityPost.findById(params.id);

  return Response.json(post);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {

  await connectDB();

  await CommunityPost.findByIdAndDelete(params.id);

  return Response.json({ message: "Post deleted" });
}