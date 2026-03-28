import { connectDB } from "@/lib/mongodb";
import Badge from "@/models/badge";

export async function GET() {
  try {
    await connectDB();

    const badges = await Badge.find();

    return Response.json(badges);
  } catch (error) {
    console.error("badges GET failed", error);
    return Response.json({ error: "Failed to fetch badges" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const { name, pointsRequired } = body;

    if (!name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    if (pointsRequired != null && typeof pointsRequired !== "number") {
      return Response.json({ error: "pointsRequired must be a number" }, { status: 400 });
    }

    const badge = await Badge.create(body);

    return Response.json(badge, { status: 201 });
  } catch (error) {
    console.error("badges POST failed", error);
    return Response.json({ error: "Failed to create badge" }, { status: 500 });
  }
}
