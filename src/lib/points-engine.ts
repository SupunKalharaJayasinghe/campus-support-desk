import mongoose, { Types } from "mongoose";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/lib/mongoose";
import { findModuleById } from "@/lib/module-store";
import {
  calculateCumulativeGPA,
  calculateSemesterGPA,
} from "@/lib/performance-utils";
import type { IGrade } from "@/models/Grade";
import { GradeModel } from "@/models/Grade";
import type {
  ICategoryBreakdown,
  IGamificationPoints,
} from "@/models/GamificationPoints";
import { GamificationPointsModel } from "@/models/GamificationPoints";
import { ModuleModel } from "@/models/Module";
import { StudentModel } from "@/models/Student";

export const XP_VALUES = {
  MODULE_PASSED: 10,
  HIGH_SCORE: 25,
  PERFECT_SCORE: 50,
  SEMESTER_GPA_ABOVE_3: 30,
  SEMESTER_GPA_ABOVE_3_5: 50,
  SEMESTER_ALL_PASSED: 40,
  FIRST_CLASS_GPA: 75,
  GPA_IMPROVEMENT: 20,
  QUIZ_COMPLETED: 5,
  QUIZ_ON_TIME: 10,
  QUIZ_HIGH_SCORE: 25,
  QUIZ_PERFECT_SCORE: 50,
  MILESTONE_100: 20,
  MILESTONE_300: 40,
  MILESTONE_600: 60,
  STREAK_BONUS: 30,
} as const;

type PointsAction = IGamificationPoints["action"];
type PointsCategory = IGamificationPoints["category"];
type ReferenceType = NonNullable<IGamificationPoints["referenceType"]>;
type AwardedBy = IGamificationPoints["awardedBy"];

interface AwardedPoint {
  action: string;
  xpPoints: number;
  reason: string;
}

export interface AwardResult {
  success: boolean;
  studentId: string;
  pointsAwarded: AwardedPoint[];
  totalPointsAwarded: number;
  newTotalXP: number;
  milestonesUnlocked: string[];
  errors: string[];
}

export interface PointsSummary {
  studentId: string;
  totalXP: number;
  categoryBreakdown: ICategoryBreakdown[];
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
}

interface ModuleMeta {
  moduleCode: string;
  moduleName: string;
  credits?: number;
}

interface CreatePointsEntryInput {
  studentId: Types.ObjectId;
  action: PointsAction;
  xpPoints: number;
  reason: string;
  category: PointsCategory;
  referenceType?: ReferenceType;
  referenceId?: Types.ObjectId;
  moduleOfferingId?: Types.ObjectId;
  academicYear?: string;
  semester?: 1 | 2;
  metadata?: Record<string, unknown> | null;
  awardedBy: AwardedBy;
}

interface UpsertAwardResult {
  awarded: boolean;
  error?: string;
}

const MILESTONE_CONFIG = [
  { threshold: 100, xpPoints: XP_VALUES.MILESTONE_100, label: "100 XP Milestone" },
  { threshold: 300, xpPoints: XP_VALUES.MILESTONE_300, label: "300 XP Milestone" },
  { threshold: 600, xpPoints: XP_VALUES.MILESTONE_600, label: "600 XP Milestone" },
] as const;

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

function toObjectId(value: string | Types.ObjectId | null | undefined) {
  if (value instanceof Types.ObjectId) {
    return value;
  }

  const normalized = String(value ?? "").trim();
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) {
    return null;
  }

  return new Types.ObjectId(normalized);
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

function buildAcademicYear(startYear: number) {
  return `${startYear}/${startYear + 1}`;
}

function getPreviousAcademicPeriod(academicYear: string, semester: 1 | 2) {
  if (semester === 2) {
    return {
      academicYear,
      semester: 1 as const,
    };
  }

  const startYear = parseAcademicYearStart(academicYear);
  if (startYear === null) {
    return null;
  }

  return {
    academicYear: buildAcademicYear(startYear - 1),
    semester: 2 as const,
  };
}

function buildSemesterKey(academicYear: string, semester: number) {
  return `${collapseSpaces(academicYear)}::${semester}`;
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

function isMongoDuplicateKeyError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const row = error as { code?: unknown };
  return Number(row.code) === 11000;
}

function buildEmptyAwardResult(studentId = ""): AwardResult {
  return {
    success: true,
    studentId,
    pointsAwarded: [],
    totalPointsAwarded: 0,
    newTotalXP: 0,
    milestonesUnlocked: [],
    errors: [],
  };
}

function buildEmptyPointsSummary(studentId = ""): PointsSummary {
  return {
    studentId,
    totalXP: 0,
    categoryBreakdown: [],
    recentActivity: [],
    activityCount: 0,
    pointsThisMonth: 0,
    pointsThisSemester: 0,
    averagePointsPerModule: 0,
  };
}

function pushAward(result: AwardResult, action: string, xpPoints: number, reason: string) {
  result.pointsAwarded.push({
    action,
    xpPoints,
    reason,
  });
  result.totalPointsAwarded = result.pointsAwarded.reduce(
    (sum, item) => sum + Number(item.xpPoints || 0),
    0
  );
}

