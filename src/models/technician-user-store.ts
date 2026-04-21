import {
  sanitizeAdminEmail,
  sanitizeAdminFullName,
  sanitizeAdminStatus,
  sanitizeAdminUsername,
} from "@/models/admin-user-store";

export type TechnicianUserStatus = "ACTIVE" | "INACTIVE";
export type TechnicianUserSort = "updated" | "created" | "az" | "za";

export interface TechnicianUserPersistedRecord {
  id: string;
  fullName: string;
  username: string;
  email: string;
  specialization: string;
  status: TechnicianUserStatus;
  mustChangePassword: boolean;
  updatedAt: string;
}

export function sanitizeTechnicianSpecialization(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeIsoDate(value: unknown) {
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

export function toTechnicianUserPersistedRecordFromUnknown(
  value: unknown
): TechnicianUserPersistedRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  const username = sanitizeAdminUsername(row.username);
  const email = sanitizeAdminEmail(row.email);
  const fullName =
    sanitizeAdminFullName(row.fullName) ||
    sanitizeAdminFullName(username) ||
    sanitizeAdminFullName(email);
  if (!id || !fullName || !username || !email) {
    return null;
  }

  const role = String(row.role ?? "").trim().toUpperCase();
  if (role !== "TECHNICIAN" && role !== "TECHNISIAN") {
    return null;
  }

  return {
    id,
    fullName,
    username,
    email,
    specialization: sanitizeTechnicianSpecialization(row.specialization),
    status: sanitizeAdminStatus(row.status),
    mustChangePassword: Boolean(row.mustChangePassword),
    updatedAt: normalizeIsoDate(row.updatedAt),
  };
}
