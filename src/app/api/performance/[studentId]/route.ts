import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/Grade";
import "@/models/ModuleOffering";
import "@/models/Student";
import "@/models/User";
import {
  buildDemoPerformancePayload,
  hasDemoStudent,
} from "@/lib/demo-student-analytics";
import { connectMongoose } from "@/lib/mongoose";
import { findModuleByCode, findModuleById } from "@/lib/module-store";
import {
  calculateCumulativeGPA,
  getGPAClassification,
  getProgressOverview,
  getSemesterSummary,
} from "@/lib/performance-utils";
import {
  generateRiskReport,
  type AcademicStanding,
  type FullRiskReport,
} from "@/lib/risk-detection-utils";
import { findDegreeProgram } from "@/models/degree-program-store";
import { EnrollmentModel } from "@/models/Enrollment";
import type { IGrade } from "@/models/Grade";
import { GradeModel } from "@/models/Grade";
import { ModuleModel } from "@/models/Module";
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

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
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

function parseAcademicYearStart(value: string) {
  const match = collapseSpaces(value).match(/^(\d{4})/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareAcademicPeriods(
  left: { academicYear: string; semester: number },
  right: { academicYear: string; semester: number }
) {
  const leftYear = parseAcademicYearStart(left.academicYear);
  const rightYear = parseAcademicYearStart(right.academicYear);

  if (leftYear !== null && rightYear !== null && leftYear !== rightYear) {
    return leftYear - rightYear;
  }

  const yearCompare = left.academicYear.localeCompare(right.academicYear);
  if (yearCompare !== 0) {
    return yearCompare;
  }

  return left.semester - right.semester;
}

function buildStudentName(student: unknown) {
  const row = asObject(student);
  const firstName = collapseSpaces(row?.firstName);
  const lastName = collapseSpaces(row?.lastName);
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function resolveDegreeProgramIdFromGrades(rows: unknown[]) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const grade = asObject(rows[index]);
    const offering = asObject(grade?.moduleOfferingId);
    const degreeProgramId = collapseSpaces(offering?.degreeProgramId);
    if (degreeProgramId) {
      return degreeProgramId;
    }
  }

  return "";
}

async function getTotalRequiredCredits(studentId: string, gradeRows: unknown[]) {
  const enrollment = await EnrollmentModel.findOne({ studentId })
    .sort({ updatedAt: -1 })
    .select("degreeProgramId")
    .lean()
    .exec()
    .catch(() => null);
  const enrollmentRow = asObject(enrollment);
  const degreeProgramId =
    collapseSpaces(enrollmentRow?.degreeProgramId) || resolveDegreeProgramIdFromGrades(gradeRows);
  if (!degreeProgramId) {
    return 0;
  }

  return Number(findDegreeProgram(degreeProgramId)?.credits ?? 0) || 0;
}

const moduleMetaCache = new Map<
  string,
  Promise<
    | {
        id: string;
        code: string;
        name: string;
        credits: number;
      }
    | null
  >
>();

async function resolveModuleMeta(moduleId: string, moduleCode: string) {
  const normalizedModuleId = collapseSpaces(moduleId);
  const normalizedModuleCode = normalizeModuleCode(moduleCode);
  const cacheKey = `${normalizedModuleId}::${normalizedModuleCode}`;
  const cached = moduleMetaCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    if (normalizedModuleId && mongoose.Types.ObjectId.isValid(normalizedModuleId)) {
      const row = asObject(
        await ModuleModel.findById(normalizedModuleId)
          .select("code name credits")
          .lean()
          .exec()
          .catch(() => null)
      );
      const dbCode = normalizeModuleCode(row?.code);
      const dbName = collapseSpaces(row?.name);
      const dbCredits = Number(row?.credits ?? 0) || 0;
      if (dbCode || dbName || dbCredits) {
        return {
          id: readId(row?._id) || normalizedModuleId,
          code: dbCode,
          name: dbName,
          credits: dbCredits,
        };
      }
    }

    if (normalizedModuleCode) {
      const row = asObject(
        await ModuleModel.findOne({ code: normalizedModuleCode })
          .select("code name credits")
          .lean()
          .exec()
          .catch(() => null)
      );
      const dbCode = normalizeModuleCode(row?.code);
      const dbName = collapseSpaces(row?.name);
      const dbCredits = Number(row?.credits ?? 0) || 0;
      if (dbCode || dbName || dbCredits) {
        return {
          id: readId(row?._id) || normalizedModuleId,
          code: dbCode,
          name: dbName,
          credits: dbCredits,
        };
      }
    }

    const storeModule =
      findModuleByCode(normalizedModuleCode) ?? findModuleById(normalizedModuleId);
    if (!storeModule) {
      return null;
    }

    return {
      id: collapseSpaces(storeModule.id),
      code: collapseSpaces(storeModule.code),
      name: collapseSpaces(storeModule.name),
      credits: Number(storeModule.credits ?? 0) || 0,
    };
  })();

  moduleMetaCache.set(cacheKey, pending);
  return pending;
}