async function ensureDatabaseConnection() {
  return await connectMongoose().catch(() => null);
}

async function resolveModuleMeta(moduleId: string) {
  const fromStore = moduleId ? findModuleById(moduleId) : null;
  if (fromStore) {
    return {
      moduleCode: collapseSpaces(fromStore.code),
      moduleName: collapseSpaces(fromStore.name),
      credits: Number(fromStore.credits || 0) || undefined,
    };
  }

  if (!moduleId) {
    return null;
  }

  const byMongoId =
    mongoose.Types.ObjectId.isValid(moduleId)
      ? await ModuleModel.findById(moduleId)
          .select("code name credits")
          .lean()
          .exec()
          .catch(() => null)
      : null;
  const byCode =
    byMongoId ??
    (await ModuleModel.findOne({ code: moduleId.toUpperCase() })
      .select("code name credits")
      .lean()
      .exec()
      .catch(() => null));
  const row = asObject(byCode);

  if (!row) {
    return null;
  }

  return {
    moduleCode: collapseSpaces(row.code),
    moduleName: collapseSpaces(row.name),
    credits: Number(row.credits ?? 0) || undefined,
  };
}

async function enrichGradeRow(row: unknown) {
  const grade = asObject(row);
  if (!grade) {
    return null;
  }

  const offering = asObject(grade.moduleOfferingId);
  const moduleId = collapseSpaces(offering?.moduleId);
  const moduleMeta = await resolveModuleMeta(moduleId);

  return {
    ...grade,
    moduleOfferingId: offering
      ? {
          ...offering,
          _id: readId(offering._id ?? offering.id) || null,
          id: readId(offering._id ?? offering.id) || null,
          moduleId,
          moduleCode: collapseSpaces(offering.moduleCode) || moduleMeta?.moduleCode || moduleId,
          moduleName:
            collapseSpaces(offering.moduleName) ||
            moduleMeta?.moduleName ||
            collapseSpaces(offering.moduleCode) ||
            moduleId ||
            "Unknown Module",
          credits: moduleMeta?.credits,
          module: moduleMeta
            ? {
                code: moduleMeta.moduleCode,
                name: moduleMeta.moduleName,
                credits: moduleMeta.credits,
              }
            : null,
        }
      : grade.moduleOfferingId,
  };
}

