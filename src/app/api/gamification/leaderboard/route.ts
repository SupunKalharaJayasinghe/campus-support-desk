import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/GamificationPoints";
import "@/models/Grade";
import "@/models/ModuleOffering";
import "@/models/Student";
import "@/models/Trophy";
import {
  buildDemoLeaderboardData,
  hasDemoStudent,
} from "@/lib/demo-student-analytics";
import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import { getCurrentLevel } from "@/lib/level-utils";
import { connectMongoose } from "@/lib/mongoose";
import { findIntakeById } from "@/lib/intake-store";
import { findModuleByCode, findModuleById } from "@/lib/module-store";
import { EnrollmentModel } from "@/models/Enrollment";
import { GamificationPointsModel } from "@/models/GamificationPoints";
import { GradeModel } from "@/models/Grade";
import { IntakeModel } from "@/models/Intake";
import { ModuleModel } from "@/models/Module";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { StudentModel } from "@/models/Student";
import { TrophyModel } from "@/models/Trophy";

export type LeaderboardScope =
  | "campus"
  | "faculty"
  | "degree"
  | "intake"
  | "module";

export interface LeaderboardStudentInfo {
  id: string;
  name: string;
  registrationNumber: string;
  faculty?: string;
  degreeProgram?: string;
  intake?: string;
}

export interface LeaderboardEntry {
  rank: number;
  student: LeaderboardStudentInfo;
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

export interface LeaderboardBuildOptions {
  scope: LeaderboardScope;
  facultyId?: string;
  degreeProgramId?: string;
  intakeId?: string;
  moduleOfferingId?: string;
}

export interface LeaderboardBuildResult {
  scope: LeaderboardScope;
  scopeName: string | null;
  totalStudents: number;
  activeParticipants: number;
  entries: LeaderboardEntry[];
}

interface EnrollmentScopeRow {
  studentId: string;
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
}

interface ScopeStudentContext {
  scopeName: string | null;
  studentIds: string[];
  enrollmentByStudent: Map<string, EnrollmentScopeRow>;
  intakeNameById: Map<string, string>;
}

interface AggregatedXPRow {
  _id: mongoose.Types.ObjectId;
  totalXP: number;
  lastAwardedAt?: Date | null;
  last7Days?: number;
  last30Days?: number;
}

interface TrophyLookupRow {
  _id: mongoose.Types.ObjectId;
  trophyKey: string;
  trophyName: string;
  trophyIcon: string;
  trophyTier: string;
}

interface InternalLeaderboardEntry extends LeaderboardEntry {
  studentObjectId: string;
  lastAwardedAtMs: number;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

export function readId(value: unknown) {
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

export function buildStudentName(student: unknown) {
  const row = asObject(student);
  const firstName = collapseSpaces(row?.firstName);
  const lastName = collapseSpaces(row?.lastName);

  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 12);
}

function parseScope(value: unknown): LeaderboardScope | null {
  if (
    value === "campus" ||
    value === "faculty" ||
    value === "degree" ||
    value === "intake" ||
    value === "module"
  ) {
    return value;
  }

  return null;
}

function parsePageParam(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(max, Math.floor(parsed));
}

function uniqueIds(values: unknown[]) {
  return Array.from(
    new Set(values.map((value) => readId(value)).filter(Boolean))
  );
}

function toObjectIds(values: string[]) {
  return values
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));
}

function firstValue(value: string | null, fallback: string | null) {
  const primary = String(value ?? "").trim();
  if (primary) {
    return primary;
  }

  return String(fallback ?? "").trim();
}

export function parseScopeOptions(searchParams: URLSearchParams): {
  scope: LeaderboardScope | null;
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
  moduleOfferingId: string;
} {
  const scope = parseScope(searchParams.get("scope") ?? "campus");
  const scopeId = collapseSpaces(searchParams.get("scopeId"));

  return {
    scope,
    facultyId: normalizeAcademicCode(
      firstValue(
        searchParams.get("facultyId"),
        scope === "faculty" ? scopeId : ""
      )
    ),
    degreeProgramId: normalizeAcademicCode(
      firstValue(
        searchParams.get("degreeProgramId"),
        scope === "degree" ? scopeId : ""
      )
    ),
    intakeId: collapseSpaces(
      firstValue(searchParams.get("intakeId"), scope === "intake" ? scopeId : "")
    ),
    moduleOfferingId: collapseSpaces(
      firstValue(
        searchParams.get("moduleOfferingId"),
        scope === "module" ? scopeId : ""
      )
    ),
  };
}

