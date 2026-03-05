import { connectDB } from "@/lib/mongodb";
import Badge from "@/model/badge";

export async function GET() {

  await connectDB();

  const badges = await Badge.find();

  return Response.json(badges);
}

export async function POST(req: Request) {

  await connectDB();

  const body = await req.json();

  const badge = await Badge.create(body);

  return Response.json(badge);
}