async function fetchEnrichedGrades(query: Record<string, unknown>) {
  const rows = (await GradeModel.find(query)
    .populate({
      path: "moduleOfferingId",
      select: "moduleId intakeId termCode status degreeProgramId facultyId",
    })
    .sort({ academicYear: 1, semester: 1, createdAt: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const enrichedRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const enriched = await enrichGradeRow(row);
    if (enriched) {
      enrichedRows.push(enriched);
    }
  }

  return enrichedRows;
}

function getGradeObjectId(grade: Record<string, unknown>) {
  return toObjectId(readId(grade._id ?? grade.id));
}

function getStudentObjectIdFromGrade(grade: Record<string, unknown>) {
  return toObjectId(readId(grade.studentId));
}

function getModuleOfferingObjectIdFromGrade(grade: Record<string, unknown>) {
  return toObjectId(readId(grade.moduleOfferingId));
}

function getModuleMetaFromGrade(grade: Record<string, unknown>): ModuleMeta {
  const offering = asObject(grade.moduleOfferingId);
  const nestedModule = asObject(offering?.module);

  return {
    moduleCode:
      collapseSpaces(offering?.moduleCode) ||
      collapseSpaces(nestedModule?.code) ||
      collapseSpaces(offering?.moduleId) ||
      "N/A",
    moduleName:
      collapseSpaces(offering?.moduleName) ||
      collapseSpaces(nestedModule?.name) ||
      collapseSpaces(offering?.moduleId) ||
      "Unknown Module",
    credits: Number(offering?.credits ?? nestedModule?.credits ?? 0) || undefined,
  };
}

function buildModuleLabel(meta: ModuleMeta) {
  if (meta.moduleCode && meta.moduleName && meta.moduleCode !== meta.moduleName) {
    return `${meta.moduleCode} - ${meta.moduleName}`;
  }

  return meta.moduleName || meta.moduleCode || "Unknown Module";
}

async function refreshTotalXP(result: AwardResult, studentId: Types.ObjectId) {
  result.newTotalXP = await GamificationPointsModel.getStudentTotalXP(studentId).catch(
    () => 0
  );
  result.success = result.errors.length === 0;
}

async function createPointsEntry(input: CreatePointsEntryInput) {
  const created = await GamificationPointsModel.create({
    studentId: input.studentId,
    action: input.action,
    xpPoints: input.xpPoints,
    reason: input.reason,
    category: input.category,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    moduleOfferingId: input.moduleOfferingId,
    academicYear: input.academicYear,
    semester: input.semester,
    metadata: input.metadata ?? null,
    awardedBy: input.awardedBy,
    isRevoked: false,
    revokedAt: null,
    revokedReason: "",
  });

  return created.toObject() as IGamificationPoints;
}

async function upsertReferenceAward(
  result: AwardResult,
  query: {
    studentId: Types.ObjectId;
    action: PointsAction;
    referenceId: Types.ObjectId;
  },
  entry: CreatePointsEntryInput
) {
  try {
    const hasExisting = await GamificationPointsModel.hasActionForReference(
      query.studentId,
      query.action,
      query.referenceId
    ).catch(() => false);

    if (hasExisting) {
      const active = await GamificationPointsModel.findOne({
        studentId: query.studentId,
        action: query.action,
        referenceId: query.referenceId,
        isRevoked: false,
      })
        .lean()
        .exec()
        .catch(() => null);
      if (active) {
        return { awarded: false } satisfies UpsertAwardResult;
      }

      const revived = await GamificationPointsModel.findOneAndUpdate(
        {
          studentId: query.studentId,
          action: query.action,
          referenceId: query.referenceId,
          isRevoked: true,
        },
        {
          $set: {
            xpPoints: entry.xpPoints,
            reason: entry.reason,
            category: entry.category,
            referenceType: entry.referenceType,
            moduleOfferingId: entry.moduleOfferingId,
            academicYear: entry.academicYear,
            semester: entry.semester,
            metadata: entry.metadata ?? null,
            awardedBy: entry.awardedBy,
            isRevoked: false,
            revokedAt: null,
            revokedReason: "",
          },
        },
        {
          new: true,
          sort: { createdAt: -1 },
        }
      )
        .lean()
        .exec()
        .catch(() => null);

      if (revived) {
        pushAward(result, entry.action, entry.xpPoints, entry.reason);
        return { awarded: true } satisfies UpsertAwardResult;
      }
    }

    await createPointsEntry(entry);
    pushAward(result, entry.action, entry.xpPoints, entry.reason);
    return { awarded: true } satisfies UpsertAwardResult;
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return { awarded: false } satisfies UpsertAwardResult;
    }

    const message =
      error instanceof Error ? error.message : "Failed to persist points entry";
    result.errors.push(message);
    return { awarded: false, error: message } satisfies UpsertAwardResult;
  }
}

async function upsertManualAward(
  result: AwardResult,
  query: Record<string, unknown>,
  entry: CreatePointsEntryInput
) {
  try {
    const active = await GamificationPointsModel.findOne({
      ...query,
      isRevoked: false,
    })
      .lean()
      .exec()
      .catch(() => null);
    if (active) {
      return { awarded: false } satisfies UpsertAwardResult;
    }

    const revived = await GamificationPointsModel.findOneAndUpdate(
      {
        ...query,
        isRevoked: true,
      },
      {
        $set: {
          xpPoints: entry.xpPoints,
          reason: entry.reason,
          category: entry.category,
          referenceType: entry.referenceType,
          referenceId: entry.referenceId,
          moduleOfferingId: entry.moduleOfferingId,
          academicYear: entry.academicYear,
          semester: entry.semester,
          metadata: entry.metadata ?? null,
          awardedBy: entry.awardedBy,
          isRevoked: false,
          revokedAt: null,
          revokedReason: "",
        },
      },
      {
        new: true,
        sort: { createdAt: -1 },
      }
    )
      .lean()
      .exec()
      .catch(() => null);

    if (revived) {
      pushAward(result, entry.action, entry.xpPoints, entry.reason);
      return { awarded: true } satisfies UpsertAwardResult;
    }

    await createPointsEntry(entry);
    pushAward(result, entry.action, entry.xpPoints, entry.reason);
    return { awarded: true } satisfies UpsertAwardResult;
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return { awarded: false } satisfies UpsertAwardResult;
    }

    const message =
      error instanceof Error ? error.message : "Failed to persist points entry";
    result.errors.push(message);
    return { awarded: false, error: message } satisfies UpsertAwardResult;
  }
}

function groupGradesBySemester(grades: IGrade[]) {
  const groups = new Map<string, IGrade[]>();

  grades.forEach((grade) => {
    const key = buildSemesterKey(grade.academicYear, Number(grade.semester || 0));
    const bucket = groups.get(key) ?? [];
    bucket.push(grade);
    groups.set(key, bucket);
  });

  return groups;
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
    const key = buildSemesterKey(currentAcademicYear, currentSemester);
    const grades = semesterGroups.get(key);
    if (!grades || !isGoodSemester(grades)) {
      break;
    }

    streakLength += 1;
    const previous = getPreviousAcademicPeriod(currentAcademicYear, currentSemester);
    if (!previous) {
      break;
    }

    currentAcademicYear = previous.academicYear;
    currentSemester = previous.semester;
  }

  return streakLength;
}

