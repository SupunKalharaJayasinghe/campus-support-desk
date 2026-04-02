import mongoose from "mongoose";
import { DegreeProgramModel } from "@/models/DegreeProgram";
import { FacultyModel } from "@/models/Faculty";
import { IntakeRecordModel } from "@/models/IntakeRecord";
import {
  replaceDegreeProgramStore,
  type DegreeProgramRecord,
} from "@/models/degree-program-store";
import { replaceFacultyStore, type FacultyRecord } from "@/models/faculty-store";
import { replaceIntakeStore, type IntakeRecord } from "@/models/intake-store";

const globalForAcademicCache = globalThis as typeof globalThis & {
  __academicReferenceLastSyncedAt?: number;
  __academicReferenceSyncPromise?: Promise<boolean> | null;
};

const DEFAULT_ACADEMIC_CACHE_MIN_INTERVAL_MS = 60_000;
const FACULTY_FIELDS = "code name status isDeleted createdAt updatedAt";
const DEGREE_FIELDS =
  "code name facultyCode award credits durationYears status isDeleted createdAt updatedAt";
const INTAKE_FIELDS =
  "id name facultyCode degreeCode intakeYear intakeMonth stream status currentTerm autoJumpEnabled lockPastTerms defaultWeeksPerTerm defaultNotifyBeforeDays autoGenerateFutureTerms termSchedules notifications isDeleted createdAt updatedAt";

function toIsoDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function toFacultyRecord(row: Record<string, unknown>): FacultyRecord | null {
  const code = normalizeCode(row.code);
  const name = String(row.name ?? "").trim();
  if (!code || !name) {
    return null;
  }

  return {
    code,
    name,
    status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    isDeleted: row.isDeleted === true,
  };
}

function toDegreeProgramRecord(
  row: Record<string, unknown>
): DegreeProgramRecord | null {
  const code = normalizeCode(row.code);
  const facultyCode = normalizeCode(row.facultyCode);
  const name = String(row.name ?? "").trim();
  const award = String(row.award ?? "").trim();
  const credits = Number(row.credits);
  const durationYears = Number(row.durationYears);
  if (!code || !facultyCode || !name || !award) {
    return null;
  }

  const status =
    row.status === "INACTIVE" || row.status === "DRAFT"
      ? (row.status as "INACTIVE" | "DRAFT")
      : "ACTIVE";

  return {
    code,
    name,
    facultyCode,
    award,
    credits: Number.isFinite(credits) ? Math.max(0, Math.floor(credits)) : 0,
    durationYears: Number.isFinite(durationYears)
      ? Math.max(0, Math.floor(durationYears))
      : 0,
    status,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    isDeleted: row.isDeleted === true,
  };
}

