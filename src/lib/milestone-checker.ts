import mongoose, { Types } from "mongoose";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/lib/mongoose";
import { calculateCumulativeGPA, calculateSemesterGPA } from "@/lib/performance-utils";
import { getCurrentLevel } from "@/lib/level-utils";
import type { IGrade } from "@/models/Grade";
import { GradeModel } from "@/models/Grade";
import { GamificationPointsModel } from "@/models/GamificationPoints";
import type { ITrophy } from "@/models/Trophy";
import { TrophyModel } from "@/models/Trophy";

// Direct model imports are used here instead of importing the points engine because
// the points engine calls checkAllMilestones() after award flows complete.
// Keeping this file independent avoids a circular dependency.

type TrophyTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
type TrophyCategory =
  | "academic"
  | "score"
  | "gpa"
  | "semester"
  | "milestone"
  | "level"
  | "special"
  | "custom";

export interface TrophyDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: TrophyTier;
  category: TrophyCategory;
  condition: string;
  xpBonus: number;
}

export interface TrophyAward {
  trophyKey: string;
  trophyName: string;
  trophyIcon: string;
  trophyTier: string;
  xpBonusAwarded: number;
  message: string;
}

export interface MilestoneCheckResult {
  success: boolean;
  studentId: string;
  newTrophiesAwarded: TrophyAward[];
  totalNewTrophies: number;
  totalXPBonusAwarded: number;
  existingTrophyCount: number;
  errors: string[];
}

export interface TrophyShowcaseItem {
  definition: TrophyDefinition;
  earned: boolean;
  earnedAt: Date | null;
  metadata: Record<string, unknown> | null;
}

export interface TrophyShowcase {
  studentId: string;
  totalAvailable: number;
  totalEarned: number;
  earnedPercentage: number;
  trophies: TrophyShowcaseItem[];
  byTier: {
    bronze: { total: number; earned: number };
    silver: { total: number; earned: number };
    gold: { total: number; earned: number };
    platinum: { total: number; earned: number };
    diamond: { total: number; earned: number };
  };
  byCategory: Record<string, { total: number; earned: number }>;
}

interface SemesterGroup {
  academicYear: string;
  semester: 1 | 2;
  grades: IGrade[];
}

const TIER_ORDER: Record<TrophyTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
};

