import mongoose from "mongoose";
import { toAppRoleFromUserRole } from "@/models/rbac";
import { UserModel } from "@/models/User";

export type AnnouncementAppRole =
  | "SUPER_ADMIN"
  | "LECTURER"
  | "LOST_ITEM_STAFF"
  | "STUDENT";

export interface AnnouncementActor {
  userId: string;
  role: AnnouncementAppRole;
  name: string;
  email: string;
}

export interface AnnouncementApiRecord {
  id: string;
  title: string;
  message: string;
  targetLabel: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt: string;
  author: {
    userId: string;
    role: string;
    name: string;
    email: string;
  };
  lastUpdatedBy: {
    userId: string;
    role: string;
    name: string;
    email: string;
  };
  deletedByInfo: {
    userId: string;
    role: string;
    name: string;
    email: string;
  };
  canEdit: boolean;
  canDelete: boolean;
}

export function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function parseLimit(value: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

export function parseBooleanQuery(value: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function toIsoDate(value: unknown) {
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

export function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export async function resolveAnnouncementActor(request: Request) {
  const headerUserId = collapseSpaces(request.headers.get("x-user-id"));
  if (!headerUserId || !mongoose.Types.ObjectId.isValid(headerUserId)) {
    return null;
  }

  const row = (await UserModel.findById(headerUserId)
    .select({ _id: 1, fullName: 1, username: 1, email: 1, role: 1, status: 1 })
    .lean()
    .exec()
    .catch(() => null)) as Record<string, unknown> | null;

  if (!row || String(row.status ?? "").trim().toUpperCase() !== "ACTIVE") {
    return null;
  }

  const role = toAppRoleFromUserRole(row.role);
  const userId = collapseSpaces(row._id);
  const name =
    collapseSpaces(row.fullName) ||
    collapseSpaces(row.username) ||
    collapseSpaces(row.email) ||
    "User";
  const email = collapseSpaces(row.email).toLowerCase();

  if (!userId || !role) {
    return null;
  }

  return {
    userId,
    role,
    name,
    email,
  } satisfies AnnouncementActor;
}

export function canManageAnnouncement(
  actor: AnnouncementActor | null,
  authorUserId: string
) {
  if (!actor) {
    return false;
  }
  if (actor.role === "SUPER_ADMIN") {
    return true;
  }
  return Boolean(authorUserId) && actor.userId === authorUserId;
}

export function toAnnouncementApiRecord(
  value: unknown,
  actor: AnnouncementActor | null
): AnnouncementApiRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = collapseSpaces(row._id ?? row.id);
  const title = collapseSpaces(row.title).slice(0, 180);
  const message = collapseSpaces(row.message).slice(0, 3000);
  const targetLabel =
    collapseSpaces(row.targetLabel || "All users").slice(0, 140) || "All users";
  const createdBy = collapseSpaces(row.createdBy || "User").slice(0, 120) || "User";
  const createdAt = toIsoDate(row.createdAt);
  const updatedAt = toIsoDate(row.updatedAt);
  const isDeleted = row.isDeleted === true;
  const deletedAt = toIsoDate(row.deletedAt);

  const authorUserId = collapseSpaces(row.authorUserId);
  const authorRole = collapseSpaces(row.authorRole);
  const authorEmail = collapseSpaces(row.authorEmail).toLowerCase();
  const updatedBy = collapseSpaces(row.updatedBy || createdBy);
  const updatedByUserId = collapseSpaces(row.updatedByUserId || authorUserId);
  const updatedByRole = collapseSpaces(row.updatedByRole || authorRole);
  const updatedByEmail = collapseSpaces(row.updatedByEmail || authorEmail).toLowerCase();
  const deletedBy = collapseSpaces(row.deletedBy);
  const deletedByUserId = collapseSpaces(row.deletedByUserId);
  const deletedByRole = collapseSpaces(row.deletedByRole);
  const deletedByEmail = collapseSpaces(row.deletedByEmail).toLowerCase();

  if (!id || !title || !message || !createdAt || !updatedAt) {
    return null;
  }

  const canManage = !isDeleted && canManageAnnouncement(actor, authorUserId);

  return {
    id,
    title,
    message,
    targetLabel,
    createdBy,
    createdAt,
    updatedAt,
    isDeleted,
    deletedAt,
    author: {
      userId: authorUserId,
      role: authorRole,
      name: createdBy,
      email: authorEmail,
    },
    lastUpdatedBy: {
      userId: updatedByUserId,
      role: updatedByRole,
      name: updatedBy,
      email: updatedByEmail,
    },
    deletedByInfo: {
      userId: deletedByUserId,
      role: deletedByRole,
      name: deletedBy,
      email: deletedByEmail,
    },
    canEdit: canManage,
    canDelete: canManage,
  };
}
