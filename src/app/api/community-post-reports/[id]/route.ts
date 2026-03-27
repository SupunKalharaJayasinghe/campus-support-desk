import { connectDB } from "@/lib/mongodb";
import CommunityPostReport from "@/models/communityPostReport";
import mongoose from "mongoose";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid report id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { status?: unknown };
    const raw = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    const status =
      raw === "OPEN" || raw === "REVIEWED" || raw === "DISMISSED" ? raw : null;

    if (!status) {
      return Response.json(
        { error: "status must be OPEN, REVIEWED, or DISMISSED" },
        { status: 400 }
      );
    }

    const updated = await CommunityPostReport.findByIdAndUpdate(
      params.id,
      { $set: { status } },
      { new: true }
    ).lean();

    if (!updated) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("community-post-reports PATCH failed", error);
    return Response.json({ error: "Failed to update report" }, { status: 500 });
  }
}
