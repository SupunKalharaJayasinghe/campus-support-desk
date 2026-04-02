import { NextResponse } from "next/server";
import { persistIntakeRecords } from "@/models/intake-record-persistence";
import { connectMongoose } from "@/models/mongoose";
import {
  sanitizeDateField,
  sanitizeIntakeId,
  sanitizeTermCode,
  sanitizeToggle,
  snapshotIntakes,
  updateIntakeSchedule,
  type TermCode,
} from "@/models/intake-store";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
        if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }
    const targetId = sanitizeIntakeId(params.id);
    const body = (await request.json()) as Partial<{
      currentTerm: TermCode;
      termStartDate: string;
      termEndDate: string;
      autoJumpEnabled: boolean;
    }>;

    const currentTerm = sanitizeTermCode(body.currentTerm);
    const termStartDate = sanitizeDateField(body.termStartDate);
    const termEndDate = sanitizeDateField(body.termEndDate);
    const autoJumpEnabled = sanitizeToggle(body.autoJumpEnabled);

    if (!targetId) {
      return NextResponse.json(
        { message: "Intake id is required" },
        { status: 400 }
      );
    }

    if (!termStartDate) {
      return NextResponse.json(
        { message: "Term start date is required" },
        { status: 400 }
      );
    }

    if (!termEndDate) {
      return NextResponse.json(
        { message: "Term end date is required" },
        { status: 400 }
      );
    }

    if (termEndDate < termStartDate) {
      return NextResponse.json(
        { message: "Term end date must be after start date" },
        { status: 400 }
      );
    }

    const intake = updateIntakeSchedule(targetId, {
      autoJumpEnabled,
      currentTerm,
      termEndDate,
      termStartDate,
    });

    if (!intake) {
      return NextResponse.json(
        { message: "Intake not found" },
        { status: 404 }
      );
    }
    await persistIntakeRecords(snapshotIntakes({ includeDeleted: true }));

    return NextResponse.json(intake);
  } catch {
    return NextResponse.json(
      { message: "Failed to update intake schedule." },
      { status: 500 }
    );
  }
}
