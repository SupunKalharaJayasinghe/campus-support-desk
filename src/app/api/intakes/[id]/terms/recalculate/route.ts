import { NextResponse } from "next/server";
import { persistIntakeRecords } from "@/models/intake-record-persistence";
import { connectMongoose } from "@/models/mongoose";
import {
  getIntakeTerms,
  recalculateIntakeFutureTerms,
  sanitizeIntakeId,
  snapshotIntakes,
  sanitizeToggle,
} from "@/models/intake-store";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "MongoDB connection is required" },
        { status: 503 }
      );
    }
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
    await persistIntakeRecords(snapshotIntakes({ includeDeleted: true }));

    const terms = getIntakeTerms(targetId);
    return NextResponse.json(terms);
  } catch {
    return NextResponse.json(
      { message: "Failed to recalculate future terms." },
      { status: 500 }
    );
  }
}
