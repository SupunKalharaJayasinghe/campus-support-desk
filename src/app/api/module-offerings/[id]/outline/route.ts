import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import { updateModuleOfferingOutlineWeek } from "@/models/module-offering-store";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongoose().catch(() => null);
    const body = (await request.json()) as Partial<{
      weekNo: number;
      title: string;
      plannedStartDate: string;
      plannedEndDate: string;
      type: string;
    }>;

    const weekNo = Number(body.weekNo);
    if (!Number.isFinite(weekNo) || weekNo < 1) {
      return NextResponse.json({ message: "Valid week number is required" }, { status: 400 });
    }

    const updated = updateModuleOfferingOutlineWeek(params.id, {
      weekNo,
      title: body.title,
      plannedStartDate: body.plannedStartDate,
      plannedEndDate: body.plannedEndDate,
      type: body.type,
    });
    if (!updated) {
      return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { message: "Failed to update outline week" },
      { status: 500 }
    );
  }
}
