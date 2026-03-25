import { NextResponse } from "next/server";
import "@/models/Intake";
import { connectMongoose } from "@/models/mongoose";
import {
  deleteIntake,
  findIntakeById,
  hasInvalidTermScheduleRange,
  hasIntakeConflict,
  isValidDegreeForFaculty,
  isValidFacultyCode,
  sanitizeIntakeId,
  sanitizeIntakeMonth,
  sanitizeIntakeStatus,
  sanitizeIntakeYear,
  sanitizeTermSchedules,
  sanitizeToggle,
  type IntakeStatus,
  type IntakeRecord,
  type IntakeTermScheduleRecord,
  updateIntake,
} from "@/models/intake-store";
import type { IntakeTermScheduleInput } from "@/models/intake-store";

function normalizeCode(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function toApiSchedule(schedule: IntakeTermScheduleRecord) {
  return {
    termCode: schedule.termCode,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    weeks: schedule.weeks,
    notifyBeforeDays: schedule.notifyBeforeDays,
    manuallyEdited: schedule.isManuallyCustomized,
    isManuallyCustomized: schedule.isManuallyCustomized,
    notificationSentAt: schedule.notificationSentAt,
  };
}

function toApiIntake(intake: IntakeRecord) {
  const schedules = intake.termSchedules.map((schedule) => toApiSchedule(schedule));
  const lockPastTerms = intake.lockPastTerms !== false;
  const defaultWeeksPerTerm = Number.isFinite(intake.defaultWeeksPerTerm)
    ? intake.defaultWeeksPerTerm
    : 16;
  const defaultNotifyBeforeDays =
    intake.defaultNotifyBeforeDays === 1 ||
    intake.defaultNotifyBeforeDays === 3 ||
    intake.defaultNotifyBeforeDays === 7
      ? intake.defaultNotifyBeforeDays
      : 3;
  const autoGenerateFutureTerms = intake.autoGenerateFutureTerms !== false;

  return {
    ...intake,
    autoJump: intake.autoJumpEnabled !== false,
    autoJumpEnabled: intake.autoJumpEnabled !== false,
    lockPastTerms,
    defaultWeeksPerTerm,
    defaultNotifyBeforeDays,
    autoGenerateFutureTerms,
    schedules,
    termSchedules: schedules,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await connectMongoose().catch(() => null);
  const targetId = sanitizeIntakeId(params.id);

  if (!targetId) {
    return NextResponse.json(
      { message: "Intake id is required" },
      { status: 400 }
    );
  }

  const intake = findIntakeById(targetId);
  if (!intake) {
    return NextResponse.json(
      { message: "Intake not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: intake.id,
    _id: intake.id,
    name: intake.name,
    currentTerm: intake.currentTerm,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongoose().catch(() => null);
    const targetId = sanitizeIntakeId(params.id);
    const body = (await request.json()) as Partial<{
      name: string;
      stream: string;
      facultyCode: string;
      degreeCode: string;
      intakeYear: number;
      intakeMonth: string;
      status: IntakeStatus;
      autoGenerateFutureTerms: boolean;
      recalculateFutureTerms: boolean;
      autoJumpEnabled: boolean;
      termSchedules: IntakeTermScheduleInput[];
      schedules: IntakeTermScheduleInput[];
    }>;

    const facultyCode = normalizeCode(body.facultyCode);
    const degreeCode = normalizeCode(body.degreeCode);
    const name = String(body.name ?? "").trim();
    const stream = String(body.stream ?? "").trim();
    const intakeYear = sanitizeIntakeYear(body.intakeYear);
    const intakeMonth = sanitizeIntakeMonth(body.intakeMonth);
    const status = sanitizeIntakeStatus(body.status);
    const autoGenerateFutureTerms =
      body.autoGenerateFutureTerms === undefined
        ? undefined
        : sanitizeToggle(body.autoGenerateFutureTerms);
    const recalculateFutureTerms =
      body.recalculateFutureTerms === undefined
        ? undefined
        : sanitizeToggle(body.recalculateFutureTerms);
    const autoJumpEnabled =
      body.autoJumpEnabled === undefined
        ? undefined
        : sanitizeToggle(body.autoJumpEnabled);
    const termSchedules = sanitizeTermSchedules(body.termSchedules ?? body.schedules);

    if (!targetId) {
      return NextResponse.json(
        { message: "Intake id is required" },
        { status: 400 }
      );
    }

    if (!facultyCode || !isValidFacultyCode(facultyCode)) {
      return NextResponse.json(
        { message: "Select a valid faculty" },
        { status: 400 }
      );
    }

    if (!degreeCode || !isValidDegreeForFaculty(degreeCode, facultyCode)) {
      return NextResponse.json(
        { message: "Select a valid degree for the selected faculty" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { message: "Intake name is required" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(intakeYear) || intakeYear < 2000 || intakeYear > 2100) {
      return NextResponse.json(
        { message: "Enter a valid intake year" },
        { status: 400 }
      );
    }

    if (!intakeMonth) {
      return NextResponse.json(
        { message: "Select a valid intake month" },
        { status: 400 }
      );
    }

    if (hasInvalidTermScheduleRange(termSchedules)) {
      return NextResponse.json(
        { message: "Term end date must be after term start date" },
        { status: 400 }
      );
    }

    if (
      hasIntakeConflict({
        degreeCode,
        excludeId: targetId,
        facultyCode,
        name,
        intakeMonth,
        intakeYear,
      })
    ) {
      return NextResponse.json(
        { message: "Intake already exists for the selected faculty and degree" },
        { status: 409 }
      );
    }

    const intake = updateIntake(targetId, {
      name,
      stream,
      degreeCode,
      facultyCode,
      intakeMonth,
      intakeYear,
      autoGenerateFutureTerms,
      recalculateFutureTerms,
      autoJumpEnabled,
      status,
      termSchedules,
    });

    if (!intake) {
      return NextResponse.json(
        { message: "Intake not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(toApiIntake(intake));
  } catch {
    return NextResponse.json(
      { message: "Failed to update intake." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongoose().catch(() => null);
    const targetId = sanitizeIntakeId(params.id);
    const deleted = deleteIntake(targetId);

    if (!deleted) {
      return NextResponse.json(
        { message: "Intake not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Failed to delete intake." },
      { status: 500 }
    );
  }
}