export const TROPHY_DEFINITIONS: TrophyDefinition[] = [
  {
    key: "first_module_passed",
    name: "First Steps",
    description: "Completed your first module successfully",
    icon: "🌟",
    tier: "bronze",
    category: "academic",
    condition: "Pass your first module",
    xpBonus: 5,
  },
  {
    key: "xp_beginner",
    name: "Point Collector",
    description: "Accumulated your first 100 XP",
    icon: "⭐",
    tier: "bronze",
    category: "milestone",
    condition: "Reach 100 XP",
    xpBonus: 10,
  },
  {
    key: "level_2_reached",
    name: "Rising Star",
    description: "Advanced to Intermediate level",
    icon: "📘",
    tier: "bronze",
    category: "level",
    condition: "Reach Intermediate level (100 XP)",
    xpBonus: 10,
  },
  {
    key: "five_modules_passed",
    name: "Steady Progress",
    description: "Successfully passed 5 modules",
    icon: "📚",
    tier: "silver",
    category: "academic",
    condition: "Pass 5 modules",
    xpBonus: 15,
  },
  {
    key: "first_high_score",
    name: "Sharp Mind",
    description: "Scored above 80% for the first time",
    icon: "🎯",
    tier: "silver",
    category: "score",
    condition: "Score above 80% in any module",
    xpBonus: 15,
  },
  {
    key: "clean_sweep",
    name: "Clean Sweep",
    description: "Passed every module in a semester",
    icon: "🧹",
    tier: "silver",
    category: "semester",
    condition: "Pass all modules in a semester",
    xpBonus: 20,
  },
  {
    key: "deans_list",
    name: "Dean's List",
    description: "Achieved semester GPA above 3.5",
    icon: "📋",
    tier: "silver",
    category: "gpa",
    condition: "Achieve semester GPA above 3.5",
    xpBonus: 25,
  },
  {
    key: "comeback_king",
    name: "Comeback King",
    description: "Improved GPA by 0.5 or more from previous semester",
    icon: "👑",
    tier: "silver",
    category: "gpa",
    condition: "Improve GPA by 0.5+ from previous semester",
    xpBonus: 20,
  },
  {
    key: "xp_intermediate",
    name: "XP Warrior",
    description: "Accumulated 300 XP",
    icon: "⚔️",
    tier: "silver",
    category: "milestone",
    condition: "Reach 300 XP",
    xpBonus: 20,
  },
  {
    key: "level_3_reached",
    name: "Knowledge Seeker",
    description: "Advanced to Advanced level",
    icon: "🎓",
    tier: "silver",
    category: "level",
    condition: "Reach Advanced level (300 XP)",
    xpBonus: 20,
  },
  {
    key: "ten_modules_passed",
    name: "Dedicated Scholar",
    description: "Successfully passed 10 modules",
    icon: "🏅",
    tier: "gold",
    category: "academic",
    condition: "Pass 10 modules",
    xpBonus: 30,
  },
  {
    key: "five_high_scores",
    name: "Excellence Streak",
    description: "Scored above 80% in 5 different modules",
    icon: "🔥",
    tier: "gold",
    category: "score",
    condition: "Score above 80% in 5 modules",
    xpBonus: 30,
  },
  {
    key: "perfect_score",
    name: "Perfectionist",
    description: "Achieved a perfect 100% score in a module",
    icon: "💎",
    tier: "gold",
    category: "score",
    condition: "Score 100% in any module",
    xpBonus: 35,
  },
  {
    key: "first_class_achievement",
    name: "First Class",
    description: "Achieved First Class Honours GPA",
    icon: "🥇",
    tier: "gold",
    category: "gpa",
    condition: "Achieve cumulative GPA ≥ 3.7",
    xpBonus: 40,
  },
  {
    key: "consistent_performer",
    name: "Consistency King",
    description: "Maintained GPA ≥ 3.0 for 3 consecutive semesters",
    icon: "👑",
    tier: "gold",
    category: "gpa",
    condition: "3 consecutive semesters with GPA ≥ 3.0",
    xpBonus: 35,
  },
  {
    key: "resilience",
    name: "Resilience",
    description: "Successfully passed a previously failed or pro-rata module",
    icon: "💪",
    tier: "gold",
    category: "special",
    condition: "Pass a module you previously failed",
    xpBonus: 30,
  },
  {
    key: "twenty_modules_passed",
    name: "Academic Veteran",
    description: "Successfully passed 20 modules",
    icon: "🎖️",
    tier: "platinum",
    category: "academic",
    condition: "Pass 20 modules",
    xpBonus: 50,
  },
  {
    key: "triple_perfect",
    name: "Triple Threat",
    description: "Achieved perfect 100% scores in 3 different modules",
    icon: "⚡",
    tier: "platinum",
    category: "score",
    condition: "Score 100% in 3 modules",
    xpBonus: 50,
  },
  {
    key: "semester_champion",
    name: "Semester Champion",
    description: "Best performance in a semester — all passes with at least one high score",
    icon: "🏆",
    tier: "platinum",
    category: "semester",
    condition: "Pass all modules + at least one score ≥ 80% in a semester",
    xpBonus: 45,
  },
  {
    key: "xp_champion",
    name: "XP Master",
    description: "Accumulated 600 XP",
    icon: "🏆",
    tier: "platinum",
    category: "milestone",
    condition: "Reach 600 XP",
    xpBonus: 40,
  },
  {
    key: "level_4_reached",
    name: "Campus Champion",
    description: "Reached the highest level — Champion",
    icon: "🏆",
    tier: "platinum",
    category: "level",
    condition: "Reach Champion level (600 XP)",
    xpBonus: 50,
  },
  {
    key: "all_rounder",
    name: "Renaissance Scholar",
    description: "Passed modules across 3 or more different faculties",
    icon: "🌐",
    tier: "diamond",
    category: "special",
    condition: "Pass modules across 3+ faculties",
    xpBonus: 75,
  },
  {
    key: "early_bird",
    name: "Trailblazer",
    description: "First student to complete a module in a semester",
    icon: "🚀",
    tier: "diamond",
    category: "special",
    condition: "First student to complete a module in a semester",
    xpBonus: 60,
  },
];

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

function compareAcademicPeriods(
  left: { academicYear: string; semester: number },
  right: { academicYear: string; semester: number }
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

function getGradeTimestamp(grade: IGrade) {
  const row = grade as unknown as Record<string, unknown>;
  const candidates = [row.gradedAt, row.updatedAt, row.createdAt];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const value = candidate instanceof Date ? candidate : new Date(String(candidate));
    if (!Number.isNaN(value.getTime())) {
      return value;
    }
  }

  return new Date(0);
}

function buildSemesterKey(academicYear: string, semester: number) {
  return `${collapseSpaces(academicYear)}::${semester}`;
}

function getModuleOfferingRow(grade: IGrade) {
  const row = grade as unknown as Record<string, unknown>;
  return asObject(row.moduleOfferingId);
}

function getModuleKeyFromGrade(grade: IGrade) {
  const offering = getModuleOfferingRow(grade);
  return collapseSpaces(offering?.moduleId) || readId(offering?._id ?? offering?.id);
}

function getFacultyKeyFromGrade(grade: IGrade) {
  const offering = getModuleOfferingRow(grade);
  return collapseSpaces(offering?.facultyId);
}

function isMongoDuplicateKeyError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  return Number((error as { code?: unknown }).code) === 11000;
}

function buildEmptyMilestoneCheckResult(studentId = ""): MilestoneCheckResult {
  return {
    success: true,
    studentId,
    newTrophiesAwarded: [],
    totalNewTrophies: 0,
    totalXPBonusAwarded: 0,
    existingTrophyCount: 0,
    errors: [],
  };
}

