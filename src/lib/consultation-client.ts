import { authHeaders, isDemoModeEnabled, readStoredUser } from "@/lib/rbac";
import { getConsultationNotificationTypeLabel, type ConsultationNotificationType } from "@/models/consultation-notification";
import type { ConsultationSlotMode, ConsultationSlotStatus } from "@/models/consultation-availability";
import type { ConsultationBookingStatus } from "@/models/consultation-booking";

type LecturerMeta = {
  id: string;
  fullName: string;
  email: string;
};

type StudentMeta = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  status: string;
};

export interface ConsultationSlotApiRecord {
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
  lecturer: LecturerMeta | null;
}

export interface ConsultationBookingApiRecord {
  id: string;
  slotId: string;
  lecturerId: string;
  studentId: string;
  purpose: string;
  status: ConsultationBookingStatus;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledByRole: "STUDENT" | "LECTURER" | "SYSTEM" | null;
  cancelledReason: string;
  createdAt: string;
  updatedAt: string;
  slot: Omit<ConsultationSlotApiRecord, "createdAt" | "updatedAt" | "lecturer"> | null;
  lecturer: LecturerMeta | null;
  student: StudentMeta | null;
}

export interface ConsultationNotificationApiRecord {
  id: string;
  bookingId: string;
  recipientRole: "STUDENT" | "LECTURER";
  recipientId: string;
  type: ConsultationNotificationType;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  unread: boolean;
}

type CollectionResponse<T> = {
  items: T[];
  total: number;
};

function readMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  return String((payload as { message?: unknown }).message ?? "").trim();
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(readMessage(payload) || "Request failed");
  }

  return payload as T;
}

export function getCurrentConsultationActorIds() {
  const user = readStoredUser();
  const rawId = String(user?.id ?? "").trim();
  const rawStudentRef = String(user?.studentRef ?? "").trim();
  const demoMode = isDemoModeEnabled();

  return {
    lecturerId:
      user?.role === "LECTURER"
        ? rawId && rawId.startsWith("lec-")
          ? rawId
          : demoMode
            ? "lec-kperera"
            : ""
        : "",
    studentId:
      user?.role === "STUDENT"
        ? rawStudentRef ||
          (rawId && rawId.startsWith("stu-")
            ? rawId
            : demoMode
              ? "stu-demo-1"
              : "")
        : "",
  };
}

export function toConsultationModeLabel(mode: ConsultationSlotMode) {
  if (mode === "ONLINE") {
    return "Online";
  }
  if (mode === "HYBRID") {
    return "Hybrid";
  }
  return "In-Person";
}

export function toConsultationNotificationLabel(
  type: ConsultationNotificationType
) {
  return getConsultationNotificationTypeLabel(type);
}

function appendQueryParam(searchParams: URLSearchParams, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) {
    searchParams.set(key, trimmed);
  }
}

export async function listLecturerConsultationSlots() {
  const { lecturerId } = getCurrentConsultationActorIds();
  const searchParams = new URLSearchParams({ scope: "mine" });
  appendQueryParam(searchParams, "lecturerId", lecturerId);

  return requestJson<CollectionResponse<ConsultationSlotApiRecord>>(
    `/api/consultation-slots?${searchParams.toString()}`
  );
}

export async function createLecturerConsultationSlot(input: {
  date: string;
  startTime: string;
  endTime: string;
  sessionType: string;
  mode: ConsultationSlotMode;
  location?: string;
  meetingLink?: string;
}) {
  const { lecturerId } = getCurrentConsultationActorIds();

  return requestJson<ConsultationSlotApiRecord>("/api/consultation-slots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lecturerId,
      ...input,
    }),
  });
}

export async function deleteLecturerConsultationSlot(slotId: string) {
  const { lecturerId } = getCurrentConsultationActorIds();
  const searchParams = new URLSearchParams();
  appendQueryParam(searchParams, "lecturerId", lecturerId);

  const query = searchParams.toString();
  return requestJson<{ ok: true }>(
    `/api/consultation-slots/${slotId}${query ? `?${query}` : ""}`,
    {
      method: "DELETE",
    }
  );
}

export async function listAvailableConsultationSlots() {
  return requestJson<CollectionResponse<ConsultationSlotApiRecord>>(
    "/api/consultation-slots"
  );
}

export async function listStudentConsultationBookings() {
  const { studentId } = getCurrentConsultationActorIds();
  const searchParams = new URLSearchParams({ scope: "student" });
  appendQueryParam(searchParams, "studentId", studentId);

  return requestJson<CollectionResponse<ConsultationBookingApiRecord>>(
    `/api/consultation-bookings?${searchParams.toString()}`
  );
}

export async function listLecturerConsultationBookings() {
  const { lecturerId } = getCurrentConsultationActorIds();
  const searchParams = new URLSearchParams({ scope: "lecturer" });
  appendQueryParam(searchParams, "lecturerId", lecturerId);

  return requestJson<CollectionResponse<ConsultationBookingApiRecord>>(
    `/api/consultation-bookings?${searchParams.toString()}`
  );
}

export async function createConsultationBooking(input: {
  slotId: string;
  purpose: string;
}) {
  const { studentId } = getCurrentConsultationActorIds();

  return requestJson<ConsultationBookingApiRecord>("/api/consultation-bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId,
      ...input,
    }),
  });
}

export async function updateConsultationBooking(
  bookingId: string,
  input: {
    action: "cancel" | "confirm" | "complete";
    reason?: string;
  }
) {
  const { lecturerId, studentId } = getCurrentConsultationActorIds();
  const searchParams = new URLSearchParams();
  appendQueryParam(searchParams, "lecturerId", lecturerId);
  appendQueryParam(searchParams, "studentId", studentId);

  const query = searchParams.toString();

  return requestJson<ConsultationBookingApiRecord>(
    `/api/consultation-bookings/${bookingId}${query ? `?${query}` : ""}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
}

export async function listConsultationNotifications() {
  const { lecturerId, studentId } = getCurrentConsultationActorIds();
  const searchParams = new URLSearchParams();
  appendQueryParam(searchParams, "lecturerId", lecturerId);
  appendQueryParam(searchParams, "studentId", studentId);
  const query = searchParams.toString();

  return requestJson<CollectionResponse<ConsultationNotificationApiRecord>>(
    `/api/consultation-notifications${query ? `?${query}` : ""}`
  );
}

export async function markAllConsultationNotificationsRead() {
  const { lecturerId, studentId } = getCurrentConsultationActorIds();
  const searchParams = new URLSearchParams();
  appendQueryParam(searchParams, "lecturerId", lecturerId);
  appendQueryParam(searchParams, "studentId", studentId);
  const query = searchParams.toString();

  return requestJson<{ ok: true; changed: number }>(
    `/api/consultation-notifications${query ? `?${query}` : ""}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read" }),
    }
  );
}
