import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import {
  listGradesInMemory,
  type GradePersistedRecord,
} from "@/lib/grade-store";
import { findIntakeById } from "@/lib/intake-store";
import {
  getCurrentLevel,
  getLevelBadge,
  getLevelComparison,
  getLevelProgress,
  getNextLevel,
} from "@/lib/level-utils";
import { TROPHY_DEFINITIONS } from "@/lib/milestone-checker";
import { findModuleOfferingById } from "@/lib/module-offering-store";
import { findModuleByCode, findModuleById } from "@/lib/module-store";
import {
  calculateCumulativeGPA,
  calculateSemesterGPA,
  getGPAClassification,
  getProgressOverview,
  getSemesterSummary,
} from "@/lib/performance-utils";
import { XP_VALUES } from "@/lib/points-engine";
import {
  generateRiskReport,
  getProRataEligibility,
  type AcademicStanding,
  type FullRiskReport,
} from "@/lib/risk-detection-utils";
import {
  findStudentDetailInMemoryById,
  findStudentInMemoryById,
  listEnrollmentRecordsInMemory,
  listStudentsInMemory,
} from "@/lib/student-registration";
import type { IGrade } from "@/models/Grade";

export type DemoLeaderboardScope =
  | "campus"
  | "faculty"
  | "degree"
  | "intake"
  | "module";

export interface DemoLeaderboardBuildOptions {
  scope: DemoLeaderboardScope;
  facultyId?: string;
  degreeProgramId?: string;
  intakeId?: string;
  moduleOfferingId?: string;
}

export interface DemoLeaderboardEntry {
  rank: number;
  student: {
    id: string;
    name: string;
    registrationNumber: string;
    faculty?: string;
    degreeProgram?: string;
    intake?: string;
  };
  totalXP: number;
  level: {
    number: number;
    name: string;
    title: string;
    icon: string;
    color: string;
  };
  topTrophy: {
    key: string;
    name: string;
    icon: string;
    tier: string;
  } | null;
  xpChange: {
    last7Days: number;
    last30Days: number;
  };
}

export interface DemoLeaderboardBuildResult {
  scope: DemoLeaderboardScope;
  scopeName: string | null;
  totalStudents: number;
  activeParticipants: number;
  entries: DemoLeaderboardEntry[];
}

interface DemoActivity {
  action: string;
  xpPoints: number;
  reason: string;
  category: string;
  createdAt: Date;
  academicYear?: string;
  semester?: 1 | 2;
  moduleOfferingId?: string;
  metadata: Record<string, unknown>;
}

interface DemoTrophy {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  category: string;
  xpBonusAwarded: number;
  earnedAt: Date;
  metadata: Record<string, unknown> | null;
}

export interface DemoGamificationSnapshot {
  studentId: string;
  totalXP: number;
  categoryBreakdown: Array<{
    category: string;
    totalXP: number;
    count: number;
  }>;
  recentActivity: Array<{
    action: string;
    xpPoints: number;
    reason: string;
    category: string;
    createdAt: Date;
    metadata: Record<string, unknown>;
  }>;
  activityCount: number;
  pointsThisMonth: number;
  pointsThisSemester: number;
  averagePointsPerModule: number;
  xpChange: {
    last7Days: number;
    last30Days: number;
  };
  level: {
    current: ReturnType<typeof getCurrentLevel>;
    next: ReturnType<typeof getNextLevel>;
    progress: ReturnType<typeof getLevelProgress>;
    badge: ReturnType<typeof getLevelBadge>;
    comparison: ReturnType<typeof getLevelComparison>;
    totalXP: number;
  };
  trophies: {
    totalAvailable: number;
    totalEarned: number;
    earnedPercentage: number;
    items: Array<{
      definition: (typeof TROPHY_DEFINITIONS)[number];
      earned: boolean;
      earnedAt: Date | null;
      metadata: Record<string, unknown> | null;
    }>;
    byTier: {
      bronze: { total: number; earned: number };
      silver: { total: number; earned: number };
      gold: { total: number; earned: number };
      platinum: { total: number; earned: number };
      diamond: { total: number; earned: number };
    };
    byCategory: Record<string, { total: number; earned: number }>;
    recentlyEarned: DemoTrophy[];
  };
  topTrophy: {
    key: string;
    name: string;
    icon: string;
    tier: string;
  } | null;
}

const TROPHY_TIER_ORDER: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
};

const globalForDemoGamification = globalThis as typeof globalThis & {
  __demoSeenTrophies?: Map<string, Set<string>>;
};

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

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 12);
}

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function compareAcademicPeriodsDescending(
  left: { academicYear: string; semester: number; moduleCode?: string },
  right: { academicYear: string; semester: number; moduleCode?: string }
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

  return String(left.moduleCode ?? "").localeCompare(String(right.moduleCode ?? ""));
}