export function validateScopeOptions(options: {
  scope: LeaderboardScope | null;
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
  moduleOfferingId: string;
}, allowNonObjectIds = false) {
  if (!options.scope) {
    return "Invalid scope. Must be one of: campus, faculty, degree, intake, module";
  }

  if (options.scope === "faculty" && !options.facultyId) {
    return "scope='faculty' requires facultyId parameter";
  }

  if (options.scope === "degree" && !options.degreeProgramId) {
    return "scope='degree' requires degreeProgramId parameter";
  }

  if (options.scope === "intake" && !options.intakeId) {
    return "scope='intake' requires intakeId parameter";
  }

  if (options.scope === "module" && !options.moduleOfferingId) {
    return "scope='module' requires moduleOfferingId parameter";
  }

  if (
    options.scope === "module" &&
    options.moduleOfferingId &&
    !allowNonObjectIds &&
    !mongoose.Types.ObjectId.isValid(options.moduleOfferingId)
  ) {
    return "Invalid moduleOfferingId format";
  }

  return "";
}

function buildEnrollmentMap(rows: unknown[]) {
  const map = new Map<string, EnrollmentScopeRow>();

  rows.forEach((row) => {
    const item = asObject(row);
    const studentId = readId(item?.studentId);
    const facultyId = normalizeAcademicCode(item?.facultyId);
    const degreeProgramId = normalizeAcademicCode(item?.degreeProgramId);
    const intakeId = collapseSpaces(item?.intakeId);

    if (!studentId || map.has(studentId)) {
      return;
    }

    map.set(studentId, {
      studentId,
      facultyId,
      degreeProgramId,
      intakeId,
    });
  });

  return map;
}

async function loadIntakeNameMap(intakeIds: string[]) {
  const normalizedIds = uniqueIds(intakeIds);
  const intakeNameById = new Map<string, string>();

  const rows =
    normalizedIds.length > 0
      ? ((await IntakeModel.find({ _id: { $in: toObjectIds(normalizedIds) } })
          .select("name")
          .lean()
          .exec()
          .catch(() => [])) as unknown[])
      : [];

  rows.forEach((row) => {
    const item = asObject(row);
    const intakeId = readId(item?._id);
    const intakeName = collapseSpaces(item?.name);
    if (intakeId && intakeName) {
      intakeNameById.set(intakeId, intakeName);
    }
  });

  normalizedIds.forEach((intakeId) => {
    if (intakeNameById.has(intakeId)) {
      return;
    }

    const fallbackName = collapseSpaces(findIntakeById(intakeId)?.name);
    if (fallbackName) {
      intakeNameById.set(intakeId, fallbackName);
    }
  });

  return intakeNameById;
}

async function resolveModuleDisplayName(
  moduleId: string,
  moduleCode: string,
  moduleName: string
) {
  const resolvedCode = normalizeModuleCode(moduleCode);
  const resolvedName = collapseSpaces(moduleName);
  if (resolvedCode && resolvedName) {
    return `${resolvedCode} - ${resolvedName}`;
  }

  const normalizedModuleId = collapseSpaces(moduleId);

  if (normalizedModuleId && mongoose.Types.ObjectId.isValid(normalizedModuleId)) {
    const row = asObject(
      await ModuleModel.findById(normalizedModuleId)
        .select("code name")
        .lean()
        .exec()
        .catch(() => null)
    );
    const dbCode = normalizeModuleCode(row?.code);
    const dbName = collapseSpaces(row?.name);
    if (dbCode && dbName) {
      return `${dbCode} - ${dbName}`;
    }
  }

  if (resolvedCode) {
    const row = asObject(
      await ModuleModel.findOne({ code: resolvedCode })
        .select("code name")
        .lean()
        .exec()
        .catch(() => null)
    );
    const dbCode = normalizeModuleCode(row?.code);
    const dbName = collapseSpaces(row?.name);
    if (dbCode && dbName) {
      return `${dbCode} - ${dbName}`;
    }
  }

  const storeRecord =
    findModuleByCode(resolvedCode) ?? findModuleById(normalizedModuleId);
  if (storeRecord) {
    return `${collapseSpaces(storeRecord.code)} - ${collapseSpaces(storeRecord.name)}`;
  }

  return [resolvedCode, resolvedName].filter(Boolean).join(" - ") || null;
}