async function enrichGradeRow(row: unknown) {
  const grade = asObject(row);
  if (!grade) {
    return null;
  }

  const offering = asObject(grade.moduleOfferingId);
  const moduleId = collapseSpaces(offering?.moduleId);
  const moduleCode = normalizeModuleCode(offering?.moduleCode);
  const moduleRecord = await resolveModuleMeta(moduleId, moduleCode);

  return {
    ...grade,
    moduleOfferingId: offering
      ? {
          ...offering,
          _id: readId(offering._id ?? offering.id) || null,
          id: readId(offering._id ?? offering.id) || null,
          moduleId,
          moduleCode: moduleCode || collapseSpaces(moduleRecord?.code),
          moduleName:
            collapseSpaces(offering.moduleName) || collapseSpaces(moduleRecord?.name),
          credits: Number(offering.credits ?? moduleRecord?.credits ?? 0) || undefined,
          module: moduleRecord ? { ...moduleRecord } : null,
        }
      : grade.moduleOfferingId,
  };
}

function getModuleMeta(row: unknown) {
  const grade = asObject(row);
  const offering = asObject(grade?.moduleOfferingId);
  const nestedModule = asObject(offering?.module);

  return {
    moduleCode: collapseSpaces(offering?.moduleCode) || "N/A",
    moduleName: collapseSpaces(offering?.moduleName) || readId(grade?.moduleOfferingId),
    credits: Number(offering?.credits ?? nestedModule?.credits ?? 0) || 0,
  };
}

function getSemesterModuleItem(row: unknown) {
  const grade = asObject(row);
  const gradedBy = asObject(grade?.gradedBy);
  const gradeId = readId(grade?._id ?? grade?.id);
  const moduleMeta = getModuleMeta(row);
  const gradedByName =
    collapseSpaces(gradedBy?.fullName ?? gradedBy?.name ?? gradedBy?.username) || null;

  return {
    gradeId,
    moduleCode: moduleMeta.moduleCode,
    moduleName: moduleMeta.moduleName,
    caMarks: Number(grade?.caMarks ?? 0),
    finalExamMarks: Number(grade?.finalExamMarks ?? 0),
    totalMarks: Number(grade?.totalMarks ?? 0),
    gradeLetter: collapseSpaces(grade?.gradeLetter),
    gradePoint: Number(grade?.gradePoint ?? 0),
    status: collapseSpaces(grade?.status),
    gradedBy: gradedByName,
    gradedAt: toIsoDate(grade?.gradedAt),
  };
}

function buildNeutralStanding(): AcademicStanding {
  return {
    standing: "No Grades Yet",
    level: "satisfactory",
    color: "blue",
    message: "No graded modules are available for this student yet.",
    recommendations: [
      "Performance insights will appear once grades are recorded",
    ],
  };
}