function toIntakeRecord(row: Record<string, unknown>): IntakeRecord | null {
  const id = String(row.id ?? "").trim();
  const name = String(row.name ?? "").trim();
  const facultyCode = normalizeCode(row.facultyCode);
  const degreeCode = normalizeCode(row.degreeCode);
  if (!id || !name || !facultyCode || !degreeCode) {
    return null;
  }

  const termSchedules = Array.isArray(row.termSchedules)
    ? row.termSchedules
        .map((schedule) => {
          if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
            return null;
          }

          const item = schedule as Record<string, unknown>;
          const termCode = String(item.termCode ?? "").trim().toUpperCase();
          const startDate = String(item.startDate ?? "").trim();
          const endDate = String(item.endDate ?? "").trim();
          const weeks = Number(item.weeks);
          const notifyBeforeDays = Number(item.notifyBeforeDays);
          if (!termCode || !startDate || !endDate) {
            return null;
          }

          return {
            termCode: termCode as IntakeRecord["termSchedules"][number]["termCode"],
            startDate,
            endDate,
            weeks: Number.isFinite(weeks) ? Math.max(1, Math.floor(weeks)) : 16,
            notifyBeforeDays:
              notifyBeforeDays === 1 || notifyBeforeDays === 7 ? notifyBeforeDays : 3,
            isManuallyCustomized: item.isManuallyCustomized === true,
            notificationSentAt: String(item.notificationSentAt ?? "").trim(),
          };
        })
        .filter(
          (item): item is IntakeRecord["termSchedules"][number] => Boolean(item)
        )
    : [];

  const notifications = Array.isArray(row.notifications)
    ? row.notifications
        .map((notification) => {
          if (
            !notification ||
            typeof notification !== "object" ||
            Array.isArray(notification)
          ) {
            return null;
          }

          const item = notification as Record<string, unknown>;
          const notificationId = String(item.id ?? "").trim();
          const termCode = String(item.termCode ?? "").trim().toUpperCase();
          const title = String(item.title ?? "").trim();
          const message = String(item.message ?? "").trim();
          const sentAt = String(item.sentAt ?? "").trim();
          const target = String(item.target ?? "").trim();
          if (
            !notificationId ||
            !termCode ||
            !title ||
            !message ||
            !sentAt ||
            !target
          ) {
            return null;
          }

          return {
            id: notificationId,
            termCode: termCode as IntakeRecord["notifications"][number]["termCode"],
            title,
            message,
            sentAt,
            target,
          };
        })
        .filter(
          (item): item is IntakeRecord["notifications"][number] => Boolean(item)
        )
    : [];

  const intakeYear = Number(row.intakeYear);
  const status =
    row.status === "INACTIVE" || row.status === "DRAFT"
      ? (row.status as "INACTIVE" | "DRAFT")
      : "ACTIVE";

  return {
    id,
    name,
    facultyCode,
    degreeCode,
    intakeYear: Number.isFinite(intakeYear) ? Math.floor(intakeYear) : 0,
    intakeMonth: String(row.intakeMonth ?? "").trim(),
    stream: String(row.stream ?? "").trim(),
    status,
    currentTerm: String(row.currentTerm ?? "Y1S1").trim().toUpperCase() as IntakeRecord["currentTerm"],
    autoJumpEnabled: row.autoJumpEnabled !== false,
    lockPastTerms: row.lockPastTerms !== false,
    defaultWeeksPerTerm: Number.isFinite(Number(row.defaultWeeksPerTerm))
      ? Math.max(1, Math.floor(Number(row.defaultWeeksPerTerm)))
      : 16,
    defaultNotifyBeforeDays:
      Number(row.defaultNotifyBeforeDays) === 1 ||
      Number(row.defaultNotifyBeforeDays) === 7
        ? (Number(row.defaultNotifyBeforeDays) as 1 | 7)
        : 3,
    autoGenerateFutureTerms: row.autoGenerateFutureTerms !== false,
    termSchedules,
    notifications,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    isDeleted: row.isDeleted === true,
  };
}

export async function syncAcademicReferenceCaches(options?: {
  force?: boolean;
  minIntervalMs?: number;
}) {
  if (mongoose.connection.readyState !== 1) {
    return false;
  }

  const now = Date.now();
  const minIntervalMs = Math.max(
    1000,
    options?.minIntervalMs ?? DEFAULT_ACADEMIC_CACHE_MIN_INTERVAL_MS
  );
  const lastSyncedAt = globalForAcademicCache.__academicReferenceLastSyncedAt ?? 0;
  if (!options?.force && now - lastSyncedAt < minIntervalMs) {
    return true;
  }

  const ongoingSync = globalForAcademicCache.__academicReferenceSyncPromise;
  if (ongoingSync) {
    if (!options?.force) {
      return ongoingSync;
    }

    await ongoingSync.catch(() => null);
  }

  const syncPromise = (async () => {
    const [facultyRows, degreeRows, intakeRows] = await Promise.all([
      FacultyModel.find({}, FACULTY_FIELDS)
        .lean()
        .exec()
        .catch(() => [] as unknown[]),
      DegreeProgramModel.find({}, DEGREE_FIELDS)
        .lean()
        .exec()
        .catch(() => [] as unknown[]),
      IntakeRecordModel.find({}, INTAKE_FIELDS)
        .lean()
        .exec()
        .catch(() => [] as unknown[]),
    ]);

    const faculties = facultyRows
      .map((row) => toFacultyRecord((row ?? {}) as Record<string, unknown>))
      .filter((item): item is FacultyRecord => Boolean(item));
    const degrees = degreeRows
      .map((row) => toDegreeProgramRecord((row ?? {}) as Record<string, unknown>))
      .filter((item): item is DegreeProgramRecord => Boolean(item));
    const intakes = intakeRows
      .map((row) => toIntakeRecord((row ?? {}) as Record<string, unknown>))
      .filter((item): item is IntakeRecord => Boolean(item));

    replaceFacultyStore(faculties);
    replaceDegreeProgramStore(degrees);
    replaceIntakeStore(intakes);
    globalForAcademicCache.__academicReferenceLastSyncedAt = Date.now();
    return true;
  })();

  globalForAcademicCache.__academicReferenceSyncPromise = syncPromise;
  try {
    return await syncPromise;
  } finally {
    if (globalForAcademicCache.__academicReferenceSyncPromise === syncPromise) {
      globalForAcademicCache.__academicReferenceSyncPromise = null;
    }
  }
}