async function resolveScopeName(
  options: LeaderboardBuildOptions
): Promise<string | null> {
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
    const intakeNameById = await loadIntakeNameMap([collapseSpaces(options.intakeId)]);
    return (
      intakeNameById.get(collapseSpaces(options.intakeId)) ??
      options.intakeId ??
      null
    );
  }

  if (options.scope === "module" && options.moduleOfferingId) {
    const offering = await ModuleOfferingModel.findById(options.moduleOfferingId)
      .select("moduleId moduleCode moduleName intakeId termCode")
      .lean()
      .exec()
      .catch(() => null);
    const offeringRow = asObject(offering);
    return (
      (await resolveModuleDisplayName(
        collapseSpaces(offeringRow?.moduleId),
        normalizeModuleCode(offeringRow?.moduleCode),
        collapseSpaces(offeringRow?.moduleName)
      )) ??
      options.moduleOfferingId
    );
  }

  return null;
}

async function loadScopeStudentContext(
  options: LeaderboardBuildOptions
): Promise<ScopeStudentContext> {
  const scopeName = await resolveScopeName(options);

  if (options.scope === "campus") {
    const studentRows = (await StudentModel.find({})
      .select("_id")
      .lean()
      .exec()
      .catch(() => [])) as unknown[];
    const studentIds = uniqueIds(studentRows.map((row) => asObject(row)?._id));
    const enrollmentRows =
      studentIds.length > 0
        ? ((await EnrollmentModel.find({ studentId: { $in: toObjectIds(studentIds) } })
            .sort({ updatedAt: -1 })
            .select("studentId facultyId degreeProgramId intakeId")
            .lean()
            .exec()
            .catch(() => [])) as unknown[])
        : [];
    const intakeNameById = await loadIntakeNameMap(
      enrollmentRows.map((row) => collapseSpaces(asObject(row)?.intakeId))
    );

    return {
      scopeName,
      studentIds,
      enrollmentByStudent: buildEnrollmentMap(enrollmentRows),
      intakeNameById,
    };
  }

  if (options.scope === "faculty" || options.scope === "degree" || options.scope === "intake") {
    const query: Record<string, unknown> = {};
    if (options.scope === "faculty") {
      query.facultyId = options.facultyId;
    }
    if (options.scope === "degree") {
      query.degreeProgramId = options.degreeProgramId;
    }
    if (options.scope === "intake") {
      query.intakeId = options.intakeId;
    }

    const enrollmentRows = (await EnrollmentModel.find(query)
      .sort({ updatedAt: -1 })
      .select("studentId facultyId degreeProgramId intakeId")
      .lean()
      .exec()
      .catch(() => [])) as unknown[];
    const intakeNameById = await loadIntakeNameMap(
      enrollmentRows.map((row) => collapseSpaces(asObject(row)?.intakeId))
    );

    return {
      scopeName,
      studentIds: uniqueIds(enrollmentRows.map((row) => asObject(row)?.studentId)),
      enrollmentByStudent: buildEnrollmentMap(enrollmentRows),
      intakeNameById,
    };
  }

  const moduleOfferingObjectId = new mongoose.Types.ObjectId(
    options.moduleOfferingId ?? ""
  );

  // Enrollment does not currently store moduleOfferingId in this schema, so module
  // scope is derived from grade records and module-linked XP ledger entries.
  const [gradeStudentIds, pointsStudentIds] = await Promise.all([
    GradeModel.distinct("studentId", { moduleOfferingId: moduleOfferingObjectId }).catch(
      () => []
    ),
    GamificationPointsModel.distinct("studentId", {
      moduleOfferingId: moduleOfferingObjectId,
      isRevoked: false,
    }).catch(() => []),
  ]);

  const studentIds = uniqueIds([...gradeStudentIds, ...pointsStudentIds]);
  const enrollmentRows =
    studentIds.length > 0
      ? ((await EnrollmentModel.find({ studentId: { $in: toObjectIds(studentIds) } })
          .sort({ updatedAt: -1 })
          .select("studentId facultyId degreeProgramId intakeId")
          .lean()
          .exec()
          .catch(() => [])) as unknown[])
      : [];
  const intakeNameById = await loadIntakeNameMap(
    enrollmentRows.map((row) => collapseSpaces(asObject(row)?.intakeId))
  );

  return {
    scopeName,
    studentIds,
    enrollmentByStudent: buildEnrollmentMap(enrollmentRows),
    intakeNameById,
  };
}