function buildSemesterKey(academicYear: string, semester: number) {
  return `${collapseSpaces(academicYear)}::${semester}`;
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

function buildStudentName(student: unknown) {
  const row = asObject(student);
  const firstName = collapseSpaces(row?.firstName);
  const lastName = collapseSpaces(row?.lastName);

  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function groupGradesBySemester(grades: IGrade[]) {
  const groups = new Map<string, IGrade[]>();

  grades.forEach((grade) => {
    const key = buildSemesterKey(
      collapseSpaces(grade.academicYear),
      Number(grade.semester) === 2 ? 2 : 1
    );
    const current = groups.get(key) ?? [];
    current.push(grade);
    groups.set(key, current);
  });

  return groups;
}

function getPreviousAcademicPeriod(academicYear: string, semester: 1 | 2) {
  if (semester === 2) {
    return { academicYear, semester: 1 as const };
  }

  const startYear = parseAcademicYearStart(academicYear);
  if (startYear === null) {
    return null;
  }

  return {
    academicYear: `${startYear - 1}/${startYear}`,
    semester: 2 as const,
  };
}

function isGoodSemester(grades: IGrade[]) {
  return (
    grades.length > 0 &&
    calculateSemesterGPA(grades) >= 3.0 &&
    grades.every((grade) => grade.status === "pass")
  );
}

function calculateStreakLength(
  semesterGroups: Map<string, IGrade[]>,
  academicYear: string,
  semester: 1 | 2
) {
  let streakLength = 0;
  let currentAcademicYear = academicYear;
  let currentSemester: 1 | 2 | null = semester;

  while (currentSemester !== null) {
    const grades = semesterGroups.get(buildSemesterKey(currentAcademicYear, currentSemester));
    if (!grades || !isGoodSemester(grades)) {
      break;
    }

    streakLength += 1;
    const previous = getPreviousAcademicPeriod(currentAcademicYear, currentSemester);
    currentAcademicYear = previous?.academicYear ?? "";
    currentSemester = previous?.semester ?? null;
  }

  return streakLength;
}

function getGradeTimestamp(grade: IGrade | null | undefined) {
  const row = grade as unknown as Record<string, unknown> | null;
  const candidates = [row?.gradedAt, row?.updatedAt, row?.createdAt];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const parsed = candidate instanceof Date ? candidate : new Date(String(candidate));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date(0);
}

function findCompletedSemesterItems(grades: IGrade[]) {
  return Array.from(groupGradesBySemester(grades).entries())
    .map(([key, semesterGrades]) => {
      const [academicYear, semesterRaw] = key.split("::");
      const semester = Number(semesterRaw) === 2 ? 2 : 1;
      const latestGrade = [...semesterGrades].sort(
        (left, right) =>
          getGradeTimestamp(right).getTime() - getGradeTimestamp(left).getTime()
      )[0];

      return {
        academicYear,
        semester: semester as 1 | 2,
        grades: semesterGrades,
        gpa: calculateSemesterGPA(semesterGrades),
        allPassed: semesterGrades.every((grade) => grade.status === "pass"),
        hasHighScore: semesterGrades.some(
          (grade) => Number(grade.totalMarks ?? 0) >= 80
        ),
        latestAt: getGradeTimestamp(latestGrade),
      };
    })
    .sort(compareAcademicPeriods);
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

function enrichGradeRecord(record: GradePersistedRecord) {
  const offering = findModuleOfferingById(record.moduleOfferingId);
  const moduleRecord =
    findModuleById(offering?.moduleId ?? "") ??
    findModuleByCode(offering?.moduleCode ?? "");

  return {
    _id: record.id,
    id: record.id,
    studentId: record.studentId,
    moduleOfferingId: offering
      ? {
          _id: offering.id,
          id: offering.id,
          moduleId: offering.moduleId,
          moduleCode: collapseSpaces(offering.moduleCode || moduleRecord?.code),
          moduleName: collapseSpaces(offering.moduleName || moduleRecord?.name),
          intakeId: collapseSpaces(offering.intakeId),
          termCode: collapseSpaces(offering.termCode),
          status: collapseSpaces(offering.status),
          degreeProgramId: collapseSpaces(offering.degreeProgramId),
          facultyId: collapseSpaces(offering.facultyId),
          credits: Number(moduleRecord?.credits ?? 0) || undefined,
          module: moduleRecord
            ? {
                id: collapseSpaces(moduleRecord.id),
                code: collapseSpaces(moduleRecord.code),
                name: collapseSpaces(moduleRecord.name),
                credits: Number(moduleRecord.credits ?? 0) || undefined,
              }
            : null,
        }
      : {
          _id: record.moduleOfferingId,
          id: record.moduleOfferingId,
          moduleId: "",
          moduleCode: "",
          moduleName: "",
          intakeId: "",
          termCode: "",
          status: "",
          degreeProgramId: "",
          facultyId: "",
        },
    caMarks: Number(record.caMarks ?? 0),
    finalExamMarks: Number(record.finalExamMarks ?? 0),
    totalMarks: Number(record.totalMarks ?? 0),
    gradeLetter: collapseSpaces(record.gradeLetter),
    gradePoint: Number(record.gradePoint ?? 0),
    status: collapseSpaces(record.status),
    academicYear: collapseSpaces(record.academicYear),
    semester: Number(record.semester) === 2 ? 2 : 1,
    gradedBy: record.gradedBy
      ? {
          _id: record.gradedBy,
          id: record.gradedBy,
          username: collapseSpaces(record.gradedBy),
          name: collapseSpaces(record.gradedBy),
          email: "",
          role: "LECTURER",
        }
      : null,
    gradedAt: record.gradedAt,
    remarks: collapseSpaces(record.remarks),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function getDemoEnrichedGrades(studentId: string) {
  return listGradesInMemory({ studentId })
    .map((grade) => enrichGradeRecord(grade))
    .sort((left, right) => {
      const periodCompare = compareAcademicPeriods(
        {
          academicYear: collapseSpaces(left.academicYear),
          semester: Number(left.semester) === 2 ? 2 : 1,
        },
        {
          academicYear: collapseSpaces(right.academicYear),
          semester: Number(right.semester) === 2 ? 2 : 1,
        }
      );
      if (periodCompare !== 0) {
        return periodCompare;
      }

      return (
        getGradeTimestamp(left as unknown as IGrade).getTime() -
        getGradeTimestamp(right as unknown as IGrade).getTime()
      );
    }) as unknown as IGrade[];
}

function getModuleMeta(row: unknown) {
  const grade = asObject(row);
  const offering = asObject(grade?.moduleOfferingId);
  const nestedModule = asObject(offering?.module);

  return {
    moduleCode: collapseSpaces(offering?.moduleCode) || "N/A",
    moduleName:
      collapseSpaces(offering?.moduleName) ||
      collapseSpaces(nestedModule?.name) ||
      readId(grade?.moduleOfferingId),
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

function resolveTotalRequiredCredits(studentId: string, grades: IGrade[]) {
  const detail = findStudentDetailInMemoryById(studentId);
  const latestEnrollment = detail?.latestEnrollment ?? null;
  const latestDegreeCredits = Number(
    findDegreeProgram(latestEnrollment?.degreeProgramId ?? "")?.credits ?? 0
  );

  if (latestDegreeCredits > 0) {
    return latestDegreeCredits;
  }

  for (let index = grades.length - 1; index >= 0; index -= 1) {
    const offering = asObject(
      asObject(grades[index] as unknown as Record<string, unknown>)?.moduleOfferingId
    );
    const degreeCredits = Number(
      findDegreeProgram(collapseSpaces(offering?.degreeProgramId))?.credits ?? 0
    );
    if (degreeCredits > 0) {
      return degreeCredits;
    }
  }

  return 0;
}

export function hasDemoStudent(studentId: string) {
  return Boolean(findStudentInMemoryById(studentId));
}

export function buildDemoPerformancePayload(studentId: string) {
  const student = findStudentInMemoryById(studentId);
  if (!student) {
    return null;
  }

  const grades = getDemoEnrichedGrades(studentId);
  const totalRequiredCredits = resolveTotalRequiredCredits(studentId, grades);
  const progressOverview = getProgressOverview(grades, totalRequiredCredits);
  const cumulativeGPA = calculateCumulativeGPA(grades);
  const generatedRiskReport =
    grades.length > 0 ? generateRiskReport(grades, cumulativeGPA) : null;

  const semesterGroups = new Map<
    string,
    {
      academicYear: string;
      semester: number;
      grades: IGrade[];
    }
  >();

  grades.forEach((grade) => {
    const academicYear = collapseSpaces(grade.academicYear);
    const semester = Number(grade.semester ?? 0);
    const key = buildSemesterKey(academicYear, semester);
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
      const summary = getSemesterSummary(group.grades);
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

  return {
    student: {
      id: student.id,
      name: buildStudentName(student),
      registrationNumber: collapseSpaces(student.studentId),
      firstName: collapseSpaces(student.firstName),
      lastName: collapseSpaces(student.lastName),
      email: collapseSpaces(student.email).toLowerCase(),
      phone: collapseSpaces(student.phone),
      status: collapseSpaces(student.status).toUpperCase(),
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
  };
}

export function buildDemoPerformanceModulesPayload(
  studentId: string,
  filters?: {
    academicYear?: string;
    semester?: 1 | 2 | null;
    status?: "" | "pass" | "fail" | "pro-rata" | "repeat";
  }
) {
  const student = findStudentInMemoryById(studentId);
  if (!student) {
    return null;
  }

  const academicYear = collapseSpaces(filters?.academicYear);
  const semester = filters?.semester ?? null;
  const status = collapseSpaces(filters?.status);

  const modules = getDemoEnrichedGrades(studentId)
    .filter((grade) => (academicYear ? collapseSpaces(grade.academicYear) === academicYear : true))
    .filter((grade) => (semester !== null ? Number(grade.semester) === semester : true))
    .filter((grade) => (status ? collapseSpaces(grade.status) === status : true))
    .map((grade) => {
      const offering = asObject(
        asObject(grade as unknown as Record<string, unknown>)?.moduleOfferingId
      );
      const eligibility = getProRataEligibility(
        Number(grade.caMarks ?? 0),
        Number(grade.finalExamMarks ?? 0)
      );

      return {
        gradeId: readId((grade as unknown as Record<string, unknown>)?._id),
        moduleCode: collapseSpaces(offering?.moduleCode) || "N/A",
        moduleName:
          collapseSpaces(offering?.moduleName) ||
          readId((grade as unknown as Record<string, unknown>)?.moduleOfferingId),
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
            asObject((grade as unknown as Record<string, unknown>)?.gradedBy)?.name
          ) || null,
        gradedAt: toIsoDate((grade as unknown as Record<string, unknown>)?.gradedAt),
      };
    })
    .sort(compareAcademicPeriodsDescending);

  return {
    student: {
      id: student.id,
      name: buildStudentName(student),
      registrationNumber: collapseSpaces(student.studentId),
    },
    totalModules: modules.length,
    modules,
  };
}

function pushActivity(
  activities: DemoActivity[],
  input: Omit<DemoActivity, "createdAt"> & { createdAt: Date | string }
) {
  activities.push({
    ...input,
    createdAt: input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt),
  });
}

function milestoneThresholds() {
  return [
    {
      threshold: 100,
      xpPoints: XP_VALUES.MILESTONE_100,
      label: "100 XP Milestone",
    },
    {
      threshold: 300,
      xpPoints: XP_VALUES.MILESTONE_300,
      label: "300 XP Milestone",
    },
    {
      threshold: 600,
      xpPoints: XP_VALUES.MILESTONE_600,
      label: "600 XP Milestone",
    },
  ];
}

function getEarnedTrophy(
  earnedTrophies: Map<string, DemoTrophy>,
  trophyKey: string
) {
  return earnedTrophies.get(collapseSpaces(trophyKey)) ?? null;
}

function getEligibleTrophyDefinitions(processedGrades: IGrade[], totalXP: number) {
  const eligible = new Set<string>();
  const passedGrades = processedGrades.filter((grade) => grade.status === "pass");
  const highScoreGrades = processedGrades.filter(
    (grade) => Number(grade.totalMarks ?? 0) >= 80
  );
  const perfectGrades = processedGrades.filter(
    (grade) => Number(grade.totalMarks ?? 0) === 100
  );
  const semesterItems = findCompletedSemesterItems(processedGrades);
  const cumulativeGPA = calculateCumulativeGPA(processedGrades);

  if (passedGrades.length >= 1) eligible.add("first_module_passed");
  if (passedGrades.length >= 5) eligible.add("five_modules_passed");
  if (passedGrades.length >= 10) eligible.add("ten_modules_passed");
  if (passedGrades.length >= 20) eligible.add("twenty_modules_passed");

  if (highScoreGrades.length >= 1) eligible.add("first_high_score");
  if (highScoreGrades.length >= 5) eligible.add("five_high_scores");
  if (perfectGrades.length >= 1) eligible.add("perfect_score");
  if (perfectGrades.length >= 3) eligible.add("triple_perfect");

  if (semesterItems.some((item) => item.gpa > 3.5)) eligible.add("deans_list");
  if (cumulativeGPA >= 3.7) eligible.add("first_class_achievement");

  for (let index = 0; index <= semesterItems.length - 3; index += 1) {
    const streak = semesterItems.slice(index, index + 3);
    if (streak.every((item) => item.gpa >= 3.0)) {
      eligible.add("consistent_performer");
      break;
    }
  }

  for (let index = 1; index < semesterItems.length; index += 1) {
    const previous = semesterItems[index - 1];
    const current = semesterItems[index];
    if (roundToTwo(current.gpa - previous.gpa) >= 0.5) {
      eligible.add("comeback_king");
      break;
    }
  }

  if (semesterItems.some((item) => item.allPassed)) eligible.add("clean_sweep");
  if (semesterItems.some((item) => item.allPassed && item.hasHighScore)) {
    eligible.add("semester_champion");
  }

  const previousStatusesByModule = new Map<string, string[]>();
  for (const grade of processedGrades) {
    const offering = asObject(
      asObject(grade as unknown as Record<string, unknown>)?.moduleOfferingId
    );
    const moduleKey =
      collapseSpaces(offering?.moduleId) ||
      normalizeModuleCode(offering?.moduleCode) ||
      readId(offering?._id);
    if (!moduleKey) {
      continue;
    }

    const previousStatuses = previousStatusesByModule.get(moduleKey) ?? [];
    const status = collapseSpaces(grade.status);

    if (
      status === "pass" &&
      previousStatuses.some(
        (previousStatus) =>
          previousStatus === "fail" ||
          previousStatus === "pro-rata" ||
          previousStatus === "repeat"
      )
    ) {
      eligible.add("resilience");
      break;
    }

    previousStatuses.push(status);
    previousStatusesByModule.set(moduleKey, previousStatuses);
  }

  const passedFaculties = new Set(
    passedGrades
      .map((grade) =>
        collapseSpaces(
          asObject(asObject(grade as unknown as Record<string, unknown>)?.moduleOfferingId)
            ?.facultyId
        )
      )
      .filter(Boolean)
  );
  if (passedFaculties.size >= 3) {
    eligible.add("all_rounder");
  }

  if (totalXP >= 100) eligible.add("xp_beginner");
  if (totalXP >= 300) eligible.add("xp_intermediate");
  if (totalXP >= 600) eligible.add("xp_champion");

  const currentLevel = getCurrentLevel(totalXP);
  if (currentLevel.level >= 2) eligible.add("level_2_reached");
  if (currentLevel.level >= 3) eligible.add("level_3_reached");
  if (currentLevel.level >= 4) eligible.add("level_4_reached");

  return TROPHY_DEFINITIONS.filter((definition) => eligible.has(definition.key));
}

function buildTrophyMetadata(
  trophyKey: string,
  processedGrades: IGrade[],
  totalXP: number
) {
  const semesterItems = findCompletedSemesterItems(processedGrades);

  if (trophyKey === "deans_list") {
    const semester = semesterItems.find((item) => item.gpa > 3.5);
    return semester
      ? {
          semesterGPA: semester.gpa,
          academicYear: semester.academicYear,
          semester: semester.semester,
        }
      : null;
  }

  if (trophyKey === "clean_sweep") {
    const semester = semesterItems.find((item) => item.allPassed);
    return semester
      ? {
          modulesCount: semester.grades.length,
          semesterGPA: semester.gpa,
        }
      : null;
  }

  if (trophyKey === "semester_champion") {
    const semester = semesterItems.find((item) => item.allPassed && item.hasHighScore);
    return semester
      ? {
          modulesCount: semester.grades.length,
          semesterGPA: semester.gpa,
          hasHighScore: true,
        }
      : null;
  }

  if (
    trophyKey === "xp_beginner" ||
    trophyKey === "xp_intermediate" ||
    trophyKey === "xp_champion"
  ) {
    return { totalXP };
  }

  if (
    trophyKey === "level_2_reached" ||
    trophyKey === "level_3_reached" ||
    trophyKey === "level_4_reached"
  ) {
    const currentLevel = getCurrentLevel(totalXP);
    return {
      totalXP,
      level: currentLevel.level,
      levelName: currentLevel.name,
      levelTitle: currentLevel.title,
    };
  }

  return null;
}

function latestEventAt(activities: DemoActivity[]) {
  return activities.length > 0
    ? [...activities].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      )[0].createdAt
    : new Date();
}

function deriveTrophyEarnedAt(
  trophyKey: string,
  processedGrades: IGrade[],
  fallback: Date
) {
  const semesterItems = findCompletedSemesterItems(processedGrades);

  if (trophyKey === "deans_list") {
    return semesterItems.find((item) => item.gpa > 3.5)?.latestAt ?? fallback;
  }

  if (trophyKey === "clean_sweep") {
    return semesterItems.find((item) => item.allPassed)?.latestAt ?? fallback;
  }

  if (trophyKey === "semester_champion") {
    return (
      semesterItems.find((item) => item.allPassed && item.hasHighScore)?.latestAt ??
      fallback
    );
  }

  if (trophyKey === "consistent_performer") {
    for (let index = 0; index <= semesterItems.length - 3; index += 1) {
      const streak = semesterItems.slice(index, index + 3);
      if (streak.every((item) => item.gpa >= 3.0)) {
        return streak[streak.length - 1].latestAt;
      }
    }
  }

  if (trophyKey === "comeback_king") {
    for (let index = 1; index < semesterItems.length; index += 1) {
      const previous = semesterItems[index - 1];
      const current = semesterItems[index];
      if (roundToTwo(current.gpa - previous.gpa) >= 0.5) {
        return current.latestAt;
      }
    }
  }

  return fallback;
}

export function buildDemoGamificationSnapshot(studentId: string): DemoGamificationSnapshot | null {
  if (!hasDemoStudent(studentId)) {
    return null;
  }

  const grades = getDemoEnrichedGrades(studentId);
  const semesterProcessed = new Set<string>();
  const activities: DemoActivity[] = [];
  const earnedTrophies = new Map<string, DemoTrophy>();
  const awardedMilestones = new Set<number>();
  let totalXP = 0;

  for (const grade of grades) {
    const offering = asObject(
      asObject(grade as unknown as Record<string, unknown>)?.moduleOfferingId
    );
    const moduleCode = collapseSpaces(offering?.moduleCode) || "N/A";
    const moduleName =
      collapseSpaces(offering?.moduleName) ||
      collapseSpaces(offering?.moduleId) ||
      "Unknown Module";
    const gradeTimestamp = getGradeTimestamp(grade);
    const semesterKey = buildSemesterKey(
      collapseSpaces(grade.academicYear),
      Number(grade.semester) === 2 ? 2 : 1
    );

    if (grade.status === "pass") {
      pushActivity(activities, {
        action: "module_passed",
        xpPoints: XP_VALUES.MODULE_PASSED,
        reason: `Passed module ${moduleCode} - ${moduleName}`,
        category: "academic",
        createdAt: gradeTimestamp,
        academicYear: collapseSpaces(grade.academicYear),
        semester: Number(grade.semester) === 2 ? 2 : 1,
        moduleOfferingId: readId(offering?._id),
        metadata: { moduleCode, moduleName },
      });
      totalXP += XP_VALUES.MODULE_PASSED;
    }

    if (Number(grade.totalMarks ?? 0) >= 80) {
      pushActivity(activities, {
        action: "high_score",
        xpPoints: XP_VALUES.HIGH_SCORE,
        reason: `Scored ${Number(grade.totalMarks ?? 0)}% in ${moduleCode} - ${moduleName}`,
        category: "academic",
        createdAt: gradeTimestamp,
        academicYear: collapseSpaces(grade.academicYear),
        semester: Number(grade.semester) === 2 ? 2 : 1,
        moduleOfferingId: readId(offering?._id),
        metadata: {
          moduleCode,
          moduleName,
          totalMarks: Number(grade.totalMarks ?? 0),
        },
      });
      totalXP += XP_VALUES.HIGH_SCORE;
    }

    if (Number(grade.totalMarks ?? 0) === 100) {
      pushActivity(activities, {
        action: "perfect_score",
        xpPoints: XP_VALUES.PERFECT_SCORE,
        reason: `Perfect score in ${moduleCode} - ${moduleName}`,
        category: "academic",
        createdAt: gradeTimestamp,
        academicYear: collapseSpaces(grade.academicYear),
        semester: Number(grade.semester) === 2 ? 2 : 1,
        moduleOfferingId: readId(offering?._id),
        metadata: { moduleCode, moduleName, totalMarks: 100 },
      });
      totalXP += XP_VALUES.PERFECT_SCORE;
    }

    if (!semesterProcessed.has(semesterKey)) {
      const processedGrades = grades.filter(
        (item) =>
          compareAcademicPeriods(
            {
              academicYear: collapseSpaces(item.academicYear),
              semester: Number(item.semester) === 2 ? 2 : 1,
            },
            {
              academicYear: collapseSpaces(grade.academicYear),
              semester: Number(grade.semester) === 2 ? 2 : 1,
            }
          ) <= 0
      );
      const completedSemesterItems = findCompletedSemesterItems(processedGrades);
      const currentSemester = completedSemesterItems.find(
        (item) => buildSemesterKey(item.academicYear, item.semester) === semesterKey
      );
      const previousPeriod = getPreviousAcademicPeriod(
        collapseSpaces(grade.academicYear),
        Number(grade.semester) === 2 ? 2 : 1
      );
      const previousSemester = previousPeriod
        ? completedSemesterItems.find(
            (item) =>
              item.academicYear === previousPeriod.academicYear &&
              item.semester === previousPeriod.semester
          )
        : null;

      if (
        currentSemester &&
        currentSemester.latestAt.getTime() === gradeTimestamp.getTime()
      ) {
        semesterProcessed.add(semesterKey);
        const semesterLabel = `${currentSemester.academicYear} Semester ${currentSemester.semester}`;

        if (currentSemester.gpa >= 3.0) {
          pushActivity(activities, {
            action: "semester_gpa_above_3",
            xpPoints: XP_VALUES.SEMESTER_GPA_ABOVE_3,
            reason: `Achieved semester GPA ${currentSemester.gpa.toFixed(2)} in ${semesterLabel}`,
            category: "academic",
            createdAt: currentSemester.latestAt,
            academicYear: currentSemester.academicYear,
            semester: currentSemester.semester,
            metadata: { semesterGPA: currentSemester.gpa },
          });
          totalXP += XP_VALUES.SEMESTER_GPA_ABOVE_3;
        }

        if (currentSemester.gpa >= 3.5) {
          pushActivity(activities, {
            action: "semester_gpa_above_3.5",
            xpPoints: XP_VALUES.SEMESTER_GPA_ABOVE_3_5,
            reason: `Achieved high semester GPA ${currentSemester.gpa.toFixed(2)} in ${semesterLabel}`,
            category: "academic",
            createdAt: currentSemester.latestAt,
            academicYear: currentSemester.academicYear,
            semester: currentSemester.semester,
            metadata: { semesterGPA: currentSemester.gpa },
          });
          totalXP += XP_VALUES.SEMESTER_GPA_ABOVE_3_5;
        }

        if (currentSemester.allPassed) {
          pushActivity(activities, {
            action: "semester_all_passed",
            xpPoints: XP_VALUES.SEMESTER_ALL_PASSED,
            reason: `Passed all ${currentSemester.grades.length} modules in ${semesterLabel}`,
            category: "academic",
            createdAt: currentSemester.latestAt,
            academicYear: currentSemester.academicYear,
            semester: currentSemester.semester,
            metadata: { modulesPassed: currentSemester.grades.length },
          });
          totalXP += XP_VALUES.SEMESTER_ALL_PASSED;
        }

        if (
          previousSemester &&
          roundToTwo(currentSemester.gpa - previousSemester.gpa) >= 0.1
        ) {
          pushActivity(activities, {
            action: "gpa_improvement",
            xpPoints: XP_VALUES.GPA_IMPROVEMENT,
            reason: `Improved GPA from ${previousSemester.gpa.toFixed(2)} to ${currentSemester.gpa.toFixed(2)} in ${semesterLabel}`,
            category: "academic",
            createdAt: currentSemester.latestAt,
            academicYear: currentSemester.academicYear,
            semester: currentSemester.semester,
            metadata: {
              previousGPA: previousSemester.gpa,
              currentGPA: currentSemester.gpa,
              improvement: roundToTwo(currentSemester.gpa - previousSemester.gpa),
            },
          });
          totalXP += XP_VALUES.GPA_IMPROVEMENT;
        }

        const cumulativeGPA = calculateCumulativeGPA(processedGrades);
        if (
          cumulativeGPA >= 3.7 &&
          !activities.some((activity) => activity.action === "first_class_gpa")
        ) {
          pushActivity(activities, {
            action: "first_class_gpa",
            xpPoints: XP_VALUES.FIRST_CLASS_GPA,
            reason: `Reached First Class cumulative GPA of ${cumulativeGPA.toFixed(2)}`,
            category: "academic",
            createdAt: currentSemester.latestAt,
            academicYear: currentSemester.academicYear,
            semester: currentSemester.semester,
            metadata: {
              cumulativeGPA,
              achievedInAcademicYear: currentSemester.academicYear,
              achievedInSemester: currentSemester.semester,
            },
          });
          totalXP += XP_VALUES.FIRST_CLASS_GPA;
        }

        const streakLength = calculateStreakLength(
          groupGradesBySemester(processedGrades),
          currentSemester.academicYear,
          currentSemester.semester
        );
        if (streakLength >= 2) {
          pushActivity(activities, {
            action: "streak_bonus",
            xpPoints: XP_VALUES.STREAK_BONUS,
            reason: `Maintained a ${streakLength}-semester good-performance streak through ${semesterLabel}`,
            category: "bonus",
            createdAt: currentSemester.latestAt,
            academicYear: currentSemester.academicYear,
            semester: currentSemester.semester,
            metadata: {
              streakLength,
              semesterGPA: currentSemester.gpa,
            },
          });
          totalXP += XP_VALUES.STREAK_BONUS;
        }
      }
    }

    let keepChecking = true;
    while (keepChecking) {
      keepChecking = false;

      for (const milestone of milestoneThresholds()) {
        if (awardedMilestones.has(milestone.threshold) || totalXP < milestone.threshold) {
          continue;
        }

        pushActivity(activities, {
          action: "milestone_reached",
          xpPoints: milestone.xpPoints,
          reason: milestone.label,
          category: "milestone",
          createdAt: gradeTimestamp,
          metadata: { threshold: milestone.threshold },
        });
        totalXP += milestone.xpPoints;
        awardedMilestones.add(milestone.threshold);
        keepChecking = true;
      }

      const processedGrades = grades.filter(
        (item) => getGradeTimestamp(item).getTime() <= gradeTimestamp.getTime()
      );
      const eligibleTrophies = getEligibleTrophyDefinitions(processedGrades, totalXP);

      eligibleTrophies.forEach((definition) => {
        if (getEarnedTrophy(earnedTrophies, definition.key)) {
          return;
        }

        const earnedAt = deriveTrophyEarnedAt(
          definition.key,
          processedGrades,
          latestEventAt(activities)
        );
        const metadata = buildTrophyMetadata(definition.key, processedGrades, totalXP);

        earnedTrophies.set(definition.key, {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          tier: definition.tier,
          category: definition.category,
          xpBonusAwarded: definition.xpBonus,
          earnedAt,
          metadata,
        });

        if (definition.xpBonus > 0) {
          pushActivity(activities, {
            action: "milestone_reached",
            xpPoints: definition.xpBonus,
            reason: `Trophy earned: ${definition.name}`,
            category: "bonus",
            createdAt: earnedAt,
            academicYear:
              collapseSpaces(metadata?.academicYear) || undefined,
            semester:
              Number(metadata?.semester ?? NaN) === 2
                ? 2
                : Number(metadata?.semester ?? NaN) === 1
                  ? 1
                  : undefined,
            metadata: {
              trophyKey: definition.key,
              trophyName: definition.name,
              trophyTier: definition.tier,
              xpBonus: definition.xpBonus,
              ...(metadata ?? {}),
            },
          });
          totalXP += definition.xpBonus;
          keepChecking = true;
        }
      });
    }
  }

  const sortedActivities = [...activities].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  );
  const categoryBreakdown = Array.from(
    sortedActivities.reduce((map, activity) => {
      const current = map.get(activity.category) ?? { totalXP: 0, count: 0 };
      current.totalXP += Number(activity.xpPoints ?? 0);
      current.count += 1;
      map.set(activity.category, current);
      return map;
    }, new Map<string, { totalXP: number; count: number }>())
  )
    .map(([category, value]) => ({
      category,
      totalXP: roundToTwo(value.totalXP),
      count: value.count,
    }))
    .sort((left, right) => left.category.localeCompare(right.category));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const semesterItems = findCompletedSemesterItems(grades);
  const latestSemester = semesterItems[semesterItems.length - 1] ?? null;
  const recentTrophies = [...earnedTrophies.values()].sort((left, right) => {
    const tierCompare =
      TROPHY_TIER_ORDER[right.tier] - TROPHY_TIER_ORDER[left.tier];
    if (tierCompare !== 0) {
      return tierCompare;
    }

    return right.earnedAt.getTime() - left.earnedAt.getTime();
  });
  const topTrophy = recentTrophies[0]
    ? {
        key: recentTrophies[0].key,
        name: recentTrophies[0].name,
        icon: recentTrophies[0].icon,
        tier: recentTrophies[0].tier,
      }
    : null;

  const showcaseByTier = {
    bronze: { total: 0, earned: 0 },
    silver: { total: 0, earned: 0 },
    gold: { total: 0, earned: 0 },
    platinum: { total: 0, earned: 0 },
    diamond: { total: 0, earned: 0 },
  };
  const showcaseByCategory: Record<string, { total: number; earned: number }> = {};

  TROPHY_DEFINITIONS.forEach((definition) => {
    showcaseByTier[definition.tier].total += 1;
    showcaseByCategory[definition.category] = showcaseByCategory[definition.category] ?? {
      total: 0,
      earned: 0,
    };
    showcaseByCategory[definition.category].total += 1;
  });

  const trophyItems = TROPHY_DEFINITIONS.map((definition) => {
    const earnedTrophy = getEarnedTrophy(earnedTrophies, definition.key);
    if (earnedTrophy) {
      showcaseByTier[definition.tier].earned += 1;
      showcaseByCategory[definition.category].earned += 1;
    }

    return {
      definition,
      earned: Boolean(earnedTrophy),
      earnedAt: earnedTrophy?.earnedAt ?? null,
      metadata: earnedTrophy?.metadata ?? null,
    };
  }).sort((left, right) => {
    if (left.earned && right.earned) {
      return (right.earnedAt?.getTime() ?? 0) - (left.earnedAt?.getTime() ?? 0);
    }

    if (left.earned !== right.earned) {
      return left.earned ? -1 : 1;
    }

    const tierDiff =
      TROPHY_TIER_ORDER[right.definition.tier] - TROPHY_TIER_ORDER[left.definition.tier];
    if (tierDiff !== 0) {
      return tierDiff;
    }

    return left.definition.name.localeCompare(right.definition.name);
  });

  const level = {
    current: getCurrentLevel(totalXP),
    next: getNextLevel(totalXP),
    progress: getLevelProgress(totalXP),
    badge: getLevelBadge(totalXP),
    comparison: getLevelComparison(totalXP),
    totalXP: roundToTwo(totalXP),
  };

  return {
    studentId,
    totalXP: roundToTwo(totalXP),
    categoryBreakdown,
    recentActivity: sortedActivities.slice(0, 10).map((activity) => ({
      action: activity.action,
      xpPoints: roundToTwo(activity.xpPoints),
      reason: activity.reason,
      category: activity.category,
      createdAt: activity.createdAt,
      metadata: activity.metadata,
    })),
    activityCount: sortedActivities.length,
    pointsThisMonth: roundToTwo(
      sortedActivities
        .filter((activity) => activity.createdAt >= monthStart)
        .reduce((sum, activity) => sum + Number(activity.xpPoints ?? 0), 0)
    ),
    pointsThisSemester: latestSemester
      ? roundToTwo(
          sortedActivities
            .filter(
              (activity) =>
                activity.academicYear === latestSemester.academicYear &&
                activity.semester === latestSemester.semester
            )
            .reduce((sum, activity) => sum + Number(activity.xpPoints ?? 0), 0)
        )
      : 0,
    averagePointsPerModule:
      grades.length > 0 ? roundToTwo(totalXP / grades.length) : 0,
    xpChange: {
      last7Days: roundToTwo(
        sortedActivities
          .filter(
            (activity) =>
              activity.createdAt.getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000
          )
          .reduce((sum, activity) => sum + Number(activity.xpPoints ?? 0), 0)
      ),
      last30Days: roundToTwo(
        sortedActivities
          .filter(
            (activity) =>
              activity.createdAt.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000
          )
          .reduce((sum, activity) => sum + Number(activity.xpPoints ?? 0), 0)
      ),
    },
    level,
    trophies: {
      totalAvailable: TROPHY_DEFINITIONS.length,
      totalEarned: earnedTrophies.size,
      earnedPercentage:
        TROPHY_DEFINITIONS.length > 0
          ? roundToTwo((earnedTrophies.size / TROPHY_DEFINITIONS.length) * 100)
          : 0,
      items: trophyItems,
      byTier: showcaseByTier,
      byCategory: showcaseByCategory,
      recentlyEarned: [...earnedTrophies.values()]
        .sort((left, right) => right.earnedAt.getTime() - left.earnedAt.getTime())
        .slice(0, 5),
    },
    topTrophy,
  };
}

export function buildDemoPointsPayload(studentId: string) {
  const student = findStudentInMemoryById(studentId);
  const snapshot = buildDemoGamificationSnapshot(studentId);
  if (!student || !snapshot) {
    return null;
  }

  return {
    studentId,
    student: {
      name: buildStudentName(student),
      registrationNumber: collapseSpaces(student.studentId),
    },
    totalXP: snapshot.totalXP,
    categoryBreakdown: snapshot.categoryBreakdown,
    recentActivity: snapshot.recentActivity,
    activityCount: snapshot.activityCount,
    pointsThisMonth: snapshot.pointsThisMonth,
    pointsThisSemester: snapshot.pointsThisSemester,
    averagePointsPerModule: snapshot.averagePointsPerModule,
  };
}

export function buildDemoTrophiesPayload(studentId: string) {
  const student = findStudentInMemoryById(studentId);
  const snapshot = buildDemoGamificationSnapshot(studentId);
  if (!student || !snapshot) {
    return null;
  }

  return {
    student: {
      id: studentId,
      name: buildStudentName(student),
      registrationNumber: collapseSpaces(student.studentId),
    },
    level: snapshot.level,
    trophies: {
      totalAvailable: snapshot.trophies.totalAvailable,
      totalEarned: snapshot.trophies.totalEarned,
      earnedPercentage: snapshot.trophies.earnedPercentage,
      items: snapshot.trophies.items,
      byTier: snapshot.trophies.byTier,
      byCategory: snapshot.trophies.byCategory,
      recentlyEarned: snapshot.trophies.recentlyEarned.map((trophy) => ({
        trophyKey: trophy.key,
        trophyName: trophy.name,
        trophyDescription: trophy.description,
        trophyIcon: trophy.icon,
        trophyTier: trophy.tier,
        category: trophy.category,
        xpBonusAwarded: trophy.xpBonusAwarded,
        earnedAt: trophy.earnedAt,
        metadata: trophy.metadata,
      })),
    },
  };
}

function seenTrophyStore() {
  if (!globalForDemoGamification.__demoSeenTrophies) {
    globalForDemoGamification.__demoSeenTrophies = new Map();
  }

  return globalForDemoGamification.__demoSeenTrophies;
}

export function buildDemoTrophyCheckResult(studentId: string) {
  const snapshot = buildDemoGamificationSnapshot(studentId);
  if (!snapshot) {
    return null;
  }

  const store = seenTrophyStore();
  const seen = store.get(studentId) ?? new Set<string>();
  const newTrophies = snapshot.trophies.recentlyEarned
    .filter((trophy) => !seen.has(trophy.key))
    .map((trophy) => ({
      trophyKey: trophy.key,
      trophyName: trophy.name,
      trophyIcon: trophy.icon,
      trophyTier: trophy.tier,
      xpBonusAwarded: trophy.xpBonusAwarded,
      message: `${trophy.icon} Trophy Unlocked: ${trophy.name}!`,
    }));

  snapshot.trophies.recentlyEarned.forEach((trophy) => {
    seen.add(trophy.key);
  });
  store.set(studentId, seen);

  return {
    success: true,
    studentId,
    newTrophiesAwarded: newTrophies,
    totalNewTrophies: newTrophies.length,
    totalXPBonusAwarded: newTrophies.reduce(
      (sum, trophy) => sum + Number(trophy.xpBonusAwarded ?? 0),
      0
    ),
    existingTrophyCount: snapshot.trophies.totalEarned - newTrophies.length,
    errors: [] as string[],
  };
}

export function buildDemoGamificationResyncResult(
  studentId: string,
  before: DemoGamificationSnapshot | null,
  after: DemoGamificationSnapshot | null
) {
  const current = after ?? buildDemoGamificationSnapshot(studentId);
  if (!current) {
    return {
      success: false,
      studentId,
      pointsAwarded: [] as Array<{ action: string; xpPoints: number; reason: string }>,
      totalPointsAwarded: 0,
      newTotalXP: 0,
      milestonesUnlocked: [] as string[],
      errors: ["Student not found"],
    };
  }

  const previousTotalXP = Number(before?.totalXP ?? 0);
  const delta = roundToTwo(current.totalXP - previousTotalXP);
  const previousTrophies = new Set(
    before?.trophies.recentlyEarned.map((trophy) => collapseSpaces(trophy.key)) ?? []
  );
  const unlocked = current.trophies.recentlyEarned
    .filter((trophy) => !previousTrophies.has(collapseSpaces(trophy.key)))
    .map((trophy) => `${trophy.icon} ${trophy.name}`);

  return {
    success: true,
    studentId,
    pointsAwarded:
      delta !== 0
        ? [
            {
              action: "custom",
              xpPoints: delta,
              reason: "Demo gamification re-synced from in-memory grades",
            },
          ]
        : [],
    totalPointsAwarded: delta,
    newTotalXP: current.totalXP,
    milestonesUnlocked: unlocked,
    errors: [] as string[],
  };
}

function buildDemoLeaderboardStudent(studentId: string) {
  const student = findStudentDetailInMemoryById(studentId);
  if (!student) {
    return null;
  }

  const latestEnrollment = student.latestEnrollment ?? null;
  return {
    id: student.id,
    name: buildStudentName(student),
    registrationNumber: collapseSpaces(student.studentId),
    faculty: latestEnrollment?.facultyName || undefined,
    degreeProgram: latestEnrollment?.degreeProgramName || undefined,
    intake: latestEnrollment?.intakeName || undefined,
  };
}

function resolveDemoScopeName(options: DemoLeaderboardBuildOptions) {
  if (options.scope === "campus") {
    return "Campus";
  }

  if (options.scope === "faculty") {
    return findFaculty(options.facultyId ?? "")?.name ?? options.facultyId ?? null;
  }

  if (options.scope === "degree") {
    return (
      findDegreeProgram(options.degreeProgramId ?? "")?.name ??
      options.degreeProgramId ??
      null
    );
  }

  if (options.scope === "intake") {
    return findIntakeById(options.intakeId ?? "")?.name ?? options.intakeId ?? null;
  }

  if (options.scope === "module") {
    const offering = findModuleOfferingById(options.moduleOfferingId ?? "");
    if (!offering) {
      return options.moduleOfferingId ?? null;
    }

    return `${collapseSpaces(offering.moduleCode)} - ${collapseSpaces(offering.moduleName)}`;
  }

  return null;
}

function sortDemoLeaderboardEntries(entries: DemoLeaderboardEntry[]) {
  return [...entries].sort((left, right) => {
    const xpCompare = right.totalXP - left.totalXP;
    if (xpCompare !== 0) {
      return xpCompare;
    }

    const last30Compare = right.xpChange.last30Days - left.xpChange.last30Days;
    if (last30Compare !== 0) {
      return last30Compare;
    }

    const nameCompare = left.student.name.localeCompare(right.student.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.student.registrationNumber.localeCompare(
      right.student.registrationNumber
    );
  });
}

export function buildDemoLeaderboardData(
  options: DemoLeaderboardBuildOptions
): DemoLeaderboardBuildResult {
  const scopeName = resolveDemoScopeName(options);
  const scopedIds = new Set<string>();

  if (options.scope === "campus") {
    listStudentsInMemory().forEach((student) => scopedIds.add(student.id));
  } else if (options.scope === "faculty") {
    listEnrollmentRecordsInMemory()
      .filter((row) => normalizeAcademicCode(row.facultyId) === normalizeAcademicCode(options.facultyId))
      .forEach((row) => scopedIds.add(row.studentId));
  } else if (options.scope === "degree") {
    listEnrollmentRecordsInMemory()
      .filter(
        (row) =>
          normalizeAcademicCode(row.degreeProgramId) ===
          normalizeAcademicCode(options.degreeProgramId)
      )
      .forEach((row) => scopedIds.add(row.studentId));
  } else if (options.scope === "intake") {
    listEnrollmentRecordsInMemory()
      .filter((row) => collapseSpaces(row.intakeId) === collapseSpaces(options.intakeId))
      .forEach((row) => scopedIds.add(row.studentId));
  } else if (options.scope === "module") {
    listGradesInMemory({ moduleOfferingId: collapseSpaces(options.moduleOfferingId) }).forEach(
      (grade) => scopedIds.add(grade.studentId)
    );
  }

  const entries = Array.from(scopedIds)
    .map((studentId) => {
      const student = buildDemoLeaderboardStudent(studentId);
      const snapshot = buildDemoGamificationSnapshot(studentId);
      if (!student || !snapshot) {
        return null;
      }

      return {
        rank: 0,
        student,
        totalXP: snapshot.totalXP,
        level: {
          number: snapshot.level.current.level,
          name: snapshot.level.current.name,
          title: snapshot.level.current.title,
          icon: snapshot.level.current.icon,
          color: snapshot.level.current.color,
        },
        topTrophy: snapshot.topTrophy,
        xpChange: snapshot.xpChange,
      } satisfies DemoLeaderboardEntry;
    })
    .filter(Boolean) as DemoLeaderboardEntry[];

  const sorted = sortDemoLeaderboardEntries(entries).map((entry, index, source) => ({
    ...entry,
    rank:
      index > 0 && source[index - 1].totalXP === entry.totalXP
        ? source[index - 1].rank
        : index + 1,
  }));

  return {
    scope: options.scope,
    scopeName,
    totalStudents: sorted.length,
    activeParticipants: sorted.filter((entry) => entry.totalXP > 0).length,
    entries: sorted,
  };
}
