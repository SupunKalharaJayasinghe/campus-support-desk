import mongoose from "mongoose";
import "@/models/Lecturer";
import "@/models/Student";
import "@/models/User";
import { LecturerModel } from "@/models/Lecturer";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";
import type { ConsultationAvailabilitySlotPersistedRecord } from "@/models/consultation-availability-store";
import type { ConsultationBookingStatus } from "@/models/consultation-booking";
import type { ConsultationBookingPersistedRecord } from "@/models/consultation-booking-store";
import { findLecturerInMemoryById } from "@/models/lecturer-store";
import { findStudentInMemoryById } from "@/models/student-registration";

export type LecturerMeta = {
  id: string;
  fullName: string;
  email: string;
};

export type StudentMeta = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  status: string;
};

export type ConsultationActorRole = "LECTURER" | "STUDENT";

export function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function readHeaderRole(request: Request) {
  const role = collapseSpaces(request.headers.get("x-user-role")).toUpperCase();
  if (role === "LECTURER" || role === "STUDENT") {
    return role as ConsultationActorRole;
  }

  return "";
}

export function readId(value: unknown) {
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

export function sanitizeConsultationBookingScope(value: string | null) {
  return value === "lecturer" ? "lecturer" : "student";
}

export function sanitizeConsultationBookingStatusFilter(
  value: string | null
): "" | ConsultationBookingStatus {
  if (
    value === "PENDING" ||
    value === "CONFIRMED" ||
    value === "COMPLETED" ||
    value === "CANCELLED"
  ) {
    return value;
  }

  return "";
}

export function sanitizeConsultationBookingAction(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "CANCEL" || normalized === "CANCELLED") {
    return "cancel" as const;
  }
  if (normalized === "CONFIRM" || normalized === "CONFIRMED") {
    return "confirm" as const;
  }
  if (normalized === "COMPLETE" || normalized === "COMPLETED") {
    return "complete" as const;
  }

  return "" as const;
}

export function toLecturerMeta(value: unknown): LecturerMeta | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = readId(row._id ?? row.id);
  const fullName = collapseSpaces(row.fullName);
  const email = collapseSpaces(row.email).toLowerCase();
  if (!id || !fullName) {
    return null;
  }

  return { id, fullName, email };
}

export function toStudentMeta(value: unknown): StudentMeta | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = readId(row._id ?? row.id);
  const studentId = collapseSpaces(row.studentId).toUpperCase();
  const firstName = collapseSpaces(row.firstName);
  const lastName = collapseSpaces(row.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const email = collapseSpaces(row.email).toLowerCase();
  const status = collapseSpaces(row.status).toUpperCase();

  if (!id) {
    return null;
  }

  return {
    id,
    studentId: studentId || id,
    firstName,
    lastName,
    fullName: fullName || studentId || id,
    email,
    status,
  };
}

export async function findLecturerMetaById(
  lecturerId: string,
  mongooseConnection: mongoose.Mongoose | null
) {
  const targetId = String(lecturerId ?? "").trim();
  if (!targetId) {
    return null;
  }

  if (!mongooseConnection) {
    const row = findLecturerInMemoryById(targetId);
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
    } satisfies LecturerMeta;
  }

  const row = await LecturerModel.findById(targetId)
    .select({ fullName: 1, email: 1 })
    .lean()
    .exec()
    .catch(() => null);

  return toLecturerMeta(row);
}

export async function findStudentMetaById(
  studentId: string,
  mongooseConnection: mongoose.Mongoose | null
) {
  const targetId = String(studentId ?? "").trim();
  if (!targetId) {
    return null;
  }

  if (!mongooseConnection) {
    const row = findStudentInMemoryById(targetId);
    if (!row) {
      return {
        id: targetId,
        studentId: targetId,
        firstName: "",
        lastName: "",
        fullName: targetId,
        email: "",
        status: "",
      } satisfies StudentMeta;
    }

    return {
      id: row.id,
      studentId: row.studentId,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: [row.firstName, row.lastName].filter(Boolean).join(" ").trim(),
      email: row.email,
      status: row.status,
    } satisfies StudentMeta;
  }

  const row = await StudentModel.findById(targetId)
    .select({ studentId: 1, firstName: 1, lastName: 1, email: 1, status: 1 })
    .lean()
    .exec()
    .catch(() => null);

  return toStudentMeta(row);
}

async function resolveActiveLecturerIdFromDb(lecturerId: string) {
  const targetId = String(lecturerId ?? "").trim();
  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    return "";
  }

  const row = await LecturerModel.findById(targetId)
    .select({ status: 1 })
    .lean()
    .exec()
    .catch(() => null);
  const status = collapseSpaces(asObject(row)?.status).toUpperCase();
  if (!row || (status && status !== "ACTIVE")) {
    return "";
  }

  return targetId;
}

async function resolveActiveStudentIdFromDb(studentId: string) {
  const targetId = String(studentId ?? "").trim();
  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    return "";
  }

  const row = await StudentModel.findById(targetId)
    .select({ status: 1 })
    .lean()
    .exec()
    .catch(() => null);
  const status = collapseSpaces(asObject(row)?.status).toUpperCase();
  if (!row || (status && status !== "ACTIVE")) {
    return "";
  }

  return targetId;
}