async function checkAndAwardMilestonesInternal(
  studentId: Types.ObjectId,
  result?: AwardResult
) {
  const unlocked: string[] = [];

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const currentTotalXP = await GamificationPointsModel.getStudentTotalXP(studentId).catch(
      () => 0
    );
    let awardedNewMilestone = false;

    for (const milestone of MILESTONE_CONFIG) {
      if (currentTotalXP < milestone.threshold) {
        continue;
      }

      const reason = `Reached ${milestone.threshold} XP milestone!`;
      const milestoneResult = result ?? buildEmptyAwardResult(readId(studentId));
      const upsertResult = await upsertManualAward(
        milestoneResult,
        {
          studentId,
          action: "milestone_reached",
          "metadata.milestone": milestone.threshold,
        },
        {
          studentId,
          action: "milestone_reached",
          xpPoints: milestone.xpPoints,
          reason,
          category: "milestone",
          referenceType: "Milestone",
          metadata: {
            milestone: milestone.threshold,
            totalXPAtTime: currentTotalXP,
          },
          awardedBy: "system",
        }
      );

      if (upsertResult.awarded) {
        unlocked.push(milestone.label);
        awardedNewMilestone = true;
        break;
      }
    }

    if (!awardedNewMilestone) {
      break;
    }
  }

  return unlocked;
}

async function awardPointsForGradeRecord(
  gradeRecord: Record<string, unknown>,
  result: AwardResult,
  options?: { skipMilestones?: boolean }
) {
  const studentObjectId = getStudentObjectIdFromGrade(gradeRecord);
  const gradeObjectId = getGradeObjectId(gradeRecord);
  if (!studentObjectId || !gradeObjectId) {
    result.errors.push("Grade record is missing required identifiers");
    return;
  }

  const moduleOfferingObjectId = getModuleOfferingObjectIdFromGrade(gradeRecord) ?? undefined;
  const academicYear = collapseSpaces(gradeRecord.academicYear);
  const semester = Number(gradeRecord.semester) === 2 ? 2 : 1;
  const totalMarks = Number(gradeRecord.totalMarks ?? 0);
  const gradeLetter = collapseSpaces(gradeRecord.gradeLetter);
  const gradePoint = Number(gradeRecord.gradePoint ?? 0);
  const status = collapseSpaces(gradeRecord.status);
  const moduleMeta = getModuleMetaFromGrade(gradeRecord);
  const moduleLabel = buildModuleLabel(moduleMeta);

  const checks: Array<{
    shouldAward: boolean;
    action: PointsAction;
    xpPoints: number;
    reason: string;
  }> = [
    {
      shouldAward: status === "pass",
      action: "module_passed",
      xpPoints: XP_VALUES.MODULE_PASSED,
      reason: `Passed module ${moduleLabel}`,
    },
    {
      shouldAward: totalMarks >= 80,
      action: "high_score",
      xpPoints: XP_VALUES.HIGH_SCORE,
      reason: `Scored ${roundToTwo(totalMarks)}% in ${moduleLabel} (above 80% threshold)`,
    },
    {
      shouldAward: totalMarks === 100,
      action: "perfect_score",
      xpPoints: XP_VALUES.PERFECT_SCORE,
      reason: `Achieved a perfect score in ${moduleLabel}`,
    },
  ];

  for (const check of checks) {
    if (!check.shouldAward) {
      continue;
    }

    await upsertReferenceAward(
      result,
      {
        studentId: studentObjectId,
        action: check.action,
        referenceId: gradeObjectId,
      },
      {
        studentId: studentObjectId,
        action: check.action,
        xpPoints: check.xpPoints,
        reason: check.reason,
        category: "academic",
        referenceType: "Grade",
        referenceId: gradeObjectId,
        moduleOfferingId: moduleOfferingObjectId,
        academicYear,
        semester,
        metadata: {
          totalMarks,
          gradeLetter,
          gradePoint,
          moduleName: moduleMeta.moduleName,
          moduleCode: moduleMeta.moduleCode,
        },
        awardedBy: "system",
      }
    );
  }

  if (!options?.skipMilestones) {
    const milestonesUnlocked = await checkAndAwardMilestonesInternal(
      studentObjectId,
      result
    );
    result.milestonesUnlocked.push(...milestonesUnlocked);
  }
}

