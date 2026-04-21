import {
  type ConsultationSlotMode,
  type ConsultationSlotStatus,
} from "@/models/consultation-availability";
import { isDemoModeEnabled } from "@/models/rbac";

export interface ConsultationAvailabilitySlotPersistedRecord {
  id: string;
  lecturerId: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionType: string;
  mode: ConsultationSlotMode;
  location: string;
  meetingLink: string;
  status: ConsultationSlotStatus;
  bookingId: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface ConsultationAvailabilitySlotWriteInput {
  lecturerId: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionType: string;
  mode: ConsultationSlotMode;
  location: string;
  meetingLink: string;
  status: ConsultationSlotStatus;
  bookingId?: string | null;
}

const INITIAL_CONSULTATION_AVAILABILITY_SLOTS: ConsultationAvailabilitySlotPersistedRecord[] =
  isDemoModeEnabled()
    ? [
        {
          id: "slot-lec-kperera-2026-04-08-0900",
          lecturerId: "lec-kperera",
          date: "2026-04-08",
          startTime: "09:00",
          endTime: "09:30",
          sessionType: "Academic Consultation",
          mode: "IN_PERSON",
          location: "Main Office",
          meetingLink: "",
          status: "AVAILABLE",
          bookingId: null,
          createdAt: "2026-03-31T08:00:00.000Z",
          updatedAt: "2026-03-31T08:00:00.000Z",
          isDeleted: false,
        },
        {
          id: "slot-lec-kperera-2026-04-08-1030",
          lecturerId: "lec-kperera",
          date: "2026-04-08",
          startTime: "10:30",
          endTime: "11:00",
          sessionType: "Project Feedback",
          mode: "ONLINE",
          location: "",
          meetingLink: "",
          status: "AVAILABLE",
          bookingId: null,
          createdAt: "2026-03-31T08:05:00.000Z",
          updatedAt: "2026-03-31T08:05:00.000Z",
          isDeleted: false,
        },
        {
          id: "slot-lec-rsilva-2026-04-09-1400",
          lecturerId: "lec-rsilva",
          date: "2026-04-09",
          startTime: "14:00",
          endTime: "14:30",
          sessionType: "Thesis Review",
          mode: "HYBRID",
          location: "Room 203",
          meetingLink: "",
          status: "AVAILABLE",
          bookingId: null,
          createdAt: "2026-03-31T09:00:00.000Z",
          updatedAt: "2026-03-31T09:00:00.000Z",
          isDeleted: false,
        },
        {
          id: "slot-lec-rsilva-2026-04-10-0900",
          lecturerId: "lec-rsilva",
          date: "2026-04-10",
          startTime: "09:00",
          endTime: "09:30",
          sessionType: "Career Guidance",
          mode: "IN_PERSON",
          location: "Faculty Lounge",
          meetingLink: "",
          status: "BOOKED",
          bookingId: "booking-demo-1",
          createdAt: "2026-03-31T09:10:00.000Z",
          updatedAt: "2026-03-31T09:10:00.000Z",
          isDeleted: false,
        },
        {
          id: "slot-lec-kperera-2026-04-03-1030",
          lecturerId: "lec-kperera",
          date: "2026-04-03",
          startTime: "10:30",
          endTime: "11:00",
          sessionType: "Academic Consultation",
          mode: "ONLINE",
          location: "",
          meetingLink: "",
          status: "BOOKED",
          bookingId: "booking-demo-2",
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:00.000Z",
          isDeleted: false,
        },
      ]
    : [];

const DEMO_CONSULTATION_AVAILABILITY_SLOT_IDS = new Set([
  "slot-lec-kperera-2026-04-08-0900",
  "slot-lec-kperera-2026-04-08-1030",
  "slot-lec-rsilva-2026-04-09-1400",
  "slot-lec-rsilva-2026-04-10-0900",
  "slot-lec-kperera-2026-04-03-1030",
]);

const globalForConsultationAvailabilityStore = globalThis as typeof globalThis & {
  __consultationAvailabilityStore?: ConsultationAvailabilitySlotPersistedRecord[];
};

function consultationAvailabilityStore() {
  if (!globalForConsultationAvailabilityStore.__consultationAvailabilityStore) {
    globalForConsultationAvailabilityStore.__consultationAvailabilityStore =
      INITIAL_CONSULTATION_AVAILABILITY_SLOTS.map((item) => ({ ...item }));
  } else if (!isDemoModeEnabled()) {
    globalForConsultationAvailabilityStore.__consultationAvailabilityStore =
      globalForConsultationAvailabilityStore.__consultationAvailabilityStore.filter(
        (item) => !DEMO_CONSULTATION_AVAILABILITY_SLOT_IDS.has(item.id)
      );
  }

  return globalForConsultationAvailabilityStore.__consultationAvailabilityStore;
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

  if (typeof value === "object" && !Array.isArray(value)) {
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

function toIsoTimestamp(value: unknown) {
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

export function sanitizeConsultationSlotDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return "";
  }

  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return "";
  }

  return raw;
}

export function sanitizeConsultationSlotTime(value: unknown) {
  const raw = String(value ?? "").trim();
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : "";
}

export function sanitizeConsultationSessionType(value: unknown) {
  return collapseSpaces(value).slice(0, 80);
}

export function sanitizeConsultationLocation(value: unknown) {
  return collapseSpaces(value).slice(0, 160);
}

export function sanitizeConsultationMeetingLink(value: unknown) {
  const raw = collapseSpaces(value).slice(0, 300);
  if (!raw) {
    return "";
  }

  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function sanitizeConsultationSlotMode(value: unknown): ConsultationSlotMode {
  return value === "ONLINE" || value === "HYBRID" ? value : "IN_PERSON";
}

export function sanitizeConsultationSlotStatus(
  value: unknown
): ConsultationSlotStatus {
  if (value === "BOOKED") {
    return "BOOKED";
  }
  if (value === "CANCELLED") {
    return "CANCELLED";
  }
  return "AVAILABLE";
}

export function compareConsultationSlotTimes(startTime: string, endTime: string) {
  return startTime.localeCompare(endTime);
}

export function isConsultationSlotTimeRangeValid(
  startTime: string,
  endTime: string
) {
  return Boolean(startTime && endTime) && compareConsultationSlotTimes(startTime, endTime) < 0;
}

export function doConsultationSlotsOverlap(
  left: Pick<
    ConsultationAvailabilitySlotPersistedRecord,
    "date" | "startTime" | "endTime"
  >,
  right: Pick<
    ConsultationAvailabilitySlotPersistedRecord,
    "date" | "startTime" | "endTime"
  >
) {
  if (left.date !== right.date) {
    return false;
  }

  return left.startTime < right.endTime && left.endTime > right.startTime;
}

function buildSlotDateTime(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function hasConsultationSlotEnded(
  row: Pick<ConsultationAvailabilitySlotPersistedRecord, "date" | "endTime">,
  now = new Date()
) {
  const slotEnd = buildSlotDateTime(row.date, row.endTime);
  if (!slotEnd) {
    return false;
  }

  return slotEnd.getTime() < now.getTime();
}

export function listConsultationAvailabilitySlotsInMemory(options?: {
  lecturerId?: string;
  status?: "" | ConsultationSlotStatus;
  mode?: "" | ConsultationSlotMode;
  from?: string;
  to?: string;
  includePast?: boolean;
  availableOnly?: boolean;
  includeDeleted?: boolean;
}) {
  const lecturerId = String(options?.lecturerId ?? "").trim();
  const status = options?.status ?? "";
  const mode = options?.mode ?? "";
  const from = sanitizeConsultationSlotDate(options?.from);
  const to = sanitizeConsultationSlotDate(options?.to);
  const includePast = options?.includePast === true;
  const availableOnly = options?.availableOnly === true;
  const includeDeleted = options?.includeDeleted === true;

  return consultationAvailabilityStore()
    .filter((row) => (includeDeleted ? true : !row.isDeleted))
    .filter((row) => (lecturerId ? row.lecturerId === lecturerId : true))
    .filter((row) => (availableOnly ? row.status === "AVAILABLE" : true))
    .filter((row) => (status ? row.status === status : true))
    .filter((row) => (mode ? row.mode === mode : true))
    .filter((row) => (from ? row.date >= from : true))
    .filter((row) => (to ? row.date <= to : true))
    .filter((row) => (includePast ? true : !hasConsultationSlotEnded(row)))
    .sort((left, right) =>
      `${left.date} ${left.startTime}`.localeCompare(`${right.date} ${right.startTime}`)
    )
    .map((row) => ({ ...row }));
}

export function findConsultationAvailabilitySlotInMemoryById(
  id: string,
  options?: { includeDeleted?: boolean }
) {
  const targetId = String(id ?? "").trim();
  if (!targetId) {
    return null;
  }

  const includeDeleted = options?.includeDeleted === true;
  const row = consultationAvailabilityStore().find(
    (item) => item.id === targetId && (includeDeleted || !item.isDeleted)
  );

  return row ? { ...row } : null;
}

export function findOverlappingConsultationAvailabilitySlotInMemory(input: {
  lecturerId: string;
  date: string;
  startTime: string;
  endTime: string;
  excludeId?: string;
}) {
  const lecturerId = String(input.lecturerId ?? "").trim();
  const excludeId = String(input.excludeId ?? "").trim();

  if (!lecturerId) {
    return null;
  }

  return (
    consultationAvailabilityStore().find((row) => {
      if (row.isDeleted || row.lecturerId !== lecturerId) {
        return false;
      }

      if (row.status === "CANCELLED") {
        return false;
      }

      if (excludeId && row.id === excludeId) {
        return false;
      }

      return doConsultationSlotsOverlap(row, input);
    }) ?? null
  );
}

export function createConsultationAvailabilitySlotInMemory(
  input: ConsultationAvailabilitySlotWriteInput
) {
  const now = new Date().toISOString();
  const record: ConsultationAvailabilitySlotPersistedRecord = {
    id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lecturerId: String(input.lecturerId ?? "").trim(),
    date: sanitizeConsultationSlotDate(input.date),
    startTime: sanitizeConsultationSlotTime(input.startTime),
    endTime: sanitizeConsultationSlotTime(input.endTime),
    sessionType: sanitizeConsultationSessionType(input.sessionType),
    mode: sanitizeConsultationSlotMode(input.mode),
    location: sanitizeConsultationLocation(input.location),
    meetingLink: sanitizeConsultationMeetingLink(input.meetingLink),
    status: sanitizeConsultationSlotStatus(input.status),
    bookingId: readId(input.bookingId) || null,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  consultationAvailabilityStore().unshift(record);
  return { ...record };
}

export function updateConsultationAvailabilitySlotInMemory(
  id: string,
  input: ConsultationAvailabilitySlotWriteInput
) {
  const targetId = String(id ?? "").trim();
  const store = consultationAvailabilityStore();
  const index = store.findIndex((item) => item.id === targetId && !item.isDeleted);
  if (index < 0) {
    return null;
  }

  const updated: ConsultationAvailabilitySlotPersistedRecord = {
    ...store[index],
    lecturerId: String(input.lecturerId ?? "").trim(),
    date: sanitizeConsultationSlotDate(input.date),
    startTime: sanitizeConsultationSlotTime(input.startTime),
    endTime: sanitizeConsultationSlotTime(input.endTime),
    sessionType: sanitizeConsultationSessionType(input.sessionType),
    mode: sanitizeConsultationSlotMode(input.mode),
    location: sanitizeConsultationLocation(input.location),
    meetingLink: sanitizeConsultationMeetingLink(input.meetingLink),
    status: sanitizeConsultationSlotStatus(input.status),
    bookingId: readId(input.bookingId) || null,
    updatedAt: new Date().toISOString(),
  };

  store[index] = updated;
  return { ...updated };
}

export function deleteConsultationAvailabilitySlotInMemory(id: string) {
  const targetId = String(id ?? "").trim();
  const store = consultationAvailabilityStore();
  const index = store.findIndex((item) => item.id === targetId && !item.isDeleted);
  if (index < 0) {
    return null;
  }

  store[index] = {
    ...store[index],
    status: "CANCELLED",
    isDeleted: true,
    updatedAt: new Date().toISOString(),
  };

  return { ...store[index] };
}

export function toConsultationAvailabilitySlotPersistedRecordFromUnknown(
  value: unknown
): ConsultationAvailabilitySlotPersistedRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = readId(row._id ?? row.id);
  const lecturerId = readId(row.lecturerId);
  const date = sanitizeConsultationSlotDate(row.date);
  const startTime = sanitizeConsultationSlotTime(row.startTime);
  const endTime = sanitizeConsultationSlotTime(row.endTime);
  const sessionType = sanitizeConsultationSessionType(row.sessionType);

  if (!id || !lecturerId || !date || !startTime || !endTime || !sessionType) {
    return null;
  }

  return {
    id,
    lecturerId,
    date,
    startTime,
    endTime,
    sessionType,
    mode: sanitizeConsultationSlotMode(row.mode),
    location: sanitizeConsultationLocation(row.location),
    meetingLink: sanitizeConsultationMeetingLink(row.meetingLink),
    status: sanitizeConsultationSlotStatus(row.status),
    bookingId: readId(row.bookingId) || null,
    createdAt: toIsoTimestamp(row.createdAt),
    updatedAt: toIsoTimestamp(row.updatedAt),
    isDeleted: row.isDeleted === true,
  };
}
