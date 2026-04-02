export type AdminUserRole = "ADMIN" | "LOST_ITEM_ADMIN";
export type AdminUserStatus = "ACTIVE" | "INACTIVE";
export type AdminUserSort = "updated" | "created" | "az" | "za";

export interface AdminUserPersistedRecord {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminUserMemoryRecord extends AdminUserPersistedRecord {
  passwordHash: string;
}

interface CreateAdminUserInMemoryInput {
  fullName: string;
  username: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  passwordHash: string;
  mustChangePassword: boolean;
}

interface UpdateAdminUserInMemoryInput
  extends Partial<CreateAdminUserInMemoryInput> {
  id: string;
}

const INITIAL_ADMIN_USERS: AdminUserMemoryRecord[] = [
  {
    id: "adm-super-001",
    fullName: "System Admin",
    username: "admin",
    email: "admin@campus.local",
    role: "ADMIN",
    status: "ACTIVE",
    mustChangePassword: false,
    passwordHash: "",
    createdAt: "2026-01-04T08:00:00.000Z",
    updatedAt: "2026-01-04T08:00:00.000Z",
  },
  {
    id: "adm-lost-001",
    fullName: "Lost Item Desk",
    username: "lost.item",
    email: "lost.item@campus.local",
    role: "LOST_ITEM_ADMIN",
    status: "ACTIVE",
    mustChangePassword: false,
    passwordHash: "",
    createdAt: "2026-01-06T09:30:00.000Z",
    updatedAt: "2026-01-06T09:30:00.000Z",
  },
];

const globalForAdminUserStore = globalThis as typeof globalThis & {
  __adminUserStore?: AdminUserMemoryRecord[];
};

function adminUserStore() {
  if (!globalForAdminUserStore.__adminUserStore) {
    globalForAdminUserStore.__adminUserStore = INITIAL_ADMIN_USERS.map((row) => ({
      ...row,
    }));
  }

  return globalForAdminUserStore.__adminUserStore;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

export function sanitizeAdminFullName(value: unknown) {
  return collapseSpaces(value).slice(0, 160);
}

export function sanitizeAdminEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .slice(0, 254);
}

export function sanitizeAdminUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .slice(0, 64);
}

export function sanitizeAdminRole(value: unknown): AdminUserRole {
  return String(value ?? "").trim().toUpperCase() === "LOST_ITEM_ADMIN"
    ? "LOST_ITEM_ADMIN"
    : "ADMIN";
}

export function sanitizeAdminStatus(value: unknown): AdminUserStatus {
  return String(value ?? "").trim().toUpperCase() === "INACTIVE"
    ? "INACTIVE"
    : "ACTIVE";
}

export function sanitizeAdminPassword(value: unknown) {
  return String(value ?? "").trim();
}

