import { NextResponse } from "next/server";
import { connectMongoose } from "@/models/mongoose";
import {
  getIntakeTerms,
  recalculateIntakeFutureTerms,
  sanitizeIntakeId,
  sanitizeToggle,
} from "@/models/intake-store";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongoose().catch(() => null);
    const targetId = sanitizeIntakeId(params.id);
    const body = (await request.json().catch(() => ({}))) as Partial<{
      overwriteManuallyEditedFuture: boolean;
    }>;

    if (!targetId) {
      return NextResponse.json(
        { message: "Intake id is required" },
        { status: 400 }
      );
    }

    const currentTerms = getIntakeTerms(targetId);
    if (!currentTerms) {
      return NextResponse.json(
        { message: "Intake not found" },
        { status: 404 }
      );
    }

    const y1s1 = currentTerms.schedules.find((schedule) => schedule.termCode === "Y1S1");
    if (!y1s1?.startDate) {
      return NextResponse.json(
        { message: "Set Y1S1 start date before recalculating future terms." },
        { status: 400 }
      );
    }

    const updated = recalculateIntakeFutureTerms(targetId, {
      overwriteManuallyEditedFuture: sanitizeToggle(
        body.overwriteManuallyEditedFuture
      ),
    });

    if (!updated) {
      return NextResponse.json(
        { message: "Intake not found" },
        { status: 404 }
      );
    }

    const terms = getIntakeTerms(targetId);
    return NextResponse.json(terms);
  } catch {
    return NextResponse.json(
      { message: "Failed to recalculate future terms." },
      { status: 500 }
    );
  }
}