async function awardPointsForSemesterContext(
  studentId: Types.ObjectId,
  academicYear: string,
  semester: 1 | 2,
  allGrades: IGrade[],
  result: AwardResult,
  options?: { skipMilestones?: boolean }
) {
  const semesterGroups = groupGradesBySemester(allGrades);
  const currentGrades = semesterGroups.get(buildSemesterKey(academicYear, semester)) ?? [];
  if (currentGrades.length === 0) {
    result.errors.push("No grades found for the specified semester");
    return;
  }

  const semesterGPA = calculateSemesterGPA(currentGrades);
  const allPassed = currentGrades.every((grade) => grade.status === "pass");
  const previousPeriod = getPreviousAcademicPeriod(academicYear, semester);
  const previousGrades = previousPeriod
    ? semesterGroups.get(
        buildSemesterKey(previousPeriod.academicYear, previousPeriod.semester)
      ) ?? []
    : [];
  const previousGPA =
    previousGrades.length > 0 ? calculateSemesterGPA(previousGrades) : null;
  const cumulativeGPA = calculateCumulativeGPA(allGrades);
  const streakLength = calculateStreakLength(semesterGroups, academicYear, semester);
  const semesterLabel = `${academicYear} Semester ${semester}`;

  // Semester achievements do not have a natural ObjectId reference, so duplicate
  // prevention is keyed by student + action + academicYear + semester.
  const semesterChecks: Array<{
    shouldAward: boolean;
    action: PointsAction;
    xpPoints: number;
    reason: string;
    metadata?: Record<string, unknown>;
  }> = [
    {
      shouldAward: semesterGPA >= 3.0,
      action: "semester_gpa_above_3",
      xpPoints: XP_VALUES.SEMESTER_GPA_ABOVE_3,
      reason: `Achieved semester GPA ${semesterGPA.toFixed(2)} in ${semesterLabel}`,
      metadata: { semesterGPA },
    },
    {
      shouldAward: semesterGPA >= 3.5,
      action: "semester_gpa_above_3.5",
      xpPoints: XP_VALUES.SEMESTER_GPA_ABOVE_3_5,
      reason: `Achieved high semester GPA ${semesterGPA.toFixed(2)} in ${semesterLabel}`,
      metadata: { semesterGPA },
    },
    {
      shouldAward: allPassed,
      action: "semester_all_passed",
      xpPoints: XP_VALUES.SEMESTER_ALL_PASSED,
      reason: `Passed all ${currentGrades.length} modules in ${semesterLabel}`,
      metadata: { modulesPassed: currentGrades.length },
    },
    {
      shouldAward:
        previousGPA !== null && roundToTwo(semesterGPA - previousGPA) >= 0.1,
      action: "gpa_improvement",
      xpPoints: XP_VALUES.GPA_IMPROVEMENT,
      reason:
        previousGPA === null
          ? ""
          : `Improved GPA from ${previousGPA.toFixed(2)} to ${semesterGPA.toFixed(2)} in ${semesterLabel}`,
      metadata:
        previousGPA === null
          ? undefined
          : {
              previousGPA,
              currentGPA: semesterGPA,
              improvement: roundToTwo(semesterGPA - previousGPA),
            },
    },
  ];

  for (const check of semesterChecks) {
    if (!check.shouldAward) {
      continue;
    }

    await upsertManualAward(
      result,
      {
        studentId,
        action: check.action,
        academicYear,
        semester,
      },
      {
        studentId,
        action: check.action,
        xpPoints: check.xpPoints,
        reason: check.reason,
        category: "academic",
        referenceType: "Manual",
        academicYear,
        semester,
        metadata: {
          academicYear,
          semester,
          ...(check.metadata ?? {}),
        },
        awardedBy: "system",
      }
    );
  }

  if (cumulativeGPA >= 3.7) {
    await upsertManualAward(
      result,
      {
        studentId,
        action: "first_class_gpa",
      },
      {
        studentId,
        action: "first_class_gpa",
        xpPoints: XP_VALUES.FIRST_CLASS_GPA,
        reason: `Reached First Class cumulative GPA of ${cumulativeGPA.toFixed(2)}`,
        category: "academic",
        referenceType: "Manual",
        academicYear,
        semester,
        metadata: {
          cumulativeGPA,
          achievedInAcademicYear: academicYear,
          achievedInSemester: semester,
        },
        awardedBy: "system",
      }
    );
  }

  if (streakLength >= 2) {
    await upsertManualAward(
      result,
      {
        studentId,
        action: "streak_bonus",
        academicYear,
        semester,
      },
      {
        studentId,
        action: "streak_bonus",
        xpPoints: XP_VALUES.STREAK_BONUS,
        reason: `Maintained a ${streakLength}-semester good-performance streak through ${semesterLabel}`,
        category: "bonus",
        referenceType: "Manual",
        academicYear,
        semester,
        metadata: {
          streakLength,
          semesterGPA,
        },
        awardedBy: "system",
      }
    );
  }

  if (!options?.skipMilestones) {
    const milestonesUnlocked = await checkAndAwardMilestonesInternal(studentId, result);
    result.milestonesUnlocked.push(...milestonesUnlocked);
  }
}

/**
 * Awards grade-level XP for a single grade record.
 *
 * Call this after a grade is created or updated. It evaluates pass/high-score/perfect-score
 * achievements, writes new ledger entries when applicable, and then checks for milestone unlocks.
 *
 * @param gradeId Grade record id to evaluate.
 * @returns Award result with awarded actions, totals, milestones, and collected errors.
 */
export async function awardPointsForGrade(gradeId: string): Promise<AwardResult> {
  const result = buildEmptyAwardResult();

  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      result.errors.push("Database connection is not configured");
      result.success = false;
      return result;
    }

    const gradeObjectId = toObjectId(gradeId);
    if (!gradeObjectId) {
      result.errors.push("Invalid grade ID");
      result.success = false;
      return result;
    }

    const rows = await fetchEnrichedGrades({ _id: gradeObjectId });
    const gradeRecord = rows[0] ?? null;
    if (!gradeRecord) {
      result.errors.push("Grade not found");
      result.success = false;
      return result;
    }

    const studentObjectId = getStudentObjectIdFromGrade(gradeRecord);
    if (!studentObjectId) {
      result.errors.push("Grade record is missing a valid student ID");
      result.success = false;
      return result;
    }

    result.studentId = readId(studentObjectId);
    await awardPointsForGradeRecord(gradeRecord, result);
    await refreshTotalXP(result, studentObjectId);
    return result;
  } catch (error) {
    console.error("awardPointsForGrade error", error);
    result.errors.push(error instanceof Error ? error.message : "Failed to award grade points");
    result.success = false;
    return result;
  }
}

