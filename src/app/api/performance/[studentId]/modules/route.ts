import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Grade";
import "@/models/ModuleOffering";
import "@/models/Student";
import "@/models/User";
import { connectMongoose } from "@/lib/mongoose";
import { findModuleById } from "@/lib/module-store";
import { getProRataEligibility } from "@/lib/risk-detection-utils";
import { GradeModel } from "@/models/Grade";
import { StudentModel } from "@/models/Student";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function sanitizeAcademicYear(value: unknown) {
  return collapseSpaces(value).slice(0, 32);
}

function sanitizeSemester(value: unknown): 1 | 2 | null {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2) {
    return parsed;
  }

  return null;
}

function sanitizeStatus(value: string | null) {
  if (
    value === "pass" ||
    value === "fail" ||
    value === "pro-rata" ||
    value === "repeat"
  ) {
    return value;
  }

  return "";
}

function buildStudentName(student: unknown) {
  const row = asObject(student);
  const firstName = collapseSpaces(row?.firstName);
  const lastName = collapseSpaces(row?.lastName);
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function enrichGradeRow(row: unknown) {
  const grade = asObject(row);
  if (!grade) {
    return null;
  }

  const offering = asObject(grade.moduleOfferingId);
  const moduleId = collapseSpaces(offering?.moduleId);
  const moduleRecord = moduleId ? findModuleById(moduleId) : null;

  return {
    ...grade,
    moduleOfferingId: offering
      ? {
          ...offering,
          _id: readId(offering._id ?? offering.id) || null,
          id: readId(offering._id ?? offering.id) || null,
          moduleId,
          moduleCode:
            collapseSpaces(offering.moduleCode) || collapseSpaces(moduleRecord?.code),
          moduleName:
            collapseSpaces(offering.moduleName) || collapseSpaces(moduleRecord?.name),
          credits: Number(moduleRecord?.credits ?? 0) || undefined,
        }
      : grade.moduleOfferingId,
  };
}

function parseAcademicYearStart(value: string) {
  const match = collapseSpaces(value).match(/^(\d{4})/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function comparePeriodsDescending(
  left: { academicYear: string; semester: number; moduleCode: string },
  right: { academicYear: string; semester: number; moduleCode: string }
) {
  const leftYear = parseAcademicYearStart(left.academicYear);
  const rightYear = parseAcademicYearStart(right.academicYear);

  if (leftYear !== null && rightYear !== null && leftYear !== rightYear) {
    return rightYear - leftYear;
  }

  const yearCompare = right.academicYear.localeCompare(left.academicYear);
  if (yearCompare !== 0) {
    return yearCompare;
  }

  if (left.semester !== right.semester) {
    return right.semester - left.semester;
  }

  return left.moduleCode.localeCompare(right.moduleCode);
}

export async function GET(
  request: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const studentId = String(params.studentId ?? "").trim();
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    const student = await StudentModel.findById(studentId)
      .lean()
      .exec()
      .catch(() => null);
    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const academicYear = sanitizeAcademicYear(searchParams.get("academicYear"));
    const semesterParam = searchParams.get("semester");
    const semester =
      semesterParam === null ? null : sanitizeSemester(searchParams.get("semester"));
    const statusParam = searchParams.get("status");
    const status =
      statusParam === null ? "" : sanitizeStatus(searchParams.get("status"));

    if (semesterParam !== null && semester === null) {
      return NextResponse.json(
        { success: false, error: "Semester must be 1 or 2" },
        { status: 400 }
      );
    }

    if (statusParam !== null && !status) {
      return NextResponse.json(
        {
          success: false,
          error: "Status must be one of: pass, fail, pro-rata, repeat",
        },
        { status: 400 }
      );
    }

    const query: Record<string, unknown> = { studentId };
    if (academicYear) {
      query.academicYear = academicYear;
    }
    if (semester !== null) {
      query.semester = semester;
    }
    if (status) {
      query.status = status;
    }

    const rows = (await GradeModel.find(query)
      .populate({
        path: "moduleOfferingId",
        select: "moduleId intakeId termCode status degreeProgramId facultyId",
      })
      .populate({ path: "gradedBy", select: "username email role" })
      .sort({ academicYear: -1, semester: -1, createdAt: -1 })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const enrichedGrades = rows
      .map((row) => enrichGradeRow(row))
      .filter(Boolean) as Record<string, unknown>[];
    const studentRow = asObject(student);

    const modules = enrichedGrades
      .map((grade) => {
        const offering = asObject(grade.moduleOfferingId);
        const gradedBy = asObject(grade.gradedBy);
        const eligibility = getProRataEligibility(
          Number(grade.caMarks ?? 0),
          Number(grade.finalExamMarks ?? 0)
        );

        return {
          gradeId: readId(grade._id ?? grade.id),
          moduleCode: collapseSpaces(offering?.moduleCode) || "N/A",
          moduleName:
            collapseSpaces(offering?.moduleName) || readId(grade.moduleOfferingId),
          academicYear: collapseSpaces(grade.academicYear),
          semester: Number(grade.semester ?? 0),
          caMarks: Number(grade.caMarks ?? 0),
          finalExamMarks: Number(grade.finalExamMarks ?? 0),
          totalMarks: Number(grade.totalMarks ?? 0),
          gradeLetter: collapseSpaces(grade.gradeLetter),
          gradePoint: Number(grade.gradePoint ?? 0),
          status: collapseSpaces(grade.status),
          eligibility: {
            isProRata: eligibility.isProRata,
            isRepeat: eligibility.isRepeat,
            isPass: eligibility.isPass,
            explanation: eligibility.explanation,
            caStatus: eligibility.caStatus,
            finalStatus: eligibility.finalStatus,
            caDeficit: eligibility.caDeficit,
            finalDeficit: eligibility.finalDeficit,
          },
          gradedBy:
            collapseSpaces(
              gradedBy?.fullName ?? gradedBy?.name ?? gradedBy?.username
            ) || null,
          gradedAt: toIsoDate(grade.gradedAt),
        };
      })
      .sort(comparePeriodsDescending);

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: readId(studentRow?._id ?? studentRow?.id),
          name: buildStudentName(student),
          registrationNumber: collapseSpaces(studentRow?.studentId),
        },
        totalModules: modules.length,
        modules,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
