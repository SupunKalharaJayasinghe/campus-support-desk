import { NextResponse } from "next/server";
import "@/models/Intake";
import { persistIntakeRecords } from "@/models/intake-record-persistence";
import { connectMongoose } from "@/models/mongoose";
import {
  createIntake,
  hasInvalidTermScheduleRange,
  hasIntakeConflict,
  isValidDegreeForFaculty,
  isValidFacultyCode,
  listIntakes,
  snapshotIntakes,
  sanitizeIntakeMonth,
  sanitizeIntakeStatus,
  sanitizeIntakeYear,
  sanitizeTermSchedules,
  sanitizeToggle,
  type IntakeSort,
  type IntakeStatus,
  type IntakeRecord,
  type IntakeTermScheduleRecord,
  type TermCode,
} from "@/models/intake-store";
import type { IntakeTermScheduleInput } from "@/models/intake-store";

function parsePageParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parsePageSizeParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const nextValue = Math.floor(parsed);
  if (![10, 25, 50, 100].includes(nextValue)) {
    return fallback;
  }

  return nextValue;
}

function sanitizeSort(value: string | null): IntakeSort {
  if (value === "az" || value === "za" || value === "created") {
    return value;
  }

  return "updated";
}

function sanitizeStatus(value: string | null): "" | IntakeStatus {
  if (value === "ACTIVE" || value === "INACTIVE" || value === "DRAFT") {
    return value;
  }

  return "";
}

function sanitizeCurrentTerm(value: string | null): "" | TermCode {
  if (
    value === "Y1S1" ||
    value === "Y1S2" ||
    value === "Y2S1" ||
    value === "Y2S2" ||
    value === "Y3S1" ||
    value === "Y3S2" ||
    value === "Y4S1" ||
    value === "Y4S2"
  ) {
    return value;
  }

  return "";
}

function normalizeCode(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function normalizeSchedules(value: unknown): IntakeTermScheduleInput[] {
  return sanitizeTermSchedules(value);
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

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const status = sanitizeStatus(searchParams.get("status"));
  const sort = sanitizeSort(searchParams.get("sort"));
  const faculty = normalizeCode(
    searchParams.get("faculty") ??
      searchParams.get("facultyId") ??
      searchParams.get("facultyCode")
  );
  const degree = normalizeCode(
    searchParams.get("degree") ??
      searchParams.get("degreeProgramId") ??
      searchParams.get("degreeCode")
  );
  const currentTerm = sanitizeCurrentTerm(searchParams.get("currentTerm"));
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);

  const allItems = listIntakes({
    currentTerm,
    degree,
    faculty,
    search,
    sort,
    status,
  });

  const totalCount = allItems.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(parsePageParam(searchParams.get("page"), 1), pageCount);
  const start = (page - 1) * pageSize;

  return NextResponse.json({
    items: allItems.slice(start, start + pageSize).map((item) => toApiIntake(item)),
    page,
    pageSize,
    total: totalCount,
    totalCount,
  });
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
        if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const body = (await request.json()) as Partial<{
      name: string;
      stream: string;
      facultyCode: string;
      degreeCode: string;
      intakeYear: number;
      intakeMonth: string;
      status: IntakeStatus;
      autoGenerateTerms: boolean;
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
    const autoGenerateTerms =
      body.autoGenerateTerms === undefined
        ? undefined
        : sanitizeToggle(body.autoGenerateTerms);
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
    const termSchedules = normalizeSchedules(body.termSchedules ?? body.schedules);

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

    const intake = createIntake({
      name,
      stream,
      autoGenerateFutureTerms,
      autoGenerateTerms,
      autoJumpEnabled,
      degreeCode,
      facultyCode,
      intakeMonth,
      intakeYear,
      recalculateFutureTerms,
      status,
      termSchedules,
    });
    await persistIntakeRecords(snapshotIntakes({ includeDeleted: true }));

    return NextResponse.json(toApiIntake(intake), { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Failed to create intake." },
      { status: 500 }
    );
  }
}

