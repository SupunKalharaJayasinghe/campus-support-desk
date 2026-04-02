import {
  type ConsultationNotificationRecipientRole,
  type ConsultationNotificationType,
} from "@/models/consultation-notification";

export interface ConsultationNotificationPersistedRecord {
  id: string;
  notificationKey: string;
  recipientRole: ConsultationNotificationRecipientRole;
  recipientId: string;
  bookingId: string;
  type: ConsultationNotificationType;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationNotificationWriteInput {
  notificationKey: string;
  recipientRole: ConsultationNotificationRecipientRole;
  recipientId: string;
  bookingId: string;
  type: ConsultationNotificationType;
  title: string;
  message: string;
  readAt?: string | null;
}

const globalForConsultationNotificationStore = globalThis as typeof globalThis & {
  __consultationNotificationStore?: ConsultationNotificationPersistedRecord[];
};

function consultationNotificationStore() {
  if (!globalForConsultationNotificationStore.__consultationNotificationStore) {
    globalForConsultationNotificationStore.__consultationNotificationStore = [];
  }

  return globalForConsultationNotificationStore.__consultationNotificationStore;
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

export function sanitizeConsultationNotificationKey(value: unknown) {
  return collapseSpaces(value).slice(0, 180);
}

export function sanitizeConsultationNotificationRecipientRole(
  value: unknown
): ConsultationNotificationRecipientRole {
  return value === "LECTURER" ? "LECTURER" : "STUDENT";
}

export function sanitizeConsultationNotificationType(
  value: unknown
): ConsultationNotificationType {
  return value === "STARTING_SOON_REMINDER"
    ? "STARTING_SOON_REMINDER"
    : "DAY_BEFORE_REMINDER";
}

export function sanitizeConsultationNotificationTitle(value: unknown) {
  return collapseSpaces(value).slice(0, 160);
}

export function sanitizeConsultationNotificationMessage(value: unknown) {
  return collapseSpaces(value).slice(0, 300);
}

export function listConsultationNotificationsInMemory(options?: {
  recipientRole?: "" | ConsultationNotificationRecipientRole;
  recipientId?: string;
  unreadOnly?: boolean;
}) {
  const recipientRole = options?.recipientRole ?? "";
  const recipientId = String(options?.recipientId ?? "").trim();
  const unreadOnly = options?.unreadOnly === true;

  return consultationNotificationStore()
    .filter((row) => (recipientRole ? row.recipientRole === recipientRole : true))
    .filter((row) => (recipientId ? row.recipientId === recipientId : true))
    .filter((row) => (unreadOnly ? !row.readAt : true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((row) => ({ ...row }));
}

export function findConsultationNotificationInMemoryById(id: string) {
  const targetId = String(id ?? "").trim();
  if (!targetId) {
    return null;
  }

  const row = consultationNotificationStore().find((item) => item.id === targetId);
  return row ? { ...row } : null;
}

export function findConsultationNotificationInMemoryByKey(notificationKey: string) {
  const targetKey = sanitizeConsultationNotificationKey(notificationKey);
  if (!targetKey) {
    return null;
  }

  const row = consultationNotificationStore().find(
    (item) => item.notificationKey === targetKey
  );
  return row ? { ...row } : null;
}

export function ensureConsultationNotificationInMemory(
  input: ConsultationNotificationWriteInput
) {
  const existing = findConsultationNotificationInMemoryByKey(input.notificationKey);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const record: ConsultationNotificationPersistedRecord = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notificationKey: sanitizeConsultationNotificationKey(input.notificationKey),
    recipientRole: sanitizeConsultationNotificationRecipientRole(
      input.recipientRole
    ),
    recipientId: String(input.recipientId ?? "").trim(),
    bookingId: String(input.bookingId ?? "").trim(),
    type: sanitizeConsultationNotificationType(input.type),
    title: sanitizeConsultationNotificationTitle(input.title),
    message: sanitizeConsultationNotificationMessage(input.message),
    readAt: toIsoTimestamp(input.readAt) || null,
    createdAt: now,
    updatedAt: now,
  };

  consultationNotificationStore().unshift(record);
  return { ...record };
}

export function markConsultationNotificationInMemoryAsRead(id: string) {
  const targetId = String(id ?? "").trim();
  const store = consultationNotificationStore();
  const index = store.findIndex((row) => row.id === targetId);
  if (index < 0) {
    return null;
  }

  store[index] = {
    ...store[index],
    readAt: store[index].readAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { ...store[index] };
}

export function markAllConsultationNotificationsInMemoryAsRead(options: {
  recipientRole: ConsultationNotificationRecipientRole;
  recipientId: string;
}) {
  const store = consultationNotificationStore();
  const now = new Date().toISOString();
  let changed = 0;

  for (let index = 0; index < store.length; index += 1) {
    if (
      store[index].recipientRole === options.recipientRole &&
      store[index].recipientId === options.recipientId &&
      !store[index].readAt
    ) {
      store[index] = {
        ...store[index],
        readAt: now,
        updatedAt: now,
      };
      changed += 1;
    }
  }

  return changed;
}

export function toConsultationNotificationPersistedRecordFromUnknown(
  value: unknown
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = readId(row._id ?? row.id);
  const notificationKey = sanitizeConsultationNotificationKey(row.notificationKey);
  const recipientId = readId(row.recipientId);
  const bookingId = readId(row.bookingId);
  const title = sanitizeConsultationNotificationTitle(row.title);
  const message = sanitizeConsultationNotificationMessage(row.message);

  if (!id || !notificationKey || !recipientId || !bookingId || !title || !message) {
    return null;
  }

  return {
    id,
    notificationKey,
    recipientRole: sanitizeConsultationNotificationRecipientRole(
      row.recipientRole
    ),
    recipientId,
    bookingId,
    type: sanitizeConsultationNotificationType(row.type),
    title,
    message,
    readAt: toIsoTimestamp(row.readAt) || null,
    createdAt: toIsoTimestamp(row.createdAt),
    updatedAt: toIsoTimestamp(row.updatedAt),
  } satisfies ConsultationNotificationPersistedRecord;
}