/**
 * Awards semester-level XP for a student after semester grades are finalized.
 *
 * Call this after all grades for a semester have been entered. It evaluates semester GPA,
 * all-pass status, GPA improvement, cumulative first-class achievement, streak bonus, and
 * milestone unlocks.
 *
 * @param studentId Student record id.
 * @param academicYear Academic year label, for example "2024/2025".
 * @param semester Semester number (1 or 2).
 * @returns Award result with awarded actions, totals, milestones, and collected errors.
 */
export async function awardPointsForSemester(
  studentId: string,
  academicYear: string,
  semester: number
): Promise<AwardResult> {
  const normalizedStudentId = collapseSpaces(studentId);
  const normalizedAcademicYear = collapseSpaces(academicYear);
  const normalizedSemester = semester === 2 ? 2 : semester === 1 ? 1 : null;
  const result = buildEmptyAwardResult(normalizedStudentId);

  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      result.errors.push("Database connection is not configured");
      result.success = false;
      return result;
    }

    const studentObjectId = toObjectId(normalizedStudentId);
    if (!studentObjectId) {
      result.errors.push("Invalid student ID");
      result.success = false;
      return result;
    }

    if (!normalizedAcademicYear) {
      result.errors.push("Academic year is required");
      result.success = false;
      return result;
    }

    if (normalizedSemester === null) {
      result.errors.push("Semester must be 1 or 2");
      result.success = false;
      return result;
    }

    const allGrades = (await fetchEnrichedGrades({
      studentId: studentObjectId,
    })) as unknown as IGrade[];

    await awardPointsForSemesterContext(
      studentObjectId,
      normalizedAcademicYear,
      normalizedSemester,
      allGrades,
      result
    );
    await refreshTotalXP(result, studentObjectId);
    return result;
  } catch (error) {
    console.error("awardPointsForSemester error", error);
    result.errors.push(
      error instanceof Error ? error.message : "Failed to award semester points"
    );
    result.success = false;
    return result;
  }
}

/**
 * Checks whether a student has crossed any XP milestones and awards bonuses.
 *
 * This is normally called internally after other point-award flows. It can also be called
 * directly when only milestone evaluation is needed.
 *
 * @param studentId Student record id.
 * @returns Array of newly unlocked milestone labels.
 */
export async function checkAndAwardMilestones(studentId: string): Promise<string[]> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return [];
    }

    const studentObjectId = toObjectId(studentId);
    if (!studentObjectId) {
      return [];
    }

    return await checkAndAwardMilestonesInternal(studentObjectId);
  } catch (error) {
    console.error("checkAndAwardMilestones error", error);
    return [];
  }
}

/**
 * Awards custom manual points to a student.
 *
 * Use this for admin or lecturer initiated awards or penalties. Negative values are allowed
 * for penalties. Milestones are checked after the manual entry is created.
 *
 * @param studentId Student record id.
 * @param xpPoints Number of XP points to apply.
 * @param reason Human-readable reason for the manual adjustment.
 * @param awardedBy Role triggering the award.
 * @param metadata Optional context object stored with the ledger entry.
 * @returns Award result for the custom points operation.
 */
export async function awardCustomPoints(
  studentId: string,
  xpPoints: number,
  reason: string,
  awardedBy: "admin" | "lecturer",
  metadata?: Record<string, unknown>
): Promise<AwardResult> {
  const normalizedStudentId = collapseSpaces(studentId);
  const normalizedReason = collapseSpaces(reason);
  const result = buildEmptyAwardResult(normalizedStudentId);

  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      result.errors.push("Database connection is not configured");
      result.success = false;
      return result;
    }

    const studentObjectId = toObjectId(normalizedStudentId);
    if (!studentObjectId) {
      result.errors.push("Invalid student ID");
      result.success = false;
      return result;
    }

    if (!normalizedReason) {
      result.errors.push("Reason is required");
      result.success = false;
      return result;
    }

    if (!Number.isFinite(xpPoints) || xpPoints < -100 || xpPoints > 500) {
      result.errors.push("xpPoints must be between -100 and 500");
      result.success = false;
      return result;
    }

    const studentExists = Boolean(
      await StudentModel.exists({ _id: studentObjectId }).catch(() => null)
    );
    if (!studentExists) {
      result.errors.push("Student not found");
      result.success = false;
      return result;
    }

    await createPointsEntry({
      studentId: studentObjectId,
      action: "custom",
      xpPoints,
      reason: normalizedReason,
      category: xpPoints < 0 ? "penalty" : "custom",
      referenceType: "Manual",
      metadata: metadata ?? {},
      awardedBy,
    });
    pushAward(result, "custom", xpPoints, normalizedReason);

    const milestonesUnlocked = await checkAndAwardMilestonesInternal(studentObjectId, result);
    result.milestonesUnlocked.push(...milestonesUnlocked);
    await refreshTotalXP(result, studentObjectId);
    return result;
  } catch (error) {
    console.error("awardCustomPoints error", error);
    result.errors.push(
      error instanceof Error ? error.message : "Failed to award custom points"
    );
    result.success = false;
    return result;
  }
}