export async function resolveCurrentLecturerId(
  request: Request,
  mongooseConnection: mongoose.Mongoose | null,
  fallbackLecturerId?: string
) {
  const headerUserId = String(request.headers.get("x-user-id") ?? "").trim();
  const headerRole = readHeaderRole(request);
  const fallbackId = String(fallbackLecturerId ?? "").trim();

  if (!mongooseConnection) {
    if (headerRole !== "LECTURER") {
      return "";
    }

    const directLecturerId =
      (headerUserId && findLecturerInMemoryById(headerUserId)?.id) || fallbackId;
    if (!directLecturerId) {
      return "";
    }

    const lecturer = findLecturerInMemoryById(directLecturerId);
    if (!lecturer || lecturer.status !== "ACTIVE") {
      return "";
    }

    return lecturer.id;
  }

  if (headerUserId && mongoose.Types.ObjectId.isValid(headerUserId)) {
    const user = await UserModel.findById(headerUserId)
      .select({ role: 1, status: 1, lecturerRef: 1 })
      .lean()
      .exec()
      .catch(() => null);

    const row = asObject(user);
    const role = collapseSpaces(row?.role).toUpperCase();
    const status = collapseSpaces(row?.status).toUpperCase();
    const lecturerId = readId(row?.lecturerRef);

    if (role === "LECTURER" && status === "ACTIVE" && lecturerId) {
      return lecturerId;
    }
  }

  if (headerRole === "LECTURER") {
    const fallbackCandidates = Array.from(new Set([fallbackId, headerUserId])).filter(
      Boolean
    );
    for (const candidateId of fallbackCandidates) {
      const resolvedId = await resolveActiveLecturerIdFromDb(candidateId);
      if (resolvedId) {
        return resolvedId;
      }
    }
  }

  return "";
}

export async function resolveCurrentStudentId(
  request: Request,
  mongooseConnection: mongoose.Mongoose | null,
  fallbackStudentId?: string
) {
  const headerUserId = String(request.headers.get("x-user-id") ?? "").trim();
  const headerRole = readHeaderRole(request);
  const fallbackId = String(fallbackStudentId ?? "").trim();

  if (!mongooseConnection) {
    if (headerRole !== "STUDENT") {
      return "";
    }

    const directStudentId =
      (headerUserId && findStudentInMemoryById(headerUserId)?.id) || fallbackId;

    return directStudentId || "";
  }

  if (headerUserId && mongoose.Types.ObjectId.isValid(headerUserId)) {
    const user = await UserModel.findById(headerUserId)
      .select({ role: 1, status: 1, studentRef: 1 })
      .lean()
      .exec()
      .catch(() => null);

    const row = asObject(user);
    const role = collapseSpaces(row?.role).toUpperCase();
    const status = collapseSpaces(row?.status).toUpperCase();
    const studentId = readId(row?.studentRef);

    if (role === "STUDENT" && status === "ACTIVE" && studentId) {
      return studentId;
    }
  }

  if (headerRole === "STUDENT") {
    const fallbackCandidates = Array.from(new Set([fallbackId, headerUserId])).filter(
      Boolean
    );
    for (const candidateId of fallbackCandidates) {
      const resolvedId = await resolveActiveStudentIdFromDb(candidateId);
      if (resolvedId) {
        return resolvedId;
      }
    }
  }

  return "";
}

export async function resolveCurrentConsultationActor(
  request: Request,
  mongooseConnection: mongoose.Mongoose | null,
  fallbackIds?: {
    lecturerId?: string;
    studentId?: string;
  }
) {
  const [lecturerId, studentId] = await Promise.all([
    resolveCurrentLecturerId(
      request,
      mongooseConnection,
      String(fallbackIds?.lecturerId ?? "").trim()
    ),
    resolveCurrentStudentId(
      request,
      mongooseConnection,
      String(fallbackIds?.studentId ?? "").trim()
    ),
  ]);

  if (lecturerId) {
    return { role: "LECTURER" as const, actorId: lecturerId };
  }

  if (studentId) {
    return { role: "STUDENT" as const, actorId: studentId };
  }

  return { role: "" as const, actorId: "" };
}

export function toApiBooking(
  row: ConsultationBookingPersistedRecord,
  slot: ConsultationAvailabilitySlotPersistedRecord | null,
  lecturer: LecturerMeta | null,
  student: StudentMeta | null
) {
  return {
    id: row.id,
    slotId: row.slotId,
    lecturerId: row.lecturerId,
    studentId: row.studentId,
    purpose: row.purpose,
    status: row.status,
    confirmedAt: row.confirmedAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    cancelledByRole: row.cancelledByRole,
    cancelledReason: row.cancelledReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    slot: slot
      ? {
          id: slot.id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          sessionType: slot.sessionType,
          mode: slot.mode,
          location: slot.location,
          meetingLink: slot.meetingLink,
          status: slot.status,
          bookingId: slot.bookingId,
        }
      : null,
    lecturer,
    student,
  };
}
