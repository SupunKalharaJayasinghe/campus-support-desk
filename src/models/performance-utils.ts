import type { IGrade } from "@/models/Grade";

export interface SemesterMarksExtremum {
  moduleName: string;
  marks: number;
}

export interface SemesterSummary {
  semesterGPA: number;
  totalModules: number;
  passCount: number;
  failCount: number;
  proRataCount: number;
  repeatCount: number;
  averageMarks: number;
  highestMarks: SemesterMarksExtremum | null;
  lowestMarks: SemesterMarksExtremum | null;
}

export interface SemesterWiseGPAItem {
  academicYear: string;
  semester: number;
  gpa: number;
  modulesCount: number;
}

export type ProgressTrend =
  | "improving"
  | "declining"
  | "stable"
  | "insufficient_data";

export interface ProgressOverview {
  cumulativeGPA: number;
  classification: string;
  totalModulesTaken: number;
  totalModulesPassed: number;
  totalModulesFailed: number;
  totalProRata: number;
  totalRepeat: number;
  totalCreditsCompleted: number;
  totalCreditsRequired: number;
  progressPercentage: number;
  semesterWiseGPA: SemesterWiseGPAItem[];
  trend: ProgressTrend;
}

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
  return Number.isFinite(parsed) ? parsed : null;
}

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isGPAEligibleStatus(status: IGrade["status"]) {
  // GPA is based on completed module outcomes. "pro-rata" and "repeat"
  // represent incomplete or reassessment states and are excluded until finalized.
  return status === "pass" || status === "fail";
}

function getGPAEligibleGrades(grades: IGrade[]) {
  return grades.filter((grade) => isGPAEligibleStatus(grade.status));
}