/**
 * Soft-revokes a single points ledger entry.
 *
 * This does not delete the ledger row. It marks the entry as revoked so that it is excluded
 * from XP totals and summaries.
 *
 * @param ledgerEntryId Ledger entry id to revoke.
 * @param reason Reason for revocation.
 * @returns Operation result message.
 */
export async function revokePoints(
  ledgerEntryId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return {
        success: false,
        message: "Database connection is not configured",
      };
    }

    const entryObjectId = toObjectId(ledgerEntryId);
    if (!entryObjectId) {
      return {
        success: false,
        message: "Points entry not found",
      };
    }

    const current = await GamificationPointsModel.findById(entryObjectId).exec();
    if (!current) {
      return {
        success: false,
        message: "Points entry not found",
      };
    }

    if (current.isRevoked) {
      return {
        success: false,
        message: "Points entry already revoked",
      };
    }

    current.isRevoked = true;
    current.revokedAt = new Date();
    current.revokedReason = collapseSpaces(reason) || "Points revoked";
    await current.save();

    return {
      success: true,
      message: "Points entry revoked successfully",
    };
  } catch (error) {
    console.error("revokePoints error", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to revoke points entry",
    };
  }
}

/**
 * Soft-revokes every active points entry that was awarded for a specific grade.
 *
 * Use this when a grade is deleted or materially changed and its previously awarded grade-level
 * achievements should no longer count.
 *
 * @param gradeId Grade record id whose related point entries should be revoked.
 * @param reason Revocation reason stored on each affected ledger entry.
 * @returns Revocation result and the number of affected entries.
 */
export async function revokePointsForGrade(
  gradeId: string,
  reason: string
): Promise<{ success: boolean; revokedCount: number }> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return { success: false, revokedCount: 0 };
    }

    const gradeObjectId = toObjectId(gradeId);
    if (!gradeObjectId) {
      return { success: false, revokedCount: 0 };
    }

    const updateResult = await GamificationPointsModel.updateMany(
      {
        referenceId: gradeObjectId,
        referenceType: "Grade",
        isRevoked: false,
      },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: collapseSpaces(reason) || "Points revoked for grade",
        },
      }
    ).exec();

    return {
      success: true,
      revokedCount: Number(updateResult.modifiedCount ?? 0),
    };
  } catch (error) {
    console.error("revokePointsForGrade error", error);
    return { success: false, revokedCount: 0 };
  }
}

/**
 * Recalculates every automatically-derived point entry for a student from scratch.
 *
 * This is an expensive admin-grade recovery operation. It should not be used in the regular
 * award flow. Existing active ledger entries are revoked first, then grade awards, semester
 * awards, and milestones are rebuilt from current academic data.
 *
 * @param studentId Student record id.
 * @returns Comprehensive award result for the recalculation process.
 */
export async function recalculateStudentPoints(
  studentId: string
): Promise<AwardResult> {
  const normalizedStudentId = collapseSpaces(studentId);
  const result = buildEmptyAwardResult(normalizedStudentId);

  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      result.errors.push("Database connection is not configured");
      result.success = false;
      return result;
    }

    const studentObjectId = toObjectId(normalizedStudentId);
    if (!studentObjectId) {
      result.errors.push("Invalid student ID");
      result.success = false;
      return result;
    }

    await GamificationPointsModel.updateMany(
      {
        studentId: studentObjectId,
        isRevoked: false,
      },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: "System recalculation",
        },
      }
    ).exec();

    const allGradeRows = await fetchEnrichedGrades({ studentId: studentObjectId });
    const allGrades = allGradeRows as unknown as IGrade[];

    for (const gradeRow of allGradeRows) {
      await awardPointsForGradeRecord(gradeRow, result, { skipMilestones: true });
    }

    const seenSemesters = new Set<string>();
    const orderedSemesters = allGrades
      .map((grade) => ({
        academicYear: collapseSpaces(grade.academicYear),
        semester: Number(grade.semester) === 2 ? 2 : 1,
      }))
      .filter((item) => {
        const key = buildSemesterKey(item.academicYear, item.semester);
        if (seenSemesters.has(key)) {
          return false;
        }
        seenSemesters.add(key);
        return true;
      })
      .sort(compareAcademicPeriods);

    for (const semester of orderedSemesters) {
      await awardPointsForSemesterContext(
        studentObjectId,
        semester.academicYear,
        semester.semester as 1 | 2,
        allGrades,
        result,
        { skipMilestones: true }
      );
    }

    const milestonesUnlocked = await checkAndAwardMilestonesInternal(studentObjectId, result);
    result.milestonesUnlocked.push(...milestonesUnlocked);
    await refreshTotalXP(result, studentObjectId);
    return result;
  } catch (error) {
    console.error("recalculateStudentPoints error", error);
    result.errors.push(
      error instanceof Error ? error.message : "Failed to recalculate points"
    );
    result.success = false;
    return result;
  }
}

