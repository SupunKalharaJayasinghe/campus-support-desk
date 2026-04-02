import type { ConsultationBookingStatus } from "@/models/consultation-booking";

export type ConsultationBookingCancelledByRole =
  | "STUDENT"
  | "LECTURER"
  | "SYSTEM";

export interface ConsultationBookingPersistedRecord {
  id: string;
  slotId: string;
  lecturerId: string;
  studentId: string;
  purpose: string;
  status: ConsultationBookingStatus;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledByRole: ConsultationBookingCancelledByRole | null;
  cancelledReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationBookingWriteInput {
  slotId: string;
  lecturerId: string;
  studentId: string;
  purpose: string;
  status: ConsultationBookingStatus;
  confirmedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledByRole?: ConsultationBookingCancelledByRole | null;
  cancelledReason?: string;
}

const INITIAL_CONSULTATION_BOOKINGS: ConsultationBookingPersistedRecord[] = [
  {
    id: "booking-demo-1",
    slotId: "slot-lec-rsilva-2026-04-10-0900",
    lecturerId: "lec-rsilva",
    studentId: "stu-demo-1",
    purpose: "Career guidance and internship planning",
    status: "CONFIRMED",
    confirmedAt: "2026-04-01T08:00:00.000Z",
    completedAt: null,
    cancelledAt: null,
    cancelledByRole: null,
    cancelledReason: "",
    createdAt: "2026-04-01T07:55:00.000Z",
    updatedAt: "2026-04-01T08:00:00.000Z",
  },
];

const globalForConsultationBookingStore = globalThis as typeof globalThis & {
  __consultationBookingStore?: ConsultationBookingPersistedRecord[];
};

function consultationBookingStore() {
  if (!globalForConsultationBookingStore.__consultationBookingStore) {
    globalForConsultationBookingStore.__consultationBookingStore =
      INITIAL_CONSULTATION_BOOKINGS.map((item) => ({ ...item }));
  }

  return globalForConsultationBookingStore.__consultationBookingStore;
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

export function sanitizeConsultationBookingPurpose(value: unknown) {
  return collapseSpaces(value).slice(0, 300);
}

export function sanitizeConsultationBookingStatus(
  value: unknown
): ConsultationBookingStatus {
  if (value === "CONFIRMED") {
    return "CONFIRMED";
  }
  if (value === "COMPLETED") {
    return "COMPLETED";
  }
  if (value === "CANCELLED") {
    return "CANCELLED";
  }
  return "PENDING";
}

export function sanitizeConsultationBookingCancelledByRole(
  value: unknown
): ConsultationBookingCancelledByRole | null {
  if (value === "STUDENT" || value === "LECTURER" || value === "SYSTEM") {
    return value;
  }

  return null;
}

export function sanitizeConsultationCancelledReason(value: unknown) {
  return collapseSpaces(value).slice(0, 300);
}

export function listConsultationBookingsInMemory(options?: {
  slotId?: string;
  lecturerId?: string;
  studentId?: string;
  status?: "" | ConsultationBookingStatus;
}) {
  const slotId = String(options?.slotId ?? "").trim();
  const lecturerId = String(options?.lecturerId ?? "").trim();
  const studentId = String(options?.studentId ?? "").trim();
  const status = options?.status ?? "";

  return consultationBookingStore()
    .filter((row) => (slotId ? row.slotId === slotId : true))
    .filter((row) => (lecturerId ? row.lecturerId === lecturerId : true))
    .filter((row) => (studentId ? row.studentId === studentId : true))
    .filter((row) => (status ? row.status === status : true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((row) => ({ ...row }));
}

export function findConsultationBookingInMemoryById(id: string) {
  const targetId = String(id ?? "").trim();
  if (!targetId) {
    return null;
  }

  const row = consultationBookingStore().find((item) => item.id === targetId);
  return row ? { ...row } : null;
}

export function createConsultationBookingInMemory(
  input: ConsultationBookingWriteInput
) {
  const now = new Date().toISOString();
  const record: ConsultationBookingPersistedRecord = {
    id: `booking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    slotId: String(input.slotId ?? "").trim(),
    lecturerId: String(input.lecturerId ?? "").trim(),
    studentId: String(input.studentId ?? "").trim(),
    purpose: sanitizeConsultationBookingPurpose(input.purpose),
    status: sanitizeConsultationBookingStatus(input.status),
    confirmedAt: toIsoTimestamp(input.confirmedAt) || null,
    completedAt: toIsoTimestamp(input.completedAt) || null,
    cancelledAt: toIsoTimestamp(input.cancelledAt) || null,
    cancelledByRole: sanitizeConsultationBookingCancelledByRole(
      input.cancelledByRole
    ),
    cancelledReason: sanitizeConsultationCancelledReason(input.cancelledReason),
    createdAt: now,
    updatedAt: now,
  };

  consultationBookingStore().unshift(record);
  return { ...record };
}

export function updateConsultationBookingInMemory(
  id: string,
  input: ConsultationBookingWriteInput
) {
  const targetId = String(id ?? "").trim();
  const store = consultationBookingStore();
  const index = store.findIndex((item) => item.id === targetId);
  if (index < 0) {
    return null;
  }

  const updated: ConsultationBookingPersistedRecord = {
    ...store[index],
    slotId: String(input.slotId ?? "").trim(),
    lecturerId: String(input.lecturerId ?? "").trim(),
    studentId: String(input.studentId ?? "").trim(),
    purpose: sanitizeConsultationBookingPurpose(input.purpose),
    status: sanitizeConsultationBookingStatus(input.status),
    confirmedAt: toIsoTimestamp(input.confirmedAt) || null,
    completedAt: toIsoTimestamp(input.completedAt) || null,
    cancelledAt: toIsoTimestamp(input.cancelledAt) || null,
    cancelledByRole: sanitizeConsultationBookingCancelledByRole(
      input.cancelledByRole
    ),
    cancelledReason: sanitizeConsultationCancelledReason(input.cancelledReason),
    updatedAt: new Date().toISOString(),
  };

  store[index] = updated;
  return { ...updated };
}

export function toConsultationBookingPersistedRecordFromUnknown(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = readId(row._id ?? row.id);
  const slotId = readId(row.slotId);
  const lecturerId = readId(row.lecturerId);
  const studentId = readId(row.studentId);
  const purpose = sanitizeConsultationBookingPurpose(row.purpose);

  if (!id || !slotId || !lecturerId || !studentId || !purpose) {
    return null;
  }

  return {
    id,
    slotId,
    lecturerId,
    studentId,
    purpose,
    status: sanitizeConsultationBookingStatus(row.status),
    confirmedAt: toIsoTimestamp(row.confirmedAt) || null,
    completedAt: toIsoTimestamp(row.completedAt) || null,
    cancelledAt: toIsoTimestamp(row.cancelledAt) || null,
    cancelledByRole: sanitizeConsultationBookingCancelledByRole(
      row.cancelledByRole
    ),
    cancelledReason: sanitizeConsultationCancelledReason(row.cancelledReason),
    createdAt: toIsoTimestamp(row.createdAt),
    updatedAt: toIsoTimestamp(row.updatedAt),
  } satisfies ConsultationBookingPersistedRecord;
}
