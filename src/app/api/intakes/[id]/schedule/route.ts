import { NextResponse } from "next/server";
import { connectMongoose } from "@/lib/mongoose";
import {
  sanitizeDateField,
  sanitizeIntakeId,
  sanitizeTermCode,
  sanitizeToggle,
  updateIntakeSchedule,
  type TermCode,
} from "@/lib/intake-store";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongoose().catch(() => null);
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

    return NextResponse.json(intake);
  } catch {
    return NextResponse.json(
      { message: "Failed to update intake schedule." },
      { status: 500 }
    );
  }
}