/**
 * Returns a student gamification summary for APIs and UI views.
 *
 * This is read-only and uses the ledger model statics where possible. Additional counters are
 * derived from focused queries for current-month and current-semester reporting.
 *
 * @param studentId Student record id.
 * @returns Student XP summary with totals, breakdowns, recent activity, and averages.
 */
export async function getPointsSummary(studentId: string): Promise<PointsSummary> {
  const normalizedStudentId = collapseSpaces(studentId);
  const summary = buildEmptyPointsSummary(normalizedStudentId);

  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return summary;
    }

    const studentObjectId = toObjectId(normalizedStudentId);
    if (!studentObjectId) {
      return summary;
    }

    summary.totalXP = await GamificationPointsModel.getStudentTotalXP(studentObjectId).catch(
      () => 0
    );
    summary.categoryBreakdown = await GamificationPointsModel.getStudentPointsByCategory(
      studentObjectId
    ).catch(() => []);

    const recentActivity = await GamificationPointsModel.getRecentActivity(studentObjectId).catch(
      () => []
    );
    summary.recentActivity = recentActivity.map((item) => ({
      action: collapseSpaces(item.action),
      xpPoints: Number(item.xpPoints ?? 0),
      reason: collapseSpaces(item.reason),
      category: collapseSpaces(item.category),
      createdAt:
        item.createdAt instanceof Date
          ? item.createdAt
          : new Date(item.createdAt ?? Date.now()),
      metadata: asObject(item.metadata) ?? {},
    }));

    summary.activityCount = await GamificationPointsModel.countDocuments({
      studentId: studentObjectId,
      isRevoked: false,
    }).catch(() => 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRows = await GamificationPointsModel.aggregate<{ totalXP: number }>([
      {
        $match: {
          studentId: studentObjectId,
          isRevoked: false,
          createdAt: { $gte: monthStart },
        },
      },
      {
        $group: {
          _id: null,
          totalXP: { $sum: "$xpPoints" },
        },
      },
    ]).exec().catch(() => []);
    summary.pointsThisMonth = Number(monthlyRows[0]?.totalXP ?? 0);

    const allGrades = (await fetchEnrichedGrades({ studentId: studentObjectId })) as unknown as IGrade[];
    const orderedSemesters = Array.from(
      new Map(
        allGrades.map((grade) => {
          const academicYear = collapseSpaces(grade.academicYear);
          const semester = Number(grade.semester) === 2 ? 2 : 1;
          return [buildSemesterKey(academicYear, semester), { academicYear, semester }];
        })
      ).values()
    ).sort(compareAcademicPeriods);
    const latestSemester = orderedSemesters[orderedSemesters.length - 1] ?? null;

    if (latestSemester) {
      const semesterRows = await GamificationPointsModel.aggregate<{ totalXP: number }>([
        {
          $match: {
            studentId: studentObjectId,
            isRevoked: false,
            academicYear: latestSemester.academicYear,
            semester: latestSemester.semester,
          },
        },
        {
          $group: {
            _id: null,
            totalXP: { $sum: "$xpPoints" },
          },
        },
      ]).exec().catch(() => []);
      summary.pointsThisSemester = Number(semesterRows[0]?.totalXP ?? 0);
    }

    summary.averagePointsPerModule =
      allGrades.length > 0 ? roundToTwo(summary.totalXP / allGrades.length) : 0;

    return summary;
  } catch (error) {
    console.error("getPointsSummary error", error);
    return summary;
  }
}

/* Verification Scenarios:

Scenario 1 — Student passes a module with 85%:
→ awardPointsForGrade should award:
  - module_passed: +10 XP
  - high_score: +25 XP
  Total: +35 XP

Scenario 2 — Student passes a module with 72%:
→ awardPointsForGrade should award:
  - module_passed: +10 XP
  (no high_score because 72 < 80)
  Total: +10 XP

Scenario 3 — Student fails a module (status "fail"):
→ awardPointsForGrade should award:
  - nothing (module not passed)
  Total: 0 XP

Scenario 4 — Semester with GPA 3.6, all 5 modules passed:
→ awardPointsForSemester should award:
  - semester_gpa_above_3: +30 XP
  - semester_gpa_above_3.5: +50 XP
  - semester_all_passed: +40 XP
  Total: +120 XP

Scenario 5 — Student reaches 100 total XP:
→ checkAndAwardMilestones should award:
  - milestone_reached (100): +20 XP
  New total: 120 XP (which triggers next check but 120 < 300, so no more milestones)

Scenario 6 — Duplicate prevention:
→ Calling awardPointsForGrade twice with the same gradeId
  should award 0 XP on the second call (already awarded)

Scenario 7 — Grade revocation:
→ revokePointsForGrade(gradeId) should soft-revoke all entries for that grade
  Student's total XP decreases accordingly
*/
