import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

type StaffRole = "LECTURER" | "LAB_ASSISTANT";

function randomPassword(role: StaffRole) {
  return `${role.toLowerCase()}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function resolveDefaultStaffPassword(input: {
  role: StaffRole;
  nicStaffId: string | null;
}) {
  const mode = String(process.env.STAFF_DEFAULT_PASSWORD_MODE ?? "NIC_STAFF_ID")
    .trim()
    .toUpperCase();
  const nicStaffId = String(input.nicStaffId ?? "").trim();

  if (mode === "RANDOM") {
    return randomPassword(input.role);
  }

  if (nicStaffId) {
    return nicStaffId;
  }

  const fallback = String(process.env.STAFF_DEFAULT_PASSWORD_FALLBACK ?? "")
    .trim();
  if (fallback) {
    return fallback;
  }

  return randomPassword(input.role);
}

export async function hashStaffPassword(rawPassword: string) {
  return bcrypt.hash(rawPassword, 10);
}
