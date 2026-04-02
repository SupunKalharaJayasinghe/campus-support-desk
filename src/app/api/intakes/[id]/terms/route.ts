import { NextResponse } from "next/server";
import { persistIntakeRecords } from "@/models/intake-record-persistence";
import { connectMongoose } from "@/models/mongoose";
import {
  getIntakeTerms,
  sanitizeDefaultWeeksPerTerm,
  sanitizeIntakeId,
  sanitizeNotifyBeforeDays,
  sanitizeTermCode,
  sanitizeTermSchedules,
  sanitizeToggle,
  snapshotIntakes,
  updateIntakeTerms,
  type IntakeTermScheduleInput,
} from "@/models/intake-store";

export async function GET(
  _request: Request,
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

    if (!targetId) {
      return NextResponse.json(
        { message: "Intake id is required" },
        { status: 400 }
      );
    }

    const terms = getIntakeTerms(targetId);
    if (!terms) {
      return NextResponse.json(
        { message: "Intake not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(terms);
  } catch {
    return NextResponse.json(
      { message: "Failed to load intake terms." },
      { status: 500 }
    );
  }
}

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
      currentTerm: string;
      policies: Partial<{
        autoJump: boolean;
        lockPastTerms: boolean;
        defaultWeeksPerTerm: number;
        defaultNotifyBeforeDays: number;
        autoGenerateFutureTerms: boolean;
      }>;
      schedules: IntakeTermScheduleInput[];
    }>;

    if (!targetId) {
      return NextResponse.json(
        { message: "Intake id is required" },
        { status: 400 }
      );
    }

    const policiesInput = body.policies ?? {};
    const schedules = Array.isArray(body.schedules)
      ? sanitizeTermSchedules(body.schedules)
      : undefined;

    const updated = updateIntakeTerms(targetId, {
      currentTerm:
        body.currentTerm === undefined
          ? undefined
          : sanitizeTermCode(body.currentTerm),
      policies: {
        autoJump:
          policiesInput.autoJump === undefined
            ? undefined
            : sanitizeToggle(policiesInput.autoJump),
        lockPastTerms:
          policiesInput.lockPastTerms === undefined
            ? undefined
            : sanitizeToggle(policiesInput.lockPastTerms),
        defaultWeeksPerTerm:
          policiesInput.defaultWeeksPerTerm === undefined
            ? undefined
            : sanitizeDefaultWeeksPerTerm(policiesInput.defaultWeeksPerTerm),
        defaultNotifyBeforeDays:
          policiesInput.defaultNotifyBeforeDays === undefined
            ? undefined
            : sanitizeNotifyBeforeDays(policiesInput.defaultNotifyBeforeDays),
        autoGenerateFutureTerms:
          policiesInput.autoGenerateFutureTerms === undefined
            ? undefined
            : sanitizeToggle(policiesInput.autoGenerateFutureTerms),
      },
      schedules,
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
      { message: "Failed to update intake terms." },
      { status: 500 }
    );
  }
}
