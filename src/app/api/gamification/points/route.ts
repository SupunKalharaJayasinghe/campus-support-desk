import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/GamificationPoints";
import "@/models/ModuleOffering";
import "@/models/Student";
import { awardCustomPoints } from "@/lib/points-engine";
import { connectMongoose } from "@/lib/mongoose";
import { findModuleById } from "@/lib/module-store";
import { GamificationPointsModel } from "@/models/GamificationPoints";
import { StudentModel } from "@/models/Student";

const CATEGORY_VALUES = [
  "academic",
  "quiz",
  "assignment",
  "milestone",
  "bonus",
  "penalty",
  "custom",
] as const;

const ACTION_VALUES = [
  "module_passed",
  "high_score",
  "perfect_score",
  "semester_gpa_above_3",
  "semester_gpa_above_3.5",
  "semester_all_passed",
  "first_class_gpa",
  "gpa_improvement",
  "quiz_completed",
  "quiz_on_time",
  "quiz_high_score",
  "quiz_perfect_score",
  "assignment_submitted",
  "milestone_reached",
  "streak_bonus",
  "custom",
] as const;

const SORT_FIELD_VALUES = [
  "createdAt",
  "updatedAt",
  "xpPoints",
  "action",
  "category",
  "academicYear",
  "semester",
] as const;

type CategoryFilter = (typeof CATEGORY_VALUES)[number];
type ActionFilter = (typeof ACTION_VALUES)[number];

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toIsoDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function readId(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const row = value as {
      _id?: unknown;
      id?: unknown;
      toString?: () => string;
    };
    const nestedId = String(row._id ?? row.id ?? "").trim();
    if (nestedId) {
      return nestedId;
    }

    const rendered = typeof row.toString === "function" ? row.toString() : "";
    return rendered === "[object Object]" ? "" : rendered.trim();
  }

  return "";
}

function buildStudentName(student: unknown) {
  const row = asObject(student);
  const firstName = collapseSpaces(row?.firstName);
  const lastName = collapseSpaces(row?.lastName);
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function sanitizeSemester(value: unknown): 1 | 2 | null {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2) {
    return parsed;
  }

  return null;
}

function sanitizePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function toApiPoint(row: unknown) {
  const doc = asObject(row);
  if (!doc) {
    return null;
  }

  const id = readId(doc._id ?? doc.id);
  if (!id) {
    return null;
  }

  const student = asObject(doc.studentId);
  const offering = asObject(doc.moduleOfferingId);
  const moduleId = collapseSpaces(offering?.moduleId);
  const moduleRecord = moduleId ? findModuleById(moduleId) : null;

  return {
    id,
    _id: id,
    studentId: student
      ? {
          _id: readId(student._id ?? student.id) || null,
          id: readId(student._id ?? student.id) || null,
          registrationNumber: collapseSpaces(student.studentId),
          studentId: collapseSpaces(student.studentId),
          firstName: collapseSpaces(student.firstName),
          lastName: collapseSpaces(student.lastName),
          fullName: buildStudentName(student),
        }
      : readId(doc.studentId) || null,
    action: collapseSpaces(doc.action),
    xpPoints: Number(doc.xpPoints ?? 0),
    reason: collapseSpaces(doc.reason),
    category: collapseSpaces(doc.category),
    referenceType: collapseSpaces(doc.referenceType) || null,
    referenceId: readId(doc.referenceId) || null,
    moduleOfferingId: offering
      ? {
          _id: readId(offering._id ?? offering.id) || null,
          id: readId(offering._id ?? offering.id) || null,
          moduleId,
          moduleCode:
            collapseSpaces(offering.moduleCode) || collapseSpaces(moduleRecord?.code),
          moduleName:
            collapseSpaces(offering.moduleName) || collapseSpaces(moduleRecord?.name),
          intakeId: collapseSpaces(offering.intakeId),
          termCode: collapseSpaces(offering.termCode),
          status: collapseSpaces(offering.status),
        }
      : readId(doc.moduleOfferingId) || null,
    academicYear: collapseSpaces(doc.academicYear) || null,
    semester: Number(doc.semester ?? 0) || null,
    metadata: asObject(doc.metadata) ?? {},
    awardedBy: collapseSpaces(doc.awardedBy),
    isRevoked: Boolean(doc.isRevoked),
    revokedAt: toIsoDate(doc.revokedAt),
    revokedReason: collapseSpaces(doc.revokedReason),
    createdAt: toIsoDate(doc.createdAt),
    updatedAt: toIsoDate(doc.updatedAt),
  };
}

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        {
          success: false,
          error: "Gamification ledger management is unavailable in demo mode",
        },
        { status: 501 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = collapseSpaces(searchParams.get("studentId"));
    const category = collapseSpaces(searchParams.get("category"));
    const action = collapseSpaces(searchParams.get("action"));
    const academicYear = collapseSpaces(searchParams.get("academicYear"));
    const semesterParam = searchParams.get("semester");
    const semester =
      semesterParam === null ? null : sanitizeSemester(searchParams.get("semester"));
    const limit = Math.min(sanitizePositiveInteger(searchParams.get("limit"), 20), 100);
    const page = sanitizePositiveInteger(searchParams.get("page"), 1);
    const sortBy = collapseSpaces(searchParams.get("sortBy")) || "createdAt";
    const sortOrder = collapseSpaces(searchParams.get("sortOrder")).toLowerCase() === "asc"
      ? 1
      : -1;

    if (studentId && !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid studentId filter" },
        { status: 400 }
      );
    }

    if (
      category &&
      !CATEGORY_VALUES.includes(category as CategoryFilter)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Category must be one of: ${CATEGORY_VALUES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (action && !ACTION_VALUES.includes(action as ActionFilter)) {
      return NextResponse.json(
        {
          success: false,
          error: `Action must be one of: ${ACTION_VALUES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (semesterParam !== null && semester === null) {
      return NextResponse.json(
        { success: false, error: "Semester must be 1 or 2" },
        { status: 400 }
      );
    }

    if (!SORT_FIELD_VALUES.includes(sortBy as (typeof SORT_FIELD_VALUES)[number])) {
      return NextResponse.json(
        {
          success: false,
          error: `sortBy must be one of: ${SORT_FIELD_VALUES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const query: Record<string, unknown> = {
      isRevoked: false,
    };
    if (studentId) {
      query.studentId = new mongoose.Types.ObjectId(studentId);
    }
    if (category) {
      query.category = category;
    }
    if (action) {
      query.action = action;
    }
    if (academicYear) {
      query.academicYear = academicYear;
    }
    if (semester !== null) {
      query.semester = semester;
    }

    const total = await GamificationPointsModel.countDocuments(query).catch(() => 0);
    const rows = (await GamificationPointsModel.find(query)
      .populate({ path: "studentId", select: "studentId firstName lastName" })
      .populate({
        path: "moduleOfferingId",
        select: "moduleId intakeId termCode status degreeProgramId facultyId",
      })
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const points = rows.map((row) => toApiPoint(row)).filter(Boolean);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return NextResponse.json({
      success: true,
      data: {
        points,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: totalPages > 0 && page < totalPages,
          hasPrev: page > 1 && total > 0,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch points ledger",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        {
          success: false,
          error: "Gamification ledger management is unavailable in demo mode",
        },
        { status: 501 }
      );
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const studentId = collapseSpaces(body.studentId);
    const xpPoints = Number(body.xpPoints);
    const reason = collapseSpaces(body.reason);
    const awardedBy = collapseSpaces(body.awardedBy).toLowerCase();
    const metadata = body.metadata === undefined ? undefined : asObject(body.metadata);

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "studentId is required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(xpPoints) || xpPoints < -100 || xpPoints > 500) {
      return NextResponse.json(
        { success: false, error: "xpPoints must be between -100 and 500" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { success: false, error: "reason is required" },
        { status: 400 }
      );
    }

    if (awardedBy !== "admin" && awardedBy !== "lecturer") {
      return NextResponse.json(
        { success: false, error: "awardedBy must be admin or lecturer" },
        { status: 400 }
      );
    }

    if (body.metadata !== undefined && !metadata) {
      return NextResponse.json(
        { success: false, error: "metadata must be an object" },
        { status: 400 }
      );
    }

    const studentExists = Boolean(
      await StudentModel.exists({ _id: studentId }).catch(() => null)
    );
    if (!studentExists) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const awardResult = await awardCustomPoints(
      studentId,
      xpPoints,
      reason,
      awardedBy,
      metadata ?? undefined
    );

    if (!awardResult.success && awardResult.pointsAwarded.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: awardResult.errors[0] ?? "Failed to award custom points",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: awardResult,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to award custom points",
      },
      { status: 500 }
    );
  }
}
