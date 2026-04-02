import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Grade";
import "@/models/ModuleOffering";
import "@/models/Student";
import "@/models/User";
import { connectMongoose } from "@/lib/mongoose";
import { findModuleById } from "@/lib/module-store";
import { GradeModel } from "@/models/Grade";
import { ModuleOfferingModel } from "@/models/ModuleOffering";

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

function roundToOne(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function getTotalMarks(row: unknown) {
  return Number(asObject(row)?.totalMarks ?? 0);
}

function getGradePoint(row: unknown) {
  return Number(asObject(row)?.gradePoint ?? 0);
}

function getStudentRecordId(row: unknown) {
  return readId(asObject(row)?.studentId);
}

function getStudentRegistrationNumber(row: unknown) {
  const student = asObject(asObject(row)?.studentId);
  return collapseSpaces(student?.studentId).toUpperCase();
}

function getStudentNameFromRow(row: unknown) {
  return buildStudentName(asObject(row)?.studentId);
}

function getModuleMeta(row: unknown) {
  const offering = asObject(asObject(row)?.moduleOfferingId);

  return {
    moduleCode: collapseSpaces(offering?.moduleCode) || null,
    moduleName: collapseSpaces(offering?.moduleName) || null,
  };
}

function calculateMedian(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return roundToTwo(sorted[middle]);
  }

  return roundToTwo((sorted[middle - 1] + sorted[middle]) / 2);
}

function calculateStandardDeviation(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return roundToTwo(Math.sqrt(variance));
}

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        {
          success: false,
          error: "Class performance analytics are unavailable in demo mode",
        },
        { status: 501 }
      );
    }

    const { searchParams } = new URL(request.url);
    const moduleOfferingId = String(searchParams.get("moduleOfferingId") ?? "").trim();
    const academicYear = sanitizeAcademicYear(searchParams.get("academicYear"));
    const semesterParam = searchParams.get("semester");
    const semester =
      semesterParam === null ? null : sanitizeSemester(searchParams.get("semester"));

    if (!moduleOfferingId && !academicYear && semesterParam === null) {
      return NextResponse.json(
        {
          success: false,
          error:
            "At least one filter parameter is required (moduleOfferingId, academicYear, or semester)",
        },
        { status: 400 }
      );
    }

    if (moduleOfferingId && !mongoose.Types.ObjectId.isValid(moduleOfferingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid moduleOfferingId filter" },
        { status: 400 }
      );
    }

    if (semesterParam !== null && semester === null) {
      return NextResponse.json(
        { success: false, error: "Semester must be 1 or 2" },
        { status: 400 }
      );
    }

    const query: Record<string, unknown> = {};
    if (moduleOfferingId) {
      query.moduleOfferingId = moduleOfferingId;
    }
    if (academicYear) {
      query.academicYear = academicYear;
    }
    if (semester !== null) {
      query.semester = semester;
    }

    const filterOffering = moduleOfferingId
      ? await ModuleOfferingModel.findById(moduleOfferingId)
          .select("moduleId")
          .lean()
          .exec()
          .catch(() => null)
      : null;
    const filterOfferingRow = asObject(filterOffering);
    const filterModuleRecord = filterOfferingRow?.moduleId
      ? findModuleById(collapseSpaces(filterOfferingRow.moduleId))
      : null;

    const rows = (await GradeModel.find(query)
      .populate({ path: "studentId", select: "studentId firstName lastName" })
      .populate({
        path: "moduleOfferingId",
        select: "moduleId intakeId termCode status degreeProgramId facultyId",
      })
      .sort({ totalMarks: -1, createdAt: -1 })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const enrichedGrades = rows
      .map((row) => enrichGradeRow(row))
      .filter(Boolean) as Record<string, unknown>[];

    const marks = enrichedGrades.map((row) => getTotalMarks(row));
    const gradePoints = enrichedGrades.map((row) => getGradePoint(row));
    const totalStudents = new Set(
      enrichedGrades.map((row) => getStudentRecordId(row)).filter(Boolean)
    ).size;

    const gradeDistribution = {
      "A+": 0,
      A: 0,
      "A-": 0,
      "B+": 0,
      B: 0,
      "B-": 0,
      "C+": 0,
      C: 0,
      "C-": 0,
      "D+": 0,
      D: 0,
      F: 0,
    };
    const statusDistribution = {
      pass: 0,
      fail: 0,
      proRata: 0,
      repeat: 0,
    };

    enrichedGrades.forEach((row) => {
      const grade = collapseSpaces(row.gradeLetter) as keyof typeof gradeDistribution;
      const status = collapseSpaces(row.status);

      if (grade in gradeDistribution) {
        gradeDistribution[grade] += 1;
      }

      if (status === "pass") {
        statusDistribution.pass += 1;
      } else if (status === "fail") {
        statusDistribution.fail += 1;
      } else if (status === "pro-rata") {
        statusDistribution.proRata += 1;
      } else if (status === "repeat") {
        statusDistribution.repeat += 1;
      }
    });

    const topPerformers = [...enrichedGrades]
      .sort((left, right) => getTotalMarks(right) - getTotalMarks(left))
      .slice(0, 5)
      .map((row) => ({
        studentId: getStudentRecordId(row),
        studentName: getStudentNameFromRow(row),
        registrationNumber: getStudentRegistrationNumber(row),
        totalMarks: getTotalMarks(row),
        gradeLetter: collapseSpaces(row.gradeLetter),
        gradePoint: getGradePoint(row),
      }));

    const atRiskStudents = [...enrichedGrades]
      .filter((row) => collapseSpaces(row.status) !== "pass")
      .sort((left, right) => getTotalMarks(left) - getTotalMarks(right))
      .map((row) => ({
        studentId: getStudentRecordId(row),
        studentName: getStudentNameFromRow(row),
        registrationNumber: getStudentRegistrationNumber(row),
        totalMarks: getTotalMarks(row),
        gradeLetter: collapseSpaces(row.gradeLetter),
        status: collapseSpaces(row.status),
      }));

    const firstGradeMeta =
      enrichedGrades.length > 0 ? getModuleMeta(enrichedGrades[0]) : null;

    return NextResponse.json({
      success: true,
      data: {
        filters: {
          moduleOfferingId: moduleOfferingId || null,
          moduleName:
            collapseSpaces(filterModuleRecord?.name) ||
            firstGradeMeta?.moduleName ||
            null,
          moduleCode:
            collapseSpaces(filterModuleRecord?.code) ||
            firstGradeMeta?.moduleCode ||
            null,
          academicYear: academicYear || null,
          semester,
        },
        classStatistics: {
          totalStudents,
          classAverage:
            marks.length > 0
              ? roundToTwo(marks.reduce((sum, mark) => sum + mark, 0) / marks.length)
              : 0,
          classHighest: marks.length > 0 ? roundToTwo(Math.max(...marks)) : 0,
          classLowest: marks.length > 0 ? roundToTwo(Math.min(...marks)) : 0,
          classMedian: calculateMedian(marks),
          classAverageGPA:
            gradePoints.length > 0
              ? roundToTwo(
                  gradePoints.reduce((sum, point) => sum + point, 0) /
                    gradePoints.length
                )
              : 0,
          standardDeviation: calculateStandardDeviation(marks),
        },
        gradeDistribution,
        statusDistribution,
        passRate:
          enrichedGrades.length > 0
            ? roundToOne((statusDistribution.pass / enrichedGrades.length) * 100)
            : 0,
        topPerformers,
        atRiskStudents,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