function buildNeutralRiskReport(): Pick<
  FullRiskReport,
  "overallRiskLevel" | "summary" | "semesterRiskHistory"
> {
  return {
    overallRiskLevel: "none",
    summary: "No performance data is available for this student yet.",
    semesterRiskHistory: [],
  };
}

function buildEmptyAtRiskModules() {
  return {
    proRataModules: [] as Array<{
      gradeId: string;
      moduleCode: string;
      moduleName: string;
      caMarks: number;
      finalExamMarks: number;
      totalMarks: number;
      academicYear: string;
      semester: number;
      action: string;
    }>,
    repeatModules: [] as Array<{
      gradeId: string;
      moduleCode: string;
      moduleName: string;
      caMarks: number;
      finalExamMarks: number;
      totalMarks: number;
      academicYear: string;
      semester: number;
      action: string;
    }>,
    failedModules: [] as Array<{
      gradeId: string;
      moduleCode: string;
      moduleName: string;
      caMarks: number;
      finalExamMarks: number;
      totalMarks: number;
      academicYear: string;
      semester: number;
      action: string;
    }>,
    totalAtRisk: 0,
    hasAnyRisk: false,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    const studentId = String(params.studentId ?? "").trim();
    if (mongooseConnection && !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      const demoPayload = buildDemoPerformancePayload(studentId);
      if (!demoPayload || !hasDemoStudent(studentId)) {
        return NextResponse.json(
          { success: false, error: "Student not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: demoPayload,
      });
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

    const rows = (await GradeModel.find({ studentId })
      .populate({
        path: "moduleOfferingId",
        select:
          "moduleId moduleCode moduleName intakeId termCode status degreeProgramId facultyId",
      })
      .populate({ path: "gradedBy", select: "username email role" })
      .sort({ academicYear: 1, semester: 1, createdAt: 1 })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    // Utilities accept IGrade[] and are resilient to populated objects. We enrich
    // the populated grade rows once with module metadata and reuse that same set for
    // both calculations and response assembly to avoid a second query.
    const enrichedGrades = (await Promise.all(rows.map((row) => enrichGradeRow(row))))
      .filter(Boolean) as Record<string, unknown>[];
    const gradeRecords = enrichedGrades as unknown as IGrade[];
    const totalRequiredCredits = await getTotalRequiredCredits(studentId, rows);

    const studentRow = asObject(student);
    const progressOverview = getProgressOverview(gradeRecords, totalRequiredCredits);
    const cumulativeGPA = calculateCumulativeGPA(gradeRecords);
    const generatedRiskReport =
      gradeRecords.length > 0
        ? generateRiskReport(gradeRecords, cumulativeGPA)
        : null;

    const semesterGroups = new Map<
      string,
      {
        academicYear: string;
        semester: number;
        grades: Record<string, unknown>[];
      }
    >();

    enrichedGrades.forEach((grade) => {
      const academicYear = collapseSpaces(grade.academicYear);
      const semester = Number(grade.semester ?? 0);
      const key = `${academicYear}::${semester}`;
      const bucket = semesterGroups.get(key) ?? {
        academicYear,
        semester,
        grades: [],
      };

      bucket.grades.push(grade);
      semesterGroups.set(key, bucket);
    });

    const semesterBreakdown = Array.from(semesterGroups.values())
      .sort(compareAcademicPeriods)
      .map((group) => {
        const groupGrades = group.grades as unknown as IGrade[];
        const summary = getSemesterSummary(groupGrades);
        const modules = group.grades
          .map((grade) => getSemesterModuleItem(grade))
          .sort((left, right) => {
            const codeCompare = left.moduleCode.localeCompare(right.moduleCode);
            if (codeCompare !== 0) {
              return codeCompare;
            }

            return left.moduleName.localeCompare(right.moduleName);
          });

        return {
          academicYear: group.academicYear,
          semester: group.semester,
          semesterGPA: summary.semesterGPA,
          modules,
          summary: {
            totalModules: summary.totalModules,
            passCount: summary.passCount,
            failCount: summary.failCount,
            proRataCount: summary.proRataCount,
            repeatCount: summary.repeatCount,
            averageMarks: summary.averageMarks,
            highestMarks: summary.highestMarks,
            lowestMarks: summary.lowestMarks,
          },
        };
      });

    const atRiskModules = generatedRiskReport
      ? {
          proRataModules: generatedRiskReport.atRiskModules.proRataModules.map((module) => ({
            gradeId: module.gradeId,
            moduleCode: module.moduleCode,
            moduleName: module.moduleName,
            caMarks: module.caMarks,
            finalExamMarks: module.finalExamMarks,
            totalMarks: module.totalMarks,
            academicYear: module.academicYear,
            semester: module.semester,
            action: module.action,
          })),
          repeatModules: generatedRiskReport.atRiskModules.repeatModules.map((module) => ({
            gradeId: module.gradeId,
            moduleCode: module.moduleCode,
            moduleName: module.moduleName,
            caMarks: module.caMarks,
            finalExamMarks: module.finalExamMarks,
            totalMarks: module.totalMarks,
            academicYear: module.academicYear,
            semester: module.semester,
            action: module.action,
          })),
          failedModules: generatedRiskReport.atRiskModules.failedModules.map((module) => ({
            gradeId: module.gradeId,
            moduleCode: module.moduleCode,
            moduleName: module.moduleName,
            caMarks: module.caMarks,
            finalExamMarks: module.finalExamMarks,
            totalMarks: module.totalMarks,
            academicYear: module.academicYear,
            semester: module.semester,
            action: module.action,
          })),
          totalAtRisk: generatedRiskReport.atRiskModules.totalAtRisk,
          hasAnyRisk: generatedRiskReport.atRiskModules.hasAnyRisk,
        }
      : buildEmptyAtRiskModules();

    const academicStanding = generatedRiskReport
      ? generatedRiskReport.academicStanding
      : buildNeutralStanding();
    const riskReport = generatedRiskReport
      ? {
          overallRiskLevel: generatedRiskReport.overallRiskLevel,
          summary: generatedRiskReport.summary,
          semesterRiskHistory: generatedRiskReport.semesterRiskHistory,
        }
      : buildNeutralRiskReport();

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: readId(studentRow?._id ?? studentRow?.id),
          name: buildStudentName(student),
          registrationNumber: collapseSpaces(studentRow?.studentId),
          firstName: collapseSpaces(studentRow?.firstName),
          lastName: collapseSpaces(studentRow?.lastName),
          email: collapseSpaces(studentRow?.email).toLowerCase(),
          phone: collapseSpaces(studentRow?.phone),
          status: collapseSpaces(studentRow?.status).toUpperCase(),
        },
        overview: {
          cumulativeGPA,
          classification: getGPAClassification(cumulativeGPA),
          academicStanding,
          totalModulesTaken: progressOverview.totalModulesTaken,
          totalModulesPassed: progressOverview.totalModulesPassed,
          totalModulesFailed: progressOverview.totalModulesFailed,
          totalProRata: progressOverview.totalProRata,
          totalRepeat: progressOverview.totalRepeat,
          totalCreditsCompleted: progressOverview.totalCreditsCompleted,
          totalCreditsRequired: progressOverview.totalCreditsRequired,
          progressPercentage: progressOverview.progressPercentage,
          trend: progressOverview.trend,
        },
        semesterBreakdown,
        atRiskModules,
        riskReport,
        semesterWiseGPA: progressOverview.semesterWiseGPA.map((item) => ({
          academicYear: item.academicYear,
          semester: item.semester,
          gpa: item.gpa,
          label: `${item.academicYear} S${item.semester}`,
        })),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
