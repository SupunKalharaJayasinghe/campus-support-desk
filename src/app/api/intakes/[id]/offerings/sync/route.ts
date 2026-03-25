import { NextResponse } from "next/server";
import "@/models/Intake";
import "@/models/Module";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import { sanitizeIntakeId, sanitizeTermCode } from "@/models/intake-store";
import { syncIntakeOfferingsForTerm } from "@/models/module-offering-store";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongoose().catch(() => null);
    const intakeId = sanitizeIntakeId(params.id);
    const body = (await request.json().catch(() => ({}))) as Partial<{
      termCode: string;
      selectedModuleIds: string[];
    }>;

    if (!intakeId) {
      return NextResponse.json(
        { message: "Intake id is required" },
        { status: 400 }
      );
    }

    const rawTermCode = String(body.termCode ?? "").trim().toUpperCase();
    if (!rawTermCode) {
      return NextResponse.json(
        { message: "termCode is required" },
        { status: 400 }
      );
    }

    const selectedModuleIds = Array.isArray(body.selectedModuleIds)
      ? body.selectedModuleIds.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];

    const summary = syncIntakeOfferingsForTerm({
      intakeId,
      termCode: sanitizeTermCode(rawTermCode),
      selectedModuleIds,
    });

    return NextResponse.json({
      ok: true,
      ...summary,
      message:
        summary.blocked.length > 0
          ? "Some modules were not removed because they already contain academic progress."
          : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to sync module offerings",
      },
      { status: 400 }
    );
  }
}
