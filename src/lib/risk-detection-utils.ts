import {
  calculateTotalMarks,
  determineGradeLetter,
  determineStatus,
  type GradeStatus,
} from "@/lib/grade-utils";
import type { IGrade } from "@/models/Grade";

export interface AtRiskModule {
  gradeId: string;
  moduleOfferingId: string;
  moduleName: string;
  moduleCode: string;
  caMarks: number;
  finalExamMarks: number;
  totalMarks: number;
  gradeLetter: string;
  academicYear: string;
  semester: number;
  action: string;
}

export interface AtRiskReport {
  proRataModules: AtRiskModule[];
  repeatModules: AtRiskModule[];
  failedModules: AtRiskModule[];
  totalAtRisk: number;
  hasProRata: boolean;
  hasRepeat: boolean;
  hasFailed: boolean;
  hasAnyRisk: boolean;
}

export interface AcademicStanding {
  standing: string;
  level: "good" | "satisfactory" | "warning" | "probation";
  color: string;
  message: string;
  recommendations: string[];
}

export interface SemesterRiskSummary {
  academicYear: string;
  semester: number;
  totalModules: number;
  passCount: number;
  failCount: number;
  proRataCount: number;
  repeatCount: number;
  riskPercentage: number;
  semesterStatus: "clear" | "at-risk" | "critical";
}

export interface ProRataEligibility {
  isProRata: boolean;
  isRepeat: boolean;
  isPass: boolean;
  status: GradeStatus;
  explanation: string;
  caStatus: "passed" | "failed";
  finalStatus: "passed" | "failed";
  caMarks: number;
  finalExamMarks: number;
  caThreshold: number;
  finalThreshold: number;
  caDeficit: number;
  finalDeficit: number;
}

export interface FullRiskReport {
  academicStanding: AcademicStanding;
  atRiskModules: AtRiskReport;
  semesterRiskHistory: SemesterRiskSummary[];
  overallRiskLevel: "none" | "low" | "medium" | "high" | "critical";
  summary: string;
}

const PASS_THRESHOLD = 45;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return String(value ?? "").trim();
}

function readNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function parseAcademicYearStart(value: string) {
  const match = readString(value).match(/^(\d{4})/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareSemestersDescending(
  left: Pick<AtRiskModule, "academicYear" | "semester">,
  right: Pick<AtRiskModule, "academicYear" | "semester">
) {
  const leftYear = parseAcademicYearStart(left.academicYear);
  const rightYear = parseAcademicYearStart(right.academicYear);

  if (leftYear !== null && rightYear !== null && leftYear !== rightYear) {
    return rightYear - leftYear;
  }

  const academicYearCompare = right.academicYear.localeCompare(left.academicYear);
  if (academicYearCompare !== 0) {
    return academicYearCompare;
  }

  return right.semester - left.semester;
}

function compareSemestersAscending(
  left: Pick<SemesterRiskSummary, "academicYear" | "semester">,
  right: Pick<SemesterRiskSummary, "academicYear" | "semester">
) {
  const leftYear = parseAcademicYearStart(left.academicYear);
  const rightYear = parseAcademicYearStart(right.academicYear);

  if (leftYear !== null && rightYear !== null && leftYear !== rightYear) {
    return leftYear - rightYear;
  }

  const academicYearCompare = left.academicYear.localeCompare(right.academicYear);
  if (academicYearCompare !== 0) {
    return academicYearCompare;
  }

  return left.semester - right.semester;
}

function getModuleOfferingRecord(grade: IGrade) {
  const row = grade as unknown as Record<string, unknown>;
  return asObject(row.moduleOfferingId);
}

function getNestedModuleRecord(grade: IGrade) {
  const moduleOffering = getModuleOfferingRecord(grade);
  const moduleRecord = asObject(moduleOffering?.module);
  if (moduleRecord) {
    return moduleRecord;
  }

  return asObject(moduleOffering?.moduleId);
}

function getModuleOfferingId(grade: IGrade) {
  const row = grade as unknown as Record<string, unknown>;
  return readId(row.moduleOfferingId);
}

function getModuleName(grade: IGrade) {
  const row = grade as unknown as Record<string, unknown>;
  const moduleOffering = getModuleOfferingRecord(grade);
  const moduleRecord = getNestedModuleRecord(grade);

  const candidates = [
    row.moduleName,
    moduleOffering?.moduleName,
    moduleRecord?.name,
  ];

  for (const candidate of candidates) {
    const normalized = readString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  // Module names are usually resolved by the API when module offering data is populated.
  // When that data is absent, fall back to the module offering id string for reporting.
  return getModuleOfferingId(grade) || "Unknown Module";
}

function getModuleCode(grade: IGrade) {
  const row = grade as unknown as Record<string, unknown>;
  const moduleOffering = getModuleOfferingRecord(grade);
  const moduleRecord = getNestedModuleRecord(grade);

  const candidates = [
    row.moduleCode,
    moduleOffering?.moduleCode,
    moduleRecord?.code,
  ];

  for (const candidate of candidates) {
    const normalized = readString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "N/A";
}

function getGradeId(grade: IGrade) {
  const row = grade as unknown as Record<string, unknown>;
  return readId(row._id ?? row.id) || getModuleOfferingId(grade);
}

function toAtRiskModule(grade: IGrade, action: string): AtRiskModule {
  return {
    gradeId: getGradeId(grade),
    moduleOfferingId: getModuleOfferingId(grade),
    moduleName: getModuleName(grade),
    moduleCode: getModuleCode(grade),
    caMarks: roundToTwo(readNumber(grade.caMarks)),
    finalExamMarks: roundToTwo(readNumber(grade.finalExamMarks)),
    totalMarks: roundToTwo(readNumber(grade.totalMarks)),
    gradeLetter: readString(grade.gradeLetter),
    academicYear: readString(grade.academicYear),
    semester: Number(grade.semester) || 0,
    action,
  };
}

function recommendationsForLevel(level: AcademicStanding["level"]) {
  if (level === "good") {
    return [
      "Continue maintaining your study habits",
      "Consider mentoring other students",
    ];
  }

  if (level === "satisfactory") {
    return [
      "Focus on improving weaker modules",
      "Attend all tutorials and labs",
      "Consider forming study groups",
    ];
  }

  if (level === "warning") {
    return [
      "Schedule a meeting with your academic advisor immediately",
      "Prioritize at-risk modules",
      "Seek tutoring support for struggling subjects",
      "Review your study schedule and time management",
    ];
  }

  return [
    "Meet with your academic advisor urgently",
    "Consider reducing course load next semester",
    "Enroll in academic support programs",
    "Focus exclusively on passing current at-risk modules",
    "Seek counseling services if needed",
  ];
}

function determineOverallRiskLevel(
  totalAtRisk: number,
  cumulativeGPA: number
): FullRiskReport["overallRiskLevel"] {
  if (totalAtRisk >= 5 || cumulativeGPA < 1.5) {
    return "critical";
  }

  if (totalAtRisk >= 3 || (cumulativeGPA >= 1.5 && cumulativeGPA < 2.0)) {
    return "high";
  }

  if (totalAtRisk === 2 || (cumulativeGPA >= 2.0 && cumulativeGPA <= 2.5)) {
    return "medium";
  }

  if (totalAtRisk === 1 && cumulativeGPA >= 2.5) {
    return "low";
  }

  if (totalAtRisk === 0 && cumulativeGPA >= 3.0) {
    return "none";
  }

  if (totalAtRisk > 0) {
    return "medium";
  }

  return cumulativeGPA >= 2.5 ? "low" : "medium";
}

function buildRiskSummarySentence(
  report: AtRiskReport,
  standing: AcademicStanding,
  overallRiskLevel: FullRiskReport["overallRiskLevel"]
) {
  if (report.totalAtRisk === 0 && standing.level === "good") {
    return "Student is in good academic standing with no at-risk modules.";
  }

  if (standing.level === "probation") {
    return `Student is on academic probation with ${report.totalAtRisk} at-risk module${
      report.totalAtRisk === 1 ? "" : "s"
    }. Critical intervention needed.`;
  }

  if (standing.level === "warning") {
    return `Student has ${report.totalAtRisk} at-risk module${
      report.totalAtRisk === 1 ? "" : "s"
    } and is on academic warning. Immediate attention required.`;
  }

  if (overallRiskLevel === "low") {
    return `Student has ${report.totalAtRisk} at-risk module and remains in satisfactory academic standing.`;
  }

  if (report.totalAtRisk === 0) {
    return `Student is in ${standing.standing.toLowerCase()} with no current at-risk modules.`;
  }

  return `Student has ${report.totalAtRisk} at-risk module${
    report.totalAtRisk === 1 ? "" : "s"
  } and requires continued academic monitoring.`;
}

/**
 * Builds a grouped report of modules that currently place a student at academic risk.
 *
 * Modules are grouped by the persisted grade status field and sorted from most recent
 * semester to oldest. Module name and code prefer populated module offering data and
 * fall back to the module offering id string when enrichment is not available.
 *
 * @param grades All grade records for a student across semesters.
 * @returns Grouped at-risk module lists with summary flags.
 */
export function getAtRiskModules(grades: IGrade[]): AtRiskReport {
  const proRataModules = grades
    .filter((grade) => grade.status === "pro-rata")
    .map((grade) =>
      toAtRiskModule(grade, "Must repeat full module (both CA and final exam)")
    )
    .sort(compareSemestersDescending);

  const repeatModules = grades
    .filter((grade) => grade.status === "repeat")
    .map((grade) =>
      toAtRiskModule(grade, "Must repeat final exam only (CA marks retained)")
    )
    .sort(compareSemestersDescending);

  const failedModules = grades
    .filter((grade) => grade.status === "fail")
    .map((grade) =>
      toAtRiskModule(grade, "Module failed — check with academic advisor")
    )
    .sort(compareSemestersDescending);

  const totalAtRisk =
    proRataModules.length + repeatModules.length + failedModules.length;

  return {
    proRataModules,
    repeatModules,
    failedModules,
    totalAtRisk,
    hasProRata: proRataModules.length > 0,
    hasRepeat: repeatModules.length > 0,
    hasFailed: failedModules.length > 0,
    hasAnyRisk: totalAtRisk > 0,
  };
}

/**
 * Determines a student's academic standing from cumulative GPA and at-risk module count.
 *
 * @param cumulativeGPA Student cumulative GPA.
 * @param totalAtRisk Number of at-risk modules identified for the student.
 * @returns Standing label, severity level, UI color, message, and recommended actions.
 */
export function getAcademicStanding(
  cumulativeGPA: number,
  totalAtRisk: number
): AcademicStanding {
  if (cumulativeGPA >= 3.0 && totalAtRisk === 0) {
    return {
      standing: "Good Standing",
      level: "good",
      color: "green",
      message: "You are performing well. Keep up the great work!",
      recommendations: recommendationsForLevel("good"),
    };
  }

  if (cumulativeGPA >= 2.0 && totalAtRisk <= 2) {
    return {
      standing: "Satisfactory",
      level: "satisfactory",
      color: "blue",
      message: "Your performance is acceptable but there is room for improvement.",
      recommendations: recommendationsForLevel("satisfactory"),
    };
  }

  if (cumulativeGPA >= 2.0 && totalAtRisk > 2) {
    return {
      standing: "Academic Warning",
      level: "warning",
      color: "amber",
      message:
        "You have multiple at-risk modules. Please consult your academic advisor.",
      recommendations: recommendationsForLevel("warning"),
    };
  }

  return {
    standing: "Academic Probation",
    level: "probation",
    color: "red",
    message:
      "Your GPA is below the minimum requirement. Immediate academic support is recommended.",
    recommendations: recommendationsForLevel("probation"),
  };
}

/**
 * Summarizes academic risk distribution semester by semester.
 *
 * Results are grouped by academic year and semester, then sorted from oldest
 * semester to newest. Risk percentage includes fail, pro-rata, and repeat outcomes.
 *
 * @param grades All grade records for a student.
 * @returns Per-semester risk summaries in chronological order.
 */
export function getRiskSummaryBySemester(grades: IGrade[]): SemesterRiskSummary[] {
  const groups = new Map<string, { academicYear: string; semester: number; grades: IGrade[] }>();

  grades.forEach((grade) => {
    const academicYear = readString(grade.academicYear);
    const semester = Number(grade.semester) || 0;
    const key = `${academicYear}::${semester}`;
    const bucket = groups.get(key) ?? {
      academicYear,
      semester,
      grades: [],
    };

    bucket.grades.push(grade);
    groups.set(key, bucket);
  });

  return Array.from(groups.values())
    .map((group) => {
      const totalModules = group.grades.length;
      const passCount = group.grades.filter((grade) => grade.status === "pass").length;
      const failCount = group.grades.filter((grade) => grade.status === "fail").length;
      const proRataCount = group.grades.filter((grade) => grade.status === "pro-rata").length;
      const repeatCount = group.grades.filter((grade) => grade.status === "repeat").length;
      const riskCount = failCount + proRataCount + repeatCount;
      const riskPercentage =
        totalModules > 0 ? roundToOne((riskCount / totalModules) * 100) : 0;

      return {
        academicYear: group.academicYear,
        semester: group.semester,
        totalModules,
        passCount,
        failCount,
        proRataCount,
        repeatCount,
        riskPercentage,
        semesterStatus:
          riskPercentage === 0
            ? "clear"
            : riskPercentage <= 50
              ? "at-risk"
              : "critical",
      } satisfies SemesterRiskSummary;
    })
    .sort(compareSemestersAscending);
}

/**
 * Explains single-module pro-rata, repeat, pass, or fail eligibility from raw marks.
 *
 * The returned status uses the same base status logic as the existing grade utility,
 * including the weighted total mark and grade-letter check used for pass/fail decisions.
 *
 * @param caMarks Continuous assessment marks.
 * @param finalExamMarks Final examination marks.
 * @returns Detailed threshold analysis and human-readable explanation.
 */
export function getProRataEligibility(
  caMarks: number,
  finalExamMarks: number
): ProRataEligibility {
  const normalizedCaMarks = roundToTwo(readNumber(caMarks));
  const normalizedFinalExamMarks = roundToTwo(readNumber(finalExamMarks));
  const totalMarks = calculateTotalMarks(normalizedCaMarks, normalizedFinalExamMarks);
  const gradeLetter = determineGradeLetter(totalMarks);
  const status = determineStatus(normalizedCaMarks, normalizedFinalExamMarks, gradeLetter);
  const caPassed = normalizedCaMarks >= PASS_THRESHOLD;
  const finalPassed = normalizedFinalExamMarks >= PASS_THRESHOLD;
  const caDeficit = roundToTwo(Math.max(0, PASS_THRESHOLD - normalizedCaMarks));
  const finalDeficit = roundToTwo(
    Math.max(0, PASS_THRESHOLD - normalizedFinalExamMarks)
  );

  let explanation = "";
  if (status === "pass") {
    explanation = `Both CA (${normalizedCaMarks}) and Final Exam (${normalizedFinalExamMarks}) marks meet the minimum threshold of ${PASS_THRESHOLD}.`;
  } else if (status === "pro-rata") {
    explanation = `Both CA (${normalizedCaMarks}) and Final Exam (${normalizedFinalExamMarks}) marks are below the minimum threshold of ${PASS_THRESHOLD}. Full module repeat required.`;
  } else if (status === "repeat") {
    explanation = `CA marks (${normalizedCaMarks}) meet the threshold but Final Exam marks (${normalizedFinalExamMarks}) are below ${PASS_THRESHOLD}. Final exam repeat required.`;
  } else {
    explanation = `CA marks (${normalizedCaMarks}) are below the threshold of ${PASS_THRESHOLD}. Final Exam marks (${normalizedFinalExamMarks}) meet the threshold. Module failed.`;
  }

  return {
    isProRata: status === "pro-rata",
    isRepeat: status === "repeat",
    isPass: status === "pass",
    status,
    explanation,
    caStatus: caPassed ? "passed" : "failed",
    finalStatus: finalPassed ? "passed" : "failed",
    caMarks: normalizedCaMarks,
    finalExamMarks: normalizedFinalExamMarks,
    caThreshold: PASS_THRESHOLD,
    finalThreshold: PASS_THRESHOLD,
    caDeficit,
    finalDeficit,
  };
}

/**
 * Generates a consolidated student risk report from grade history and cumulative GPA.
 *
 * This convenience helper reuses the grouped at-risk module report, academic standing,
 * and semester risk history to produce a single reporting payload for APIs or UI pages.
 *
 * @param grades All grade records for a student.
 * @param cumulativeGPA Student cumulative GPA.
 * @returns Consolidated academic risk report and one-line summary.
 */
export function generateRiskReport(
  grades: IGrade[],
  cumulativeGPA: number
): FullRiskReport {
  const atRiskModules = getAtRiskModules(grades);
  const academicStanding = getAcademicStanding(
    cumulativeGPA,
    atRiskModules.totalAtRisk
  );
  const semesterRiskHistory = getRiskSummaryBySemester(grades);
  const overallRiskLevel = determineOverallRiskLevel(
    atRiskModules.totalAtRisk,
    cumulativeGPA
  );

  return {
    academicStanding,
    atRiskModules,
    semesterRiskHistory,
    overallRiskLevel,
    summary: buildRiskSummarySentence(
      atRiskModules,
      academicStanding,
      overallRiskLevel
    ),
  };
}

/* Verification scenarios
Scenario 1 - Clean student:
- 6 modules all status "pass", GPA 3.5
-> atRiskModules: totalAtRisk = 0, hasAnyRisk = false
-> academicStanding: "Good Standing", level = "good"
-> overallRiskLevel: "none"

Scenario 2 - Student with 1 pro-rata:
- 5 modules pass + 1 module pro-rata (CA = 30, Final = 25), GPA 2.8
-> proRataModules.length = 1, action = "Must repeat full module..."
-> academicStanding: "Satisfactory"
-> overallRiskLevel: "low"

Scenario 3 - Student with multiple risks:
- 3 pass + 2 pro-rata + 1 repeat, GPA 1.8
-> totalAtRisk = 3, hasProRata = true, hasRepeat = true
-> academicStanding: "Academic Probation" (GPA < 2.0)
-> overallRiskLevel: "high"

Scenario 4 - ProRata eligibility edge case:
- CA = 44, Final = 44 -> pro-rata (caDeficit = 1, finalDeficit = 1)
- CA = 45, Final = 44 -> repeat (caDeficit = 0, finalDeficit = 1)
- CA = 45, Final = 45 -> pass (caDeficit = 0, finalDeficit = 0)
- CA = 44, Final = 45 -> fail (caDeficit = 1, finalDeficit = 0)
*/