function toStudentResponse(
  student: unknown,
  enrollment: EnrollmentScopeRow | undefined,
  intakeNameById: Map<string, string>
): LeaderboardStudentInfo | null {
  const row = asObject(student);
  const id = readId(row?._id);
  const registrationNumber = collapseSpaces(row?.studentId).toUpperCase();

  if (!id || !registrationNumber) {
    return null;
  }

  return {
    id,
    name: buildStudentName(student) || "Unknown Student",
    registrationNumber,
    faculty: enrollment?.facultyId
      ? findFaculty(enrollment.facultyId)?.name ?? enrollment.facultyId
      : undefined,
    degreeProgram: enrollment?.degreeProgramId
      ? findDegreeProgram(enrollment.degreeProgramId)?.name ?? enrollment.degreeProgramId
      : undefined,
    intake: enrollment?.intakeId
      ? intakeNameById.get(enrollment.intakeId) ?? enrollment.intakeId
      : undefined,
  };
}

function sortLeaderboardEntries(
  entries: InternalLeaderboardEntry[]
): InternalLeaderboardEntry[] {
  return [...entries].sort((left, right) => {
    const xpCompare = right.totalXP - left.totalXP;
    if (xpCompare !== 0) {
      return xpCompare;
    }

    // Tied students keep the same rank. Ordering within a tie is deterministic:
    // more recent XP activity first, then alphabetical by name and registration number.
    const activityCompare = right.lastAwardedAtMs - left.lastAwardedAtMs;
    if (activityCompare !== 0) {
      return activityCompare;
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

function assignCompetitionRanks(entries: InternalLeaderboardEntry[]) {
  let previousXP: number | null = null;
  let currentRank = 0;

  return entries.map((entry, index) => {
    if (previousXP === null || entry.totalXP !== previousXP) {
      currentRank = index + 1;
      previousXP = entry.totalXP;
    }

    return {
      ...entry,
      rank: currentRank,
    };
  });
}

async function loadStudentTrophies(studentIds: string[]) {
  const objectIds = toObjectIds(studentIds);
  if (objectIds.length === 0) {
    return new Map<string, LeaderboardEntry["topTrophy"]>();
  }

  const rows = (await TrophyModel.aggregate<TrophyLookupRow>([
    {
      $match: {
        studentId: { $in: objectIds },
        isHidden: false,
      },
    },
    {
      $addFields: {
        trophyTierRank: {
          $switch: {
            branches: [
              { case: { $eq: ["$trophyTier", "diamond"] }, then: 5 },
              { case: { $eq: ["$trophyTier", "platinum"] }, then: 4 },
              { case: { $eq: ["$trophyTier", "gold"] }, then: 3 },
              { case: { $eq: ["$trophyTier", "silver"] }, then: 2 },
              { case: { $eq: ["$trophyTier", "bronze"] }, then: 1 },
            ],
            default: 0,
          },
        },
      },
    },
    {
      $sort: {
        trophyTierRank: -1,
        earnedAt: -1,
        createdAt: -1,
      },
    },
    {
      $group: {
        _id: "$studentId",
        trophyKey: { $first: "$trophyKey" },
        trophyName: { $first: "$trophyName" },
        trophyIcon: { $first: "$trophyIcon" },
        trophyTier: { $first: "$trophyTier" },
      },
    },
  ]).exec().catch(() => [])) as TrophyLookupRow[];

  const trophyMap = new Map<string, LeaderboardEntry["topTrophy"]>();
  rows.forEach((row) => {
    const id = readId(row._id);
    if (!id) {
      return;
    }

    trophyMap.set(id, {
      key: collapseSpaces(row.trophyKey),
      name: collapseSpaces(row.trophyName),
      icon: collapseSpaces(row.trophyIcon),
      tier: collapseSpaces(row.trophyTier),
    });
  });

  return trophyMap;
}

async function loadStudentXPMap(
  studentIds: string[],
  options: LeaderboardBuildOptions
) {
  const objectIds = toObjectIds(studentIds);
  const xpMap = new Map<
    string,
    {
      totalXP: number;
      lastAwardedAtMs: number;
      last7Days: number;
      last30Days: number;
    }
  >();

  if (objectIds.length === 0) {
    return xpMap;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const match: Record<string, unknown> = {
    studentId: { $in: objectIds },
    isRevoked: false,
  };

  if (options.scope === "module" && options.moduleOfferingId) {
    match.moduleOfferingId = new mongoose.Types.ObjectId(options.moduleOfferingId);
  }

  const rows = (await GamificationPointsModel.aggregate<AggregatedXPRow>([
    {
      $match: match,
    },
    {
      $group: {
        _id: "$studentId",
        totalXP: { $sum: "$xpPoints" },
        lastAwardedAt: { $max: "$createdAt" },
        last7Days: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", sevenDaysAgo] }, "$xpPoints", 0],
          },
        },
        last30Days: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", thirtyDaysAgo] }, "$xpPoints", 0],
          },
        },
      },
    },
  ]).exec().catch(() => [])) as AggregatedXPRow[];

  rows.forEach((row) => {
    const id = readId(row._id);
    if (!id) {
      return;
    }

    xpMap.set(id, {
      totalXP: roundToTwo(Number(row.totalXP ?? 0)),
      lastAwardedAtMs: row.lastAwardedAt
        ? new Date(row.lastAwardedAt).getTime()
        : 0,
      last7Days: roundToTwo(Number(row.last7Days ?? 0)),
      last30Days: roundToTwo(Number(row.last30Days ?? 0)),
    });
  });

  return xpMap;
}

export async function buildLeaderboardData(
  options: LeaderboardBuildOptions
): Promise<LeaderboardBuildResult> {
  // If campus-wide usage grows, this is the right place to add short-lived caching
  // because all leaderboard endpoints reuse the same underlying dataset.
  const scopeContext = await loadScopeStudentContext(options);
  const scopedStudentIds = scopeContext.studentIds;

  if (scopedStudentIds.length === 0) {
    return {
      scope: options.scope,
      scopeName: scopeContext.scopeName,
      totalStudents: 0,
      activeParticipants: 0,
      entries: [],
    };
  }

  const [studentRows, xpMap, trophyMap] = await Promise.all([
    StudentModel.find({ _id: { $in: toObjectIds(scopedStudentIds) } })
      .select("studentId firstName lastName")
      .lean()
      .exec()
      .catch(() => []),
    loadStudentXPMap(scopedStudentIds, options),
    loadStudentTrophies(scopedStudentIds),
  ]);

  const internalEntries = (studentRows as unknown[])
    .map((student) => {
      const row = asObject(student);
      const studentObjectId = readId(row?._id);
      const studentInfo = toStudentResponse(
        student,
        scopeContext.enrollmentByStudent.get(studentObjectId),
        scopeContext.intakeNameById
      );
      if (!studentInfo) {
        return null;
      }

      const xpRow = xpMap.get(studentObjectId);
      const totalXP = roundToTwo(Number(xpRow?.totalXP ?? 0));
      const level = getCurrentLevel(totalXP);

      return {
        rank: 0,
        studentObjectId,
        student: studentInfo,
        totalXP,
        level: {
          number: level.level,
          name: level.name,
          title: level.title,
          icon: level.icon,
          color: level.color,
        },
        topTrophy: trophyMap.get(studentObjectId) ?? null,
        xpChange: {
          last7Days: roundToTwo(Number(xpRow?.last7Days ?? 0)),
          last30Days: roundToTwo(Number(xpRow?.last30Days ?? 0)),
        },
        lastAwardedAtMs: Number(xpRow?.lastAwardedAtMs ?? 0),
      } satisfies InternalLeaderboardEntry;
    })
    .filter((entry): entry is InternalLeaderboardEntry => Boolean(entry));

  const rankedEntries = assignCompetitionRanks(sortLeaderboardEntries(internalEntries));

  return {
    scope: options.scope,
    scopeName: scopeContext.scopeName,
    // totalStudents keeps cohort-wide ranking semantics, while activeParticipants
    // counts students who currently have at least one non-revoked XP ledger entry.
    totalStudents: rankedEntries.length,
    activeParticipants: xpMap.size,
    entries: rankedEntries.map((entry) => ({
      rank: entry.rank,
      student: entry.student,
      totalXP: entry.totalXP,
      level: entry.level,
      topTrophy: entry.topTrophy,
      xpChange: entry.xpChange,
    })),
  };
}

function buildPersonalRank(
  entries: LeaderboardEntry[],
  studentId: string,
  activeParticipants: number
): {
  rank: number | null;
  totalXP: number | null;
  totalStudents: number;
  percentile: number | null;
  message: string | null;
} {
  const totalStudents = entries.length;
  const currentEntry = entries.find((entry) => entry.student.id === studentId);

  if (!currentEntry) {
    return {
      rank: null,
      totalXP: null,
      totalStudents,
      percentile: null,
      message:
        activeParticipants > 0 && activeParticipants !== totalStudents
          ? `You are not part of this leaderboard scope (${activeParticipants} active participants)`
          : "You are not part of this leaderboard scope",
    };
  }

  const percentile =
    totalStudents > 0
      ? roundToOne(((totalStudents - currentEntry.rank) / totalStudents) * 100)
      : 0;

  return {
    rank: currentEntry.rank,
    totalXP: currentEntry.totalXP,
    totalStudents,
    percentile,
    message:
      activeParticipants > 0 && activeParticipants !== totalStudents
        ? `You are #${currentEntry.rank} out of ${totalStudents} students (${activeParticipants} active participants)`
        : `You are #${currentEntry.rank} out of ${totalStudents} students`,
  };
}

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);

    const { searchParams } = new URL(request.url);
    const scopeOptions = parseScopeOptions(searchParams);
    const validationError = validateScopeOptions(
      scopeOptions,
      !mongooseConnection
    );

    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const limit = parsePageParam(searchParams.get("limit"), 50, 100);
    const page = parsePageParam(searchParams.get("page"), 1, 100000);
    const requestingStudentId = collapseSpaces(searchParams.get("studentId"));

    if (
      mongooseConnection &&
      requestingStudentId &&
      !mongoose.Types.ObjectId.isValid(requestingStudentId)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid studentId format" },
        { status: 400 }
      );
    }

    if (requestingStudentId) {
      const studentExists = mongooseConnection
        ? await StudentModel.exists({ _id: requestingStudentId }).catch(() => null)
        : hasDemoStudent(requestingStudentId);
      if (!studentExists) {
        return NextResponse.json(
          { success: false, error: "Student not found" },
          { status: 404 }
        );
      }
    }

    const leaderboardData = mongooseConnection
      ? await buildLeaderboardData({
          scope: scopeOptions.scope as LeaderboardScope,
          facultyId: scopeOptions.facultyId,
          degreeProgramId: scopeOptions.degreeProgramId,
          intakeId: scopeOptions.intakeId,
          moduleOfferingId: scopeOptions.moduleOfferingId,
        })
      : buildDemoLeaderboardData({
          scope: scopeOptions.scope as LeaderboardScope,
          facultyId: scopeOptions.facultyId,
          degreeProgramId: scopeOptions.degreeProgramId,
          intakeId: scopeOptions.intakeId,
          moduleOfferingId: scopeOptions.moduleOfferingId,
        });

    const totalEntries = leaderboardData.entries.length;
    const totalPages = totalEntries > 0 ? Math.ceil(totalEntries / limit) : 1;
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const pagedEntries = leaderboardData.entries.slice(start, start + limit);

    return NextResponse.json({
      success: true,
      data: {
        scope: leaderboardData.scope,
        scopeName: leaderboardData.scopeName,
        totalStudents: leaderboardData.totalStudents,
        activeParticipants: leaderboardData.activeParticipants,
        lastUpdated: new Date().toISOString(),
        personalRank: requestingStudentId
          ? buildPersonalRank(
              leaderboardData.entries,
              requestingStudentId,
              leaderboardData.activeParticipants
            )
          : null,
        leaderboard: pagedEntries,
        pagination: {
          page: safePage,
          limit,
          totalPages,
          totalEntries,
          hasNext: safePage < totalPages,
          hasPrev: safePage > 1,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
