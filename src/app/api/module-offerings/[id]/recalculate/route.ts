import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import { recalculateModuleOfferingOutline } from "@/models/module-offering-store";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongoose().catch(() => null);
    const body = (await request.json().catch(() => ({}))) as Partial<{
      overwriteManual: boolean;
    }>;

    const updated = recalculateModuleOfferingOutline(params.id, {
      overwriteManual: body.overwriteManual === true,
    });
    if (!updated) {
      return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to recalculate outline",
      },
      { status: 400 }
    );
  }
}