function toApiRecord(value: AdminUserMemoryRecord): AdminUserPersistedRecord {
  return {
    id: value.id,
    fullName: value.fullName,
    username: value.username,
    email: value.email,
    role: value.role,
    status: value.status,
    mustChangePassword: Boolean(value.mustChangePassword),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function listAdminUsersInMemory(options?: {
  search?: string;
  role?: "" | AdminUserRole;
  status?: "" | AdminUserStatus;
  sort?: AdminUserSort;
}) {
  const search = collapseSpaces(options?.search ?? "").toLowerCase();
  const role = options?.role ?? "";
  const status = options?.status ?? "";
  const sort = options?.sort ?? "updated";

  const rows = adminUserStore().filter((item) => {
    if (role && item.role !== role) {
      return false;
    }
    if (status && item.status !== status) {
      return false;
    }
    if (!search) {
      return true;
    }
    return [item.fullName, item.username, item.email]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  rows.sort((left, right) => {
    if (sort === "az") {
      return left.fullName.localeCompare(right.fullName);
    }
    if (sort === "za") {
      return right.fullName.localeCompare(left.fullName);
    }
    if (sort === "created") {
      return right.createdAt.localeCompare(left.createdAt);
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });

  return rows.map((item) => toApiRecord(item));
}

export function findAdminUserInMemoryById(id: string) {
  const targetId = String(id ?? "").trim();
  if (!targetId) {
    return null;
  }

  const row = adminUserStore().find((item) => item.id === targetId);
  return row ? toApiRecord(row) : null;
}

export function createAdminUserInMemory(input: CreateAdminUserInMemoryInput) {
  const username = sanitizeAdminUsername(input.username);
  const email = sanitizeAdminEmail(input.email);

  const duplicate = adminUserStore().find(
    (item) => item.username === username || item.email === email
  );
  if (duplicate) {
    if (duplicate.email === email) {
      throw new Error("Email already exists");
    }
    throw new Error("Username already exists");
  }

  const now = new Date().toISOString();
  const row: AdminUserMemoryRecord = {
    id: `adm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName: sanitizeAdminFullName(input.fullName),
    username,
    email,
    role: sanitizeAdminRole(input.role),
    status: sanitizeAdminStatus(input.status),
    mustChangePassword: Boolean(input.mustChangePassword),
    passwordHash: String(input.passwordHash ?? ""),
    createdAt: now,
    updatedAt: now,
  };

  adminUserStore().unshift(row);
  return toApiRecord(row);
}

export function updateAdminUserInMemory(input: UpdateAdminUserInMemoryInput) {
  const targetId = String(input.id ?? "").trim();
  const rows = adminUserStore();
  const index = rows.findIndex((item) => item.id === targetId);
  if (index < 0) {
    return null;
  }

  const current = rows[index];
  const username = sanitizeAdminUsername(input.username ?? current.username);
  const email = sanitizeAdminEmail(input.email ?? current.email);

  const duplicate = rows.find(
    (item) =>
      item.id !== current.id &&
      (item.username === username || item.email === email)
  );
  if (duplicate) {
    if (duplicate.email === email) {
      throw new Error("Email already exists");
    }
    throw new Error("Username already exists");
  }

  const next: AdminUserMemoryRecord = {
    ...current,
    fullName: sanitizeAdminFullName(input.fullName ?? current.fullName),
    username,
    email,
    role: sanitizeAdminRole(input.role ?? current.role),
    status: sanitizeAdminStatus(input.status ?? current.status),
    mustChangePassword:
      input.mustChangePassword === undefined
        ? current.mustChangePassword
        : Boolean(input.mustChangePassword),
    passwordHash:
      typeof input.passwordHash === "string" && input.passwordHash
        ? input.passwordHash
        : current.passwordHash,
    updatedAt: new Date().toISOString(),
  };

  rows[index] = next;
  return toApiRecord(next);
}

export function deleteAdminUserInMemory(id: string) {
  const targetId = String(id ?? "").trim();
  const rows = adminUserStore();
  const index = rows.findIndex((item) => item.id === targetId);
  if (index < 0) {
    return false;
  }

  rows.splice(index, 1);
  return true;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function toAdminUserPersistedRecordFromUnknown(
  value: unknown
): AdminUserPersistedRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  const username = sanitizeAdminUsername(row.username);
  const email = sanitizeAdminEmail(row.email);
  const fullName =
    sanitizeAdminFullName(row.fullName) ||
    sanitizeAdminFullName(row.name) ||
    sanitizeAdminFullName(username) ||
    sanitizeAdminFullName(email);
  if (!id || !fullName || !username || !email) {
    return null;
  }

  return {
    id,
    fullName,
    username,
    email,
    role: sanitizeAdminRole(row.role),
    status: sanitizeAdminStatus(row.status),
    mustChangePassword: Boolean(row.mustChangePassword),
    createdAt: normalizeIsoDate(row.createdAt),
    updatedAt: normalizeIsoDate(row.updatedAt),
  };
}