function extractCredits(grade: IGrade) {
  const row = grade as unknown as Record<string, unknown>;
  const moduleOffering = asObject(row.moduleOfferingId);
  const moduleRecord = asObject(moduleOffering?.module);
  const nestedModuleId = asObject(moduleOffering?.moduleId);

  const candidates = [
    row.credits,
    row.creditHours,
    moduleOffering?.credits,
    moduleOffering?.creditHours,
    moduleRecord?.credits,
    moduleRecord?.creditHours,
    nestedModuleId?.credits,
    nestedModuleId?.creditHours,
  ];

  for (const candidate of candidates) {
    const parsed = readNumber(candidate);
    if (parsed !== null && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function calculateAverageGradePoint(grades: IGrade[]) {
  if (grades.length === 0) {
    return 0;
  }

  const total = grades.reduce((sum, grade) => sum + Number(grade.gradePoint || 0), 0);
  return roundToTwo(total / grades.length);
}

function calculateWeightedGradePoint(grades: IGrade[]) {
  if (grades.length === 0) {
    return 0;
  }

  const credits = grades.map((grade) => extractCredits(grade));
  const hasCompleteCredits = credits.every(
    (credit): credit is number => credit !== null && credit > 0
  );

  if (!hasCompleteCredits) {
    // TODO: Switch to weighted GPA (Σ(gradePoint × credits) / Σ(credits))
    // when credit hours are reliably available on Module/ModuleOffering.
    // Currently using simple average as fallback.
    return calculateAverageGradePoint(grades);
  }

  const weightedTotal = grades.reduce(
    (sum, grade, index) => sum + Number(grade.gradePoint || 0) * credits[index],
    0
  );
  const creditsTotal = credits.reduce((sum, credit) => sum + credit, 0);

  if (creditsTotal <= 0) {
    return 0;
  }

  return roundToTwo(weightedTotal / creditsTotal);
}

function calculateCreditsCompleted(grades: IGrade[]) {
  const passedGrades = grades.filter((grade) => grade.status === "pass");
  if (passedGrades.length === 0) {
    return 0;
  }

  const credits = passedGrades
    .map((grade) => extractCredits(grade))
    .filter((credit): credit is number => credit !== null && credit > 0);
  if (credits.length === 0) {
    return 0;
  }

  return roundToTwo(credits.reduce((sum, credit) => sum + credit, 0));
}

function parseAcademicYearStart(value: string) {
  const match = readString(value).match(/^(\d{4})/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareSemesterOrder(left: SemesterWiseGPAItem, right: SemesterWiseGPAItem) {
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

function getModuleName(grade: IGrade) {
  const row = grade as unknown as Record<string, unknown>;
  const moduleOffering = asObject(row.moduleOfferingId);
  const moduleRecord = asObject(moduleOffering?.module);
  const nestedModuleId = asObject(moduleOffering?.moduleId);

  const moduleNameCandidates = [
    row.moduleName,
    moduleOffering?.moduleName,
    moduleRecord?.name,
    nestedModuleId?.name,
  ];

  for (const candidate of moduleNameCandidates) {
    const normalized = readString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  // Module names are normally resolved by the API when grade payloads are populated.
  // Fall back to the moduleOfferingId string when only the raw grade record is available.
  const offeringId = readString(row.moduleOfferingId);
  return offeringId || "Unknown Module";
}

function calculateAverageMarks(grades: IGrade[]) {
  if (grades.length === 0) {
    return 0;
  }

  const totalMarks = grades.reduce((sum, grade) => sum + Number(grade.totalMarks || 0), 0);
  return roundToTwo(totalMarks / grades.length);
}

function calculateTrend(semesterWiseGPA: SemesterWiseGPAItem[]): ProgressTrend {
  if (semesterWiseGPA.length < 2) {
    return "insufficient_data";
  }

  const previous = semesterWiseGPA[semesterWiseGPA.length - 2];
  const latest = semesterWiseGPA[semesterWiseGPA.length - 1];
  const difference = roundToTwo(latest.gpa - previous.gpa);

  if (difference >= 0.1) {
    return "improving";
  }

  if (difference <= -0.1) {
    return "declining";
  }

  return "stable";
}

/**
 * Calculates GPA for a single semester.
 *
 * Completed pass/fail attempts are included in GPA. "pro-rata" and "repeat"
 * are excluded because they do not yet represent a finalized module outcome.
 * When credit metadata is available on every eligible grade, GPA is weighted by credits.
 * Otherwise, it falls back to a simple grade-point average.
 *
 * @param grades Grade records for one semester.
 * @returns Rounded semester GPA, or 0 when there are no GPA-eligible grades.
 */
export function calculateSemesterGPA(grades: IGrade[]): number {
  const eligibleGrades = getGPAEligibleGrades(grades);
  if (eligibleGrades.length === 0) {
    return 0;
  }

  return calculateWeightedGradePoint(eligibleGrades);
}

/**
 * Calculates cumulative GPA across all semesters.
 *
 * Completed pass/fail attempts are included in GPA. "pro-rata" and "repeat"
 * are excluded because they do not yet represent a finalized module outcome.
 * When credit metadata is available on every eligible grade, GPA is weighted by credits.
 * Otherwise, it falls back to a simple grade-point average.
 *
 * @param allGrades All grade records for a student.
 * @returns Rounded cumulative GPA, or 0 when there are no GPA-eligible grades.
 */
export function calculateCumulativeGPA(allGrades: IGrade[]): number {
  const eligibleGrades = getGPAEligibleGrades(allGrades);
  if (eligibleGrades.length === 0) {
    return 0;
  }

  return calculateWeightedGradePoint(eligibleGrades);
}

/**
 * Maps a GPA value to a degree classification.
 *
 * @param gpa GPA value to classify.
 * @returns Classification label for the supplied GPA.
 */
export function getGPAClassification(gpa: number): string {
  const normalizedGPA = Number.isFinite(gpa) ? Math.max(0, gpa) : 0;

  if (normalizedGPA >= 3.7) {
    return "First Class Honours";
  }

  if (normalizedGPA >= 3.3) {
    return "Second Class Upper Honours";
  }

  if (normalizedGPA >= 2.7) {
    return "Second Class Lower Honours";
  }

  if (normalizedGPA >= 2.0) {
    return "General Pass";
  }

  return "Fail";
}

/**
 * Builds a semester-level academic summary.
 *
 * Highest and lowest module names are resolved from populated grade payloads when available.
 * When grades are not populated with module details yet, the module offering id string is used
 * as a fallback placeholder until the API layer enriches the records.
 *
 * @param grades Grade records for one semester.
 * @returns Aggregated GPA, counts, and marks summary for the semester.
 */
export function getSemesterSummary(grades: IGrade[]): SemesterSummary {
  const totalModules = grades.length;
  const passCount = grades.filter((grade) => grade.status === "pass").length;
  const failCount = grades.filter((grade) => grade.status === "fail").length;
  const proRataCount = grades.filter((grade) => grade.status === "pro-rata").length;
  const repeatCount = grades.filter((grade) => grade.status === "repeat").length;

  const sortedByMarks = [...grades].sort(
    (left, right) => Number(left.totalMarks || 0) - Number(right.totalMarks || 0)
  );
  const lowestGrade = sortedByMarks[0] ?? null;
  const highestGrade = sortedByMarks[sortedByMarks.length - 1] ?? null;

  return {
    semesterGPA: calculateSemesterGPA(grades),
    totalModules,
    passCount,
    failCount,
    proRataCount,
    repeatCount,
    averageMarks: calculateAverageMarks(grades),
    highestMarks: highestGrade
      ? {
          moduleName: getModuleName(highestGrade),
          marks: roundToTwo(Number(highestGrade.totalMarks || 0)),
        }
      : null,
    lowestMarks: lowestGrade
      ? {
          moduleName: getModuleName(lowestGrade),
          marks: roundToTwo(Number(lowestGrade.totalMarks || 0)),
        }
      : null,
  };
}

/**
 * Builds a student-wide progress overview across all recorded semesters.
 *
 * Semester GPA values are grouped by academic year and semester, then sorted chronologically.
 * Trend is based on the difference between the latest two semester GPAs.
 *
 * @param allGrades All grade records for a student.
 * @param totalRequiredCredits Optional programme credit requirement used for progress percentage.
 * @returns High-level GPA, classification, counts, credit progress, and semester trend information.
 */
export function getProgressOverview(
  allGrades: IGrade[],
  totalRequiredCredits?: number
): ProgressOverview {
  const groups = new Map<string, { academicYear: string; semester: number; grades: IGrade[] }>();

  allGrades.forEach((grade) => {
    const semester = Number(grade.semester);
    const academicYear = readString(grade.academicYear);
    const key = `${academicYear}::${semester}`;
    const bucket = groups.get(key) ?? {
      academicYear,
      semester,
      grades: [],
    };

    bucket.grades.push(grade);
    groups.set(key, bucket);
  });

  const semesterWiseGPA = Array.from(groups.values())
    .map((group) => ({
      academicYear: group.academicYear,
      semester: group.semester,
      gpa: calculateSemesterGPA(group.grades),
      modulesCount: group.grades.length,
    }))
    .sort(compareSemesterOrder);

  const totalCreditsRequiredValue = Number(totalRequiredCredits);
  const totalCreditsRequiredResolved =
    Number.isFinite(totalCreditsRequiredValue) && totalCreditsRequiredValue > 0
      ? totalCreditsRequiredValue
      : 0;
  const totalCreditsCompleted = calculateCreditsCompleted(allGrades);
  const cumulativeGPA = calculateCumulativeGPA(allGrades);

  return {
    cumulativeGPA,
    classification: getGPAClassification(cumulativeGPA),
    totalModulesTaken: allGrades.length,
    totalModulesPassed: allGrades.filter((grade) => grade.status === "pass").length,
    totalModulesFailed: allGrades.filter((grade) => grade.status === "fail").length,
    totalProRata: allGrades.filter((grade) => grade.status === "pro-rata").length,
    totalRepeat: allGrades.filter((grade) => grade.status === "repeat").length,
    totalCreditsCompleted,
    totalCreditsRequired: totalCreditsRequiredResolved,
    progressPercentage:
      totalCreditsRequiredResolved > 0
        ? roundToTwo((totalCreditsCompleted / totalCreditsRequiredResolved) * 100)
        : 0,
    semesterWiseGPA,
    trend: calculateTrend(semesterWiseGPA),
  };
}

/* Verification scenarios
Scenario 1 - Normal semester:
- Module A: gradePoint 4.0, status "pass"
- Module B: gradePoint 3.3, status "pass"
- Module C: gradePoint 2.7, status "pass"
- Module D: gradePoint 0.0, status "fail"
- Semester GPA = (4.0 + 3.3 + 2.7 + 0.0) / 4 = 2.5 when no credits are attached

Scenario 2 - Empty grades:
- Semester GPA = 0
- Cumulative GPA = 0
- Classification = "Fail"
- Trend = "insufficient_data"

Scenario 3 - Two semesters with improving trend:
- Semester 1 GPA = 2.5
- Semester 2 GPA = 3.2
- Trend = "improving" because the difference is 0.7

Scenario 4 - Pro-rata and repeat modules:
- 6 modules total: 4 pass, 1 pro-rata, 1 repeat
- passCount = 4
- failCount = 0
- proRataCount = 1
- repeatCount = 1
- totalModulesTaken = 6
*/