function buildEmptyTrophyShowcase(studentId = ""): TrophyShowcase {
  return {
    studentId,
    totalAvailable: TROPHY_DEFINITIONS.length,
    totalEarned: 0,
    earnedPercentage: 0,
    trophies: [],
    byTier: {
      bronze: { total: 0, earned: 0 },
      silver: { total: 0, earned: 0 },
      gold: { total: 0, earned: 0 },
      platinum: { total: 0, earned: 0 },
      diamond: { total: 0, earned: 0 },
    },
    byCategory: {},
  };
}

function buildCelebrationMessage(tier: TrophyTier, name: string) {
  if (tier === "bronze") {
    return `🌟 Trophy Unlocked: ${name}!`;
  }

  if (tier === "silver") {
    return `⭐ Great Achievement: ${name}!`;
  }

  if (tier === "gold") {
    return `🏅 Outstanding: ${name}!`;
  }

  if (tier === "platinum") {
    return `🏆 Incredible: ${name}!`;
  }

  return `💎 Legendary: ${name}!`;
}

async function ensureDatabaseConnection() {
  return await connectMongoose().catch(() => null);
}

async function fetchStudentGrades(studentId: Types.ObjectId) {
  return ((await GradeModel.find({ studentId })
    .populate({
      path: "moduleOfferingId",
      select: "moduleId facultyId intakeId termCode status degreeProgramId",
    })
    .sort({ academicYear: 1, semester: 1, gradedAt: 1, createdAt: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown) as IGrade[];
}

function groupGradesBySemester(grades: IGrade[]) {
  const groups = new Map<string, SemesterGroup>();

  grades.forEach((grade) => {
    const academicYear = collapseSpaces(grade.academicYear);
    const semester = Number(grade.semester) === 2 ? 2 : 1;
    const key = buildSemesterKey(academicYear, semester);
    const current =
      groups.get(key) ??
      ({
        academicYear,
        semester,
        grades: [],
      } satisfies SemesterGroup);

    current.grades.push(grade);
    groups.set(key, current);
  });

  return Array.from(groups.values()).sort(compareAcademicPeriods);
}

function getLatestAcademicContext(grades: IGrade[]) {
  if (grades.length === 0) {
    return {
      academicYear: undefined,
      semester: undefined,
    };
  }

  const ordered = [...grades].sort((left, right) => {
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

    return getGradeTimestamp(left).getTime() - getGradeTimestamp(right).getTime();
  });

  const latest = ordered[ordered.length - 1];
  return {
    academicYear: collapseSpaces(latest?.academicYear) || undefined,
    semester: Number(latest?.semester) === 2 ? 2 : 1,
  };
}

function buildSemesterGPAItems(grades: IGrade[]) {
  return groupGradesBySemester(grades).map((group) => ({
    academicYear: group.academicYear,
    semester: group.semester,
    grades: group.grades,
    gpa: calculateSemesterGPA(group.grades),
  }));
}

async function awardTrophyInternal(
  studentId: Types.ObjectId,
  trophyDef: TrophyDefinition,
  metadata?: Record<string, unknown>,
  academicYear?: string,
  semester?: number,
  errors?: string[]
): Promise<TrophyAward | null> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      errors?.push("Database connection is not configured");
      return null;
    }

    const hasExisting = await TrophyModel.hasTrophy(studentId, trophyDef.key).catch(() => false);
    if (hasExisting) {
      return null;
    }

    await TrophyModel.create({
      studentId,
      trophyKey: trophyDef.key,
      trophyName: trophyDef.name,
      trophyDescription: trophyDef.description,
      trophyIcon: trophyDef.icon,
      trophyTier: trophyDef.tier,
      category: trophyDef.category,
      xpBonusAwarded: trophyDef.xpBonus,
      condition: trophyDef.condition,
      earnedAt: new Date(),
      academicYear: collapseSpaces(academicYear) || undefined,
      semester: semester === 2 ? 2 : semester === 1 ? 1 : undefined,
      metadata: metadata ?? null,
      isHidden: false,
      showcaseOrder: 0,
    });

    if (trophyDef.xpBonus > 0) {
      try {
        await GamificationPointsModel.create({
          studentId,
          action: "milestone_reached",
          xpPoints: trophyDef.xpBonus,
          reason: `Trophy earned: ${trophyDef.name}`,
          category: "bonus",
          referenceType: "Milestone",
          metadata: {
            trophyKey: trophyDef.key,
            trophyName: trophyDef.name,
            trophyTier: trophyDef.tier,
            xpBonus: trophyDef.xpBonus,
            ...(metadata ?? {}),
          },
          awardedBy: "system",
          isRevoked: false,
          revokedAt: null,
          revokedReason: "",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to award trophy XP bonus for ${trophyDef.key}`;
        console.error("awardTrophy bonus XP error", error);
        errors?.push(message);
      }
    }

    return {
      trophyKey: trophyDef.key,
      trophyName: trophyDef.name,
      trophyIcon: trophyDef.icon,
      trophyTier: trophyDef.tier,
      xpBonusAwarded: trophyDef.xpBonus,
      message: buildCelebrationMessage(trophyDef.tier, trophyDef.name),
    };
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return null;
    }

    const message =
      error instanceof Error ? error.message : `Failed to award trophy ${trophyDef.key}`;
    console.error("awardTrophy error", error);
    errors?.push(message);
    return null;
  }
}

async function checkAcademicTrophiesInternal(
  studentObjectId: Types.ObjectId,
  grades: IGrade[],
  errors?: string[]
) {
  const awards: TrophyAward[] = [];
  const passedCount = grades.filter((grade) => grade.status === "pass").length;

  const checks = [
    { threshold: 1, key: "first_module_passed" },
    { threshold: 5, key: "five_modules_passed" },
    { threshold: 10, key: "ten_modules_passed" },
    { threshold: 20, key: "twenty_modules_passed" },
  ];

  for (const check of checks) {
    if (passedCount < check.threshold) {
      continue;
    }

    const trophyDef = getTrophyDefinition(check.key);
    if (!trophyDef) {
      continue;
    }

    const award = await awardTrophyInternal(
      studentObjectId,
      trophyDef,
      { passedCount, threshold: check.threshold },
      undefined,
      undefined,
      errors
    );

    if (award) {
      awards.push(award);
    }
  }

  return awards;
}

async function checkScoreTrophiesInternal(
  studentObjectId: Types.ObjectId,
  grades: IGrade[],
  errors?: string[]
) {
  const awards: TrophyAward[] = [];
  const highScoreCount = grades.filter((grade) => Number(grade.totalMarks ?? 0) >= 80).length;
  const perfectCount = grades.filter((grade) => Number(grade.totalMarks ?? 0) === 100).length;

  const checks = [
    { threshold: 1, key: "first_high_score", count: highScoreCount },
    { threshold: 5, key: "five_high_scores", count: highScoreCount },
    { threshold: 1, key: "perfect_score", count: perfectCount },
    { threshold: 3, key: "triple_perfect", count: perfectCount },
  ];

  for (const check of checks) {
    if (check.count < check.threshold) {
      continue;
    }

    const trophyDef = getTrophyDefinition(check.key);
    if (!trophyDef) {
      continue;
    }

    const award = await awardTrophyInternal(
      studentObjectId,
      trophyDef,
      {
        highScoreCount,
        perfectCount,
        threshold: check.threshold,
      },
      undefined,
      undefined,
      errors
    );

    if (award) {
      awards.push(award);
    }
  }

  return awards;
}

async function checkGPATrophiesInternal(
  studentObjectId: Types.ObjectId,
  grades: IGrade[],
  errors?: string[]
) {
  const awards: TrophyAward[] = [];
  const semesterItems = buildSemesterGPAItems(grades);
  const latestContext = getLatestAcademicContext(grades);

  const deansListSemester = semesterItems.find((item) => item.gpa >= 3.5);
  if (deansListSemester) {
    const trophyDef = getTrophyDefinition("deans_list");
    if (trophyDef) {
      const award = await awardTrophyInternal(
        studentObjectId,
        trophyDef,
        {
          semesterGPA: deansListSemester.gpa,
          modulesCount: deansListSemester.grades.length,
        },
        deansListSemester.academicYear,
        deansListSemester.semester,
        errors
      );

      if (award) {
        awards.push(award);
      }
    }
  }

  const cumulativeGPA = calculateCumulativeGPA(grades);
  if (cumulativeGPA >= 3.7) {
    const trophyDef = getTrophyDefinition("first_class_achievement");
    if (trophyDef) {
      const award = await awardTrophyInternal(
        studentObjectId,
        trophyDef,
        { cumulativeGPA },
        latestContext.academicYear,
        latestContext.semester,
        errors
      );

      if (award) {
        awards.push(award);
      }
    }
  }

  for (let index = 0; index <= semesterItems.length - 3; index += 1) {
    const streak = semesterItems.slice(index, index + 3);
    if (streak.every((item) => item.gpa >= 3.0)) {
      const trophyDef = getTrophyDefinition("consistent_performer");
      if (trophyDef) {
        const award = await awardTrophyInternal(
          studentObjectId,
          trophyDef,
          {
            streak: streak.map((item) => ({
              academicYear: item.academicYear,
              semester: item.semester,
              gpa: item.gpa,
            })),
          },
          streak[streak.length - 1].academicYear,
          streak[streak.length - 1].semester,
          errors
        );

        if (award) {
          awards.push(award);
        }
      }

      break;
    }
  }

  for (let index = 1; index < semesterItems.length; index += 1) {
    const previous = semesterItems[index - 1];
    const current = semesterItems[index];
    const improvement = roundToTwo(current.gpa - previous.gpa);
    if (improvement < 0.5) {
      continue;
    }

    const trophyDef = getTrophyDefinition("comeback_king");
    if (!trophyDef) {
      break;
    }

    const award = await awardTrophyInternal(
      studentObjectId,
      trophyDef,
      {
        previousGPA: previous.gpa,
        currentGPA: current.gpa,
        improvement,
      },
      current.academicYear,
      current.semester,
      errors
    );

    if (award) {
      awards.push(award);
    }

    break;
  }

  return awards;
}

async function checkSemesterTrophiesInternal(
  studentObjectId: Types.ObjectId,
  grades: IGrade[],
  errors?: string[]
) {
  const awards: TrophyAward[] = [];
  const semesters = groupGradesBySemester(grades);

  const cleanSweepSemester = semesters.find(
    (semesterGroup) =>
      semesterGroup.grades.length > 0 &&
      semesterGroup.grades.every((grade) => grade.status === "pass")
  );
  if (cleanSweepSemester) {
    const trophyDef = getTrophyDefinition("clean_sweep");
    if (trophyDef) {
      const award = await awardTrophyInternal(
        studentObjectId,
        trophyDef,
        {
          modulesCount: cleanSweepSemester.grades.length,
          semesterGPA: calculateSemesterGPA(cleanSweepSemester.grades),
        },
        cleanSweepSemester.academicYear,
        cleanSweepSemester.semester,
        errors
      );

      if (award) {
        awards.push(award);
      }
    }
  }

  const championSemester = semesters.find(
    (semesterGroup) =>
      semesterGroup.grades.length > 0 &&
      semesterGroup.grades.every((grade) => grade.status === "pass") &&
      semesterGroup.grades.some((grade) => Number(grade.totalMarks ?? 0) >= 80)
  );
  if (championSemester) {
    const trophyDef = getTrophyDefinition("semester_champion");
    if (trophyDef) {
      const award = await awardTrophyInternal(
        studentObjectId,
        trophyDef,
        {
          modulesCount: championSemester.grades.length,
          semesterGPA: calculateSemesterGPA(championSemester.grades),
          hasHighScore: true,
        },
        championSemester.academicYear,
        championSemester.semester,
        errors
      );

      if (award) {
        awards.push(award);
      }
    }
  }

  return awards;
}

async function checkXPMilestonesInternal(
  studentObjectId: Types.ObjectId,
  totalXP: number,
  errors?: string[]
) {
  const awards: TrophyAward[] = [];
  const checks = [
    { threshold: 100, key: "xp_beginner" },
    { threshold: 300, key: "xp_intermediate" },
    { threshold: 600, key: "xp_champion" },
  ];

  for (const check of checks) {
    if (totalXP < check.threshold) {
      continue;
    }

    const trophyDef = getTrophyDefinition(check.key);
    if (!trophyDef) {
      continue;
    }

    const award = await awardTrophyInternal(
      studentObjectId,
      trophyDef,
      {
        totalXP,
        threshold: check.threshold,
      },
      undefined,
      undefined,
      errors
    );

    if (award) {
      awards.push(award);
    }
  }

  return awards;
}

async function checkLevelTrophiesInternal(
  studentObjectId: Types.ObjectId,
  totalXP: number,
  errors?: string[]
) {
  const awards: TrophyAward[] = [];
  const currentLevel = getCurrentLevel(totalXP);
  const checks = [
    { minimumLevel: 2, key: "level_2_reached" },
    { minimumLevel: 3, key: "level_3_reached" },
    { minimumLevel: 4, key: "level_4_reached" },
  ];

  for (const check of checks) {
    if (currentLevel.level < check.minimumLevel) {
      continue;
    }

    const trophyDef = getTrophyDefinition(check.key);
    if (!trophyDef) {
      continue;
    }

    const award = await awardTrophyInternal(
      studentObjectId,
      trophyDef,
      {
        totalXP,
        level: currentLevel.level,
        levelName: currentLevel.name,
        levelTitle: currentLevel.title,
      },
      undefined,
      undefined,
      errors
    );

    if (award) {
      awards.push(award);
    }
  }

  return awards;
}

async function checkSpecialTrophiesInternal(
  studentObjectId: Types.ObjectId,
  grades: IGrade[],
  errors?: string[]
) {
  const awards: TrophyAward[] = [];
  const orderedGrades = [...grades].sort((left, right) => {
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

    return getGradeTimestamp(left).getTime() - getGradeTimestamp(right).getTime();
  });

  const previousStatusesByModule = new Map<string, string[]>();
  let resilienceContext:
    | {
        moduleKey: string;
        recoveredFrom: string[];
        academicYear: string;
        semester: 1 | 2;
      }
    | null = null;

  for (const grade of orderedGrades) {
    const moduleKey = getModuleKeyFromGrade(grade);
    if (!moduleKey) {
      continue;
    }

    const status = collapseSpaces(grade.status);
    const previousStatuses = previousStatusesByModule.get(moduleKey) ?? [];
    if (
      status === "pass" &&
      previousStatuses.some(
        (previousStatus) =>
          previousStatus === "fail" ||
          previousStatus === "pro-rata" ||
          previousStatus === "repeat"
      )
    ) {
      resilienceContext = {
        moduleKey,
        recoveredFrom: [...new Set(previousStatuses)],
        academicYear: collapseSpaces(grade.academicYear),
        semester: Number(grade.semester) === 2 ? 2 : 1,
      };
      break;
    }

    previousStatuses.push(status);
    previousStatusesByModule.set(moduleKey, previousStatuses);
  }

  if (resilienceContext) {
    const trophyDef = getTrophyDefinition("resilience");
    if (trophyDef) {
      const award = await awardTrophyInternal(
        studentObjectId,
        trophyDef,
        {
          moduleKey: resilienceContext.moduleKey,
          recoveredFrom: resilienceContext.recoveredFrom,
        },
        resilienceContext.academicYear,
        resilienceContext.semester,
        errors
      );

      if (award) {
        awards.push(award);
      }
    }
  }

  const passedFaculties = new Set(
    grades
      .filter((grade) => grade.status === "pass")
      .map((grade) => getFacultyKeyFromGrade(grade))
      .filter(Boolean)
  );
  if (passedFaculties.size >= 3) {
    const trophyDef = getTrophyDefinition("all_rounder");
    if (trophyDef) {
      const award = await awardTrophyInternal(
        studentObjectId,
        trophyDef,
        {
          facultiesCount: passedFaculties.size,
          faculties: Array.from(passedFaculties),
        },
        undefined,
        undefined,
        errors
      );

      if (award) {
        awards.push(award);
      }
    }
  }

  // TODO: early_bird needs cross-student completion timing data for the same semester/module
  // so it cannot be determined reliably from a single student's grades alone.

  return awards;
}

/**
 * Looks up a trophy definition by key.
 *
 * @param key Trophy definition key.
 * @returns Matching trophy definition when available, otherwise undefined.
 */
export function getTrophyDefinition(key: string): TrophyDefinition | undefined {
  return TROPHY_DEFINITIONS.find((definition) => definition.key === collapseSpaces(key));
}

/**
 * Creates a trophy record for a student when a trophy condition has been met.
 *
 * This helper prevents duplicate trophies, persists the trophy row, and writes the trophy's
 * bonus XP to the gamification points ledger when applicable.
 *
 * @param studentId Student record id.
 * @param trophyDef Trophy definition to award.
 * @param metadata Optional contextual metadata stored on the trophy row.
 * @param academicYear Optional academic year context.
 * @param semester Optional semester context.
 * @returns Trophy award payload when a new trophy is created, otherwise null.
 */
export async function awardTrophy(
  studentId: string,
  trophyDef: TrophyDefinition,
  metadata?: Record<string, unknown>,
  academicYear?: string,
  semester?: number
): Promise<TrophyAward | null> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return null;
    }

    const studentObjectId = toObjectId(studentId);
    if (!studentObjectId) {
      return null;
    }

    return await awardTrophyInternal(
      studentObjectId,
      trophyDef,
      metadata,
      academicYear,
      semester
    );
  } catch (error) {
    console.error("awardTrophy exported helper error", error);
    return null;
  }
}

/**
 * Runs every trophy checker for a student and awards all newly qualified trophies.
 *
 * This is the primary milestone evaluation entry point. It fetches the student's grades, XP,
 * and existing trophy count, then runs the checkers in stages so XP-based and level-based
 * trophies can respond to bonus XP awarded by earlier trophies in the same run.
 *
 * @param studentId Student record id.
 * @returns Comprehensive trophy award result with awarded trophies, XP bonus total, and errors.
 */
export async function checkAllMilestones(studentId: string): Promise<MilestoneCheckResult> {
  const normalizedStudentId = collapseSpaces(studentId);
  const result = buildEmptyMilestoneCheckResult(normalizedStudentId);

  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      result.success = false;
      result.errors.push("Database connection is not configured");
      return result;
    }

    const studentObjectId = toObjectId(normalizedStudentId);
    if (!studentObjectId) {
      result.success = false;
      result.errors.push("Invalid student ID");
      return result;
    }

    const [grades, existingTrophies] = await Promise.all([
      fetchStudentGrades(studentObjectId).catch(() => [] as IGrade[]),
      TrophyModel.getStudentTrophies(studentObjectId, { includeHidden: true }).catch(
        () => [] as ITrophy[]
      ),
      GamificationPointsModel.getStudentTotalXP(studentObjectId).catch(() => 0),
    ]);
    result.existingTrophyCount = existingTrophies.length;

    const checkerTasks = [
      () => checkAcademicTrophiesInternal(studentObjectId, grades, result.errors),
      () => checkScoreTrophiesInternal(studentObjectId, grades, result.errors),
      () => checkGPATrophiesInternal(studentObjectId, grades, result.errors),
      () => checkSemesterTrophiesInternal(studentObjectId, grades, result.errors),
      () => checkSpecialTrophiesInternal(studentObjectId, grades, result.errors),
    ];

    for (const task of checkerTasks) {
      try {
        const awards = await task();
        result.newTrophiesAwarded.push(...awards);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "A milestone checker failed";
        console.error("checkAllMilestones category checker error", error);
        result.errors.push(message);
      }
    }

    // TODO: Add quiz-specific trophy checks when quiz trophy definitions are added.
    // e.g., "Quiz Enthusiast" — Complete 5 quizzes.
    // e.g., "Quiz Master" — Score 80%+ on 10 quizzes.
    // e.g., "Speed Demon" — Complete a quiz in under 50% of the time limit.

    for (let iteration = 0; iteration < 5; iteration += 1) {
      let awardedInIteration = 0;

      try {
        const currentTotalXP = await GamificationPointsModel.getStudentTotalXP(
          studentObjectId
        ).catch(() => 0);
        const xpAwards = await checkXPMilestonesInternal(
          studentObjectId,
          currentTotalXP,
          result.errors
        );
        awardedInIteration += xpAwards.length;
        result.newTrophiesAwarded.push(...xpAwards);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "XP milestone checker failed";
        console.error("checkAllMilestones XP checker error", error);
        result.errors.push(message);
      }

      try {
        const currentTotalXP = await GamificationPointsModel.getStudentTotalXP(
          studentObjectId
        ).catch(() => 0);
        const levelAwards = await checkLevelTrophiesInternal(
          studentObjectId,
          currentTotalXP,
          result.errors
        );
        awardedInIteration += levelAwards.length;
        result.newTrophiesAwarded.push(...levelAwards);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Level milestone checker failed";
        console.error("checkAllMilestones level checker error", error);
        result.errors.push(message);
      }

      if (awardedInIteration === 0) {
        break;
      }
    }

    result.totalNewTrophies = result.newTrophiesAwarded.length;
    result.totalXPBonusAwarded = result.newTrophiesAwarded.reduce(
      (sum, award) => sum + Number(award.xpBonusAwarded || 0),
      0
    );
    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    console.error("checkAllMilestones error", error);
    result.errors.push(
      error instanceof Error ? error.message : "Failed to check trophy milestones"
    );
    result.success = false;
    return result;
  }
}

/**
 * Checks pass-count based academic trophies for a student.
 *
 * @param studentId Student record id.
 * @param grades Student grades used for pass-count evaluation.
 * @returns Newly awarded academic trophies.
 */
export async function checkAcademicTrophies(
  studentId: string,
  grades: IGrade[]
): Promise<TrophyAward[]> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return [];
    }

    const studentObjectId = toObjectId(studentId);
    if (!studentObjectId) {
      return [];
    }

    return await checkAcademicTrophiesInternal(studentObjectId, grades);
  } catch (error) {
    console.error("checkAcademicTrophies error", error);
    return [];
  }
}

/**
 * Checks score-based trophies for a student.
 *
 * @param studentId Student record id.
 * @param grades Student grades used for score evaluation.
 * @returns Newly awarded score trophies.
 */
export async function checkScoreTrophies(
  studentId: string,
  grades: IGrade[]
): Promise<TrophyAward[]> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return [];
    }

    const studentObjectId = toObjectId(studentId);
    if (!studentObjectId) {
      return [];
    }

    return await checkScoreTrophiesInternal(studentObjectId, grades);
  } catch (error) {
    console.error("checkScoreTrophies error", error);
    return [];
  }
}

/**
 * Checks GPA-based trophies for a student.
 *
 * @param studentId Student record id.
 * @param grades Student grades used for semester and cumulative GPA evaluation.
 * @returns Newly awarded GPA trophies.
 */
export async function checkGPATrophies(
  studentId: string,
  grades: IGrade[]
): Promise<TrophyAward[]> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return [];
    }

    const studentObjectId = toObjectId(studentId);
    if (!studentObjectId) {
      return [];
    }

    return await checkGPATrophiesInternal(studentObjectId, grades);
  } catch (error) {
    console.error("checkGPATrophies error", error);
    return [];
  }
}

/**
 * Checks semester-wide achievement trophies for a student.
 *
 * @param studentId Student record id.
 * @param grades Student grades grouped by semester during evaluation.
 * @returns Newly awarded semester trophies.
 */
export async function checkSemesterTrophies(
  studentId: string,
  grades: IGrade[]
): Promise<TrophyAward[]> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return [];
    }

    const studentObjectId = toObjectId(studentId);
    if (!studentObjectId) {
      return [];
    }

    return await checkSemesterTrophiesInternal(studentObjectId, grades);
  } catch (error) {
    console.error("checkSemesterTrophies error", error);
    return [];
  }
}

/**
 * Checks XP milestone trophies for a student.
 *
 * @param studentId Student record id.
 * @param totalXP Student's current total XP.
 * @returns Newly awarded XP milestone trophies.
 */
export async function checkXPMilestones(
  studentId: string,
  totalXP: number
): Promise<TrophyAward[]> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return [];
    }

    const studentObjectId = toObjectId(studentId);
    if (!studentObjectId) {
      return [];
    }

    return await checkXPMilestonesInternal(studentObjectId, totalXP);
  } catch (error) {
    console.error("checkXPMilestones error", error);
    return [];
  }
}

/**
 * Checks level-based trophies for a student.
 *
 * @param studentId Student record id.
 * @param totalXP Student's current total XP.
 * @returns Newly awarded level trophies.
 */
export async function checkLevelTrophies(
  studentId: string,
  totalXP: number
): Promise<TrophyAward[]> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return [];
    }

    const studentObjectId = toObjectId(studentId);
    if (!studentObjectId) {
      return [];
    }

    return await checkLevelTrophiesInternal(studentObjectId, totalXP);
  } catch (error) {
    console.error("checkLevelTrophies error", error);
    return [];
  }
}

/**
 * Checks special trophy conditions for a student.
 *
 * @param studentId Student record id.
 * @param grades Student grades used for special-achievement evaluation.
 * @returns Newly awarded special trophies.
 */
export async function checkSpecialTrophies(
  studentId: string,
  grades: IGrade[]
): Promise<TrophyAward[]> {
  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return [];
    }

    const studentObjectId = toObjectId(studentId);
    if (!studentObjectId) {
      return [];
    }

    return await checkSpecialTrophiesInternal(studentObjectId, grades);
  } catch (error) {
    console.error("checkSpecialTrophies error", error);
    return [];
  }
}

/**
 * Returns the full trophy catalogue with earned-state overlays for a student.
 *
 * This is a read-only showcase helper used by UI layers to render earned and locked trophies
 * without duplicating trophy definition metadata client-side.
 *
 * @param studentId Student record id.
 * @returns Trophy showcase with earned flags, totals, tier grouping, and category grouping.
 */
export async function getAvailableTrophies(studentId: string): Promise<TrophyShowcase> {
  const normalizedStudentId = collapseSpaces(studentId);
  const showcase = buildEmptyTrophyShowcase(normalizedStudentId);

  try {
    const mongooseConnection = await ensureDatabaseConnection();
    if (!mongooseConnection) {
      return showcase;
    }

    const studentObjectId = toObjectId(normalizedStudentId);
    if (!studentObjectId) {
      return showcase;
    }

    const earnedTrophies = await TrophyModel.getStudentTrophies(studentObjectId, {
      includeHidden: true,
    }).catch(() => [] as ITrophy[]);
    const earnedMap = new Map(
      earnedTrophies.map((trophy) => [collapseSpaces(trophy.trophyKey), trophy] as const)
    );

    TROPHY_DEFINITIONS.forEach((definition) => {
      showcase.byTier[definition.tier].total += 1;
      showcase.byCategory[definition.category] = showcase.byCategory[definition.category] ?? {
        total: 0,
        earned: 0,
      };
      showcase.byCategory[definition.category].total += 1;
    });

    showcase.trophies = TROPHY_DEFINITIONS.map((definition) => {
      const earnedTrophy = earnedMap.get(definition.key) ?? null;
      const earned = Boolean(earnedTrophy);

      if (earned) {
        showcase.byTier[definition.tier].earned += 1;
        showcase.byCategory[definition.category].earned += 1;
      }

      return {
        definition,
        earned,
        earnedAt: earnedTrophy?.earnedAt ?? null,
        metadata: (asObject(earnedTrophy?.metadata) ?? null) as Record<string, unknown> | null,
      };
    }).sort((left, right) => {
      if (left.earned && right.earned) {
        return (right.earnedAt?.getTime() ?? 0) - (left.earnedAt?.getTime() ?? 0);
      }

      if (left.earned !== right.earned) {
        return left.earned ? -1 : 1;
      }

      const tierDifference =
        TIER_ORDER[right.definition.tier] - TIER_ORDER[left.definition.tier];
      if (tierDifference !== 0) {
        return tierDifference;
      }

      return left.definition.name.localeCompare(right.definition.name);
    });

    showcase.totalEarned = earnedTrophies.length;
    showcase.earnedPercentage =
      showcase.totalAvailable > 0
        ? roundToTwo((showcase.totalEarned / showcase.totalAvailable) * 100)
        : 0;

    return showcase;
  } catch (error) {
    console.error("getAvailableTrophies error", error);
    return showcase;
  }
}

/* Verification Scenarios:

Scenario 1 — New student passes first module with 85%:
→ checkAcademicTrophies: awards "first_module_passed" (bronze, +5 XP)
→ checkScoreTrophies: awards "first_high_score" (silver, +15 XP)
→ Total: 2 trophies, +20 XP bonus

Scenario 2 — Student reaches 100 XP:
→ checkXPMilestones: awards "xp_beginner" (bronze, +10 XP)
→ checkLevelTrophies: awards "level_2_reached" (bronze, +10 XP)
→ Total: 2 trophies, +20 XP bonus

Scenario 3 — Student achieves semester GPA 3.6 with all passes:
→ checkGPATrophies: awards "deans_list" (silver, +25 XP)
→ checkSemesterTrophies: awards "clean_sweep" (silver, +20 XP)
→ Total: 2 trophies, +45 XP bonus

Scenario 4 — Student already has all bronze trophies:
→ All bronze checks return null (already earned)
→ Only higher-tier trophies checked and potentially awarded
→ Total: 0 new trophies (all already earned)

Scenario 5 — Student passes previously failed module:
→ checkSpecialTrophies: awards "resilience" (gold, +30 XP)

Scenario 6 — Trophy showcase for student with 5 trophies:
→ getAvailableTrophies returns 22+ definitions, 5 earned, ~22% progress
→ byTier shows earned counts per tier
*/
