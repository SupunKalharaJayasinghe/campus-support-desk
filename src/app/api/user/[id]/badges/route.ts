import { connectDB } from "@/lib/mongodb";
import UserBadge from "@/model/userBadge";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {

  await connectDB();

  const badges = await UserBadge.find({ userId: params.id }).populate("badgeId");

  return Response.json(badges);
}