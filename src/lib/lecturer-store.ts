import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import { findModuleByCode, findModuleById } from "@/lib/module-store";

export type LecturerStatus = "ACTIVE" | "INACTIVE";
export type LecturerSort = "updated" | "created" | "az" | "za";

export interface LecturerPersistedRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  nicStaffId: string | null;
  status: LecturerStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface LecturerCreateInput {
  fullName: string;
  phone: string;
  nicStaffId: string | null;
  status: LecturerStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
}

interface LecturerUpdateInput extends LecturerCreateInput {
  id: string;
}

const INITIAL_LECTURERS: LecturerPersistedRecord[] = [
  {
    id: "lec-kperera",
    fullName: "Kavindu Perera",
    email: "kavindu.perera@sllit.lk",
    phone: "0771234567",
    nicStaffId: "LP1001",
    status: "ACTIVE",
    facultyIds: ["FOC"],
    degreeProgramIds: ["SE", "CS"],
    moduleIds: ["mod-se101", "mod-se201"],
    createdAt: "2025-12-10T09:00:00.000Z",
    updatedAt: "2026-02-28T09:00:00.000Z",
  },
  {
    id: "lec-rsilva",
    fullName: "Ruvini Silva",
    email: "ruvini.silva@sllit.lk",
    phone: "0712223344",
    nicStaffId: "LP1002",
    status: "ACTIVE",
    facultyIds: ["FOC", "FOE"],
    degreeProgramIds: ["IT", "EE"],
    moduleIds: ["mod-cs105"],
    createdAt: "2025-12-18T09:00:00.000Z",
    updatedAt: "2026-02-20T09:00:00.000Z",
  },
];

const globalForLecturerStore = globalThis as typeof globalThis & {
  __lecturerStore?: LecturerPersistedRecord[];
};

function lecturerStore() {
  if (!globalForLecturerStore.__lecturerStore) {
    globalForLecturerStore.__lecturerStore = INITIAL_LECTURERS.map((item) => ({
      ...item,
      facultyIds: [...item.facultyIds],
      degreeProgramIds: [...item.degreeProgramIds],
      moduleIds: [...item.moduleIds],
    }));
  }

  return globalForLecturerStore.__lecturerStore;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

export function sanitizeLecturerName(value: unknown) {
  return collapseSpaces(value).slice(0, 120);
}

export function sanitizeLecturerPhone(value: unknown) {
  return collapseSpaces(value).slice(0, 32);
}

export function sanitizeLecturerNicStaffId(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 32);

  return normalized || null;
}

export function sanitizeLecturerStatus(value: unknown): LecturerStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

export function sanitizeAcademicCodeList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.map((item) => normalizeAcademicCode(item)).filter(Boolean))
  );
}

export function sanitizeModuleIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter((item) => Boolean(item))
    )
  );
}

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

export function getLecturerEmailDomain() {
  const domain = String(process.env.LECTURER_EMAIL_DOMAIN ?? "sllit.lk")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

  return domain || "sllit.lk";
}

function normalizeEmailLocalPart(value: string) {
  const normalized = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");

  return normalized || "lecturer";
}

export function buildLecturerEmailLocalPart(fullName: string) {
  const normalized = normalizeEmailLocalPart(fullName);
  return normalized.slice(0, 50) || "lecturer";
}

export function buildLecturerEmail(fullName: string, suffix?: number) {
  const local = buildLecturerEmailLocalPart(fullName);
  const numberedLocal = suffix && suffix > 1 ? `${local}${suffix}` : local;
  return `${numberedLocal}@${getLecturerEmailDomain()}`;
}

export function validateLecturerEligibility(input: {
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
}) {
  const facultyIds = sanitizeAcademicCodeList(input.facultyIds);
  const degreeProgramIds = sanitizeAcademicCodeList(input.degreeProgramIds);
  const moduleIds = sanitizeModuleIdList(input.moduleIds);

  const invalidFacultyCode = facultyIds.find((facultyId) => !findFaculty(facultyId));
  if (invalidFacultyCode) {
    throw new Error(`Invalid faculty selected: ${invalidFacultyCode}`);
  }

  const degreeRows = degreeProgramIds.map((degreeProgramId) => ({
    degreeProgramId,
    record: findDegreeProgram(degreeProgramId),
  }));
  const invalidDegreeCode = degreeRows.find((row) => !row.record)?.degreeProgramId;
  if (invalidDegreeCode) {
    throw new Error(`Invalid degree selected: ${invalidDegreeCode}`);
  }

  const invalidDegreeFaculty = degreeRows.find((row) => {
    if (!row.record || facultyIds.length === 0) {
      return false;
    }

    return !facultyIds.includes(row.record.facultyCode);
  });
  if (invalidDegreeFaculty) {
    throw new Error(
      `Degree ${invalidDegreeFaculty.degreeProgramId} does not belong to selected faculties`
    );
  }

  const moduleRows = moduleIds.map((moduleId) => ({
    moduleId,
    record: findModuleById(moduleId) ?? findModuleByCode(moduleId),
  }));
  const invalidModuleId = moduleRows.find((row) => !row.record)?.moduleId;
  if (invalidModuleId) {
    throw new Error(`Invalid module selected: ${invalidModuleId}`);
  }

  const invalidModuleFaculty = moduleRows.find((row) => {
    if (!row.record || facultyIds.length === 0) {
      return false;
    }

    return !facultyIds.includes(normalizeAcademicCode(row.record.facultyCode));
  });
  if (invalidModuleFaculty) {
    throw new Error(
      `Module ${invalidModuleFaculty.moduleId} does not belong to selected faculties`
    );
  }

  const invalidModuleDegree = moduleRows.find((row) => {
    if (!row.record || degreeProgramIds.length === 0) {
      return false;
    }

    const applicableDegreeIds = Array.from(
      new Set(
        (row.record.applicableDegrees ?? [])
          .map((item) => normalizeAcademicCode(item))
          .filter(Boolean)
      )
    );

    return !degreeProgramIds.some((degreeId) => applicableDegreeIds.includes(degreeId));
  });
  if (invalidModuleDegree) {
    throw new Error(
      `Module ${invalidModuleDegree.moduleId} does not match selected degrees`
    );
  }

  return {
    facultyIds,
    degreeProgramIds,
    moduleIds,
  };
}

export function listLecturersInMemory(options?: {
  search?: string;
  status?: "" | LecturerStatus;
  sort?: LecturerSort;
}) {
  const search = collapseSpaces(options?.search ?? "").toLowerCase();
  const status = options?.status ?? "";
  const sort = options?.sort ?? "updated";

  const filtered = lecturerStore().filter((item) => {
    if (status && item.status !== status) {
      return false;
    }

    if (!search) {
      return true;
    }

    return [
      item.fullName,
      item.email,
      item.phone,
      item.nicStaffId ?? "",
      item.facultyIds.join(" "),
      item.degreeProgramIds.join(" "),
      item.moduleIds.join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  return filtered.sort((left, right) => {
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
}

export function findLecturerInMemoryById(id: string) {
  const targetId = String(id ?? "").trim();
  if (!targetId) {
    return null;
  }

  return lecturerStore().find((item) => item.id === targetId) ?? null;
}

function reserveUniqueLecturerEmailInMemory(
  fullName: string,
  excludeId?: string | null
) {
  const normalizedExcludeId = String(excludeId ?? "").trim();
  const store = lecturerStore();
  for (let index = 1; index <= 999; index += 1) {
    const candidate = buildLecturerEmail(fullName, index);
    const exists = store.some(
      (item) =>
        item.email === candidate &&
        (!normalizedExcludeId || item.id !== normalizedExcludeId)
    );
    if (!exists) {
      return candidate;
    }
  }

  throw new Error("Failed to allocate lecturer email");
}

function toPersistedRecord(input: LecturerCreateInput): LecturerPersistedRecord {
  const now = new Date().toISOString();
  return {
    id: `lec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName: input.fullName,
    email: reserveUniqueLecturerEmailInMemory(input.fullName),
    phone: input.phone,
    nicStaffId: input.nicStaffId,
    status: input.status,
    facultyIds: [...input.facultyIds],
    degreeProgramIds: [...input.degreeProgramIds],
    moduleIds: [...input.moduleIds],
    createdAt: now,
    updatedAt: now,
  };
}

export function createLecturerInMemory(input: LecturerCreateInput) {
  const store = lecturerStore();

  if (
    input.nicStaffId &&
    store.some((item) => item.nicStaffId && item.nicStaffId === input.nicStaffId)
  ) {
    throw new Error("NIC/Staff ID already exists");
  }

  const next = toPersistedRecord(input);
  store.unshift(next);
  return next;
}

export function updateLecturerInMemory(input: LecturerUpdateInput) {
  const store = lecturerStore();
  const targetId = String(input.id ?? "").trim();
  const index = store.findIndex((item) => item.id === targetId);
  if (index < 0) {
    return null;
  }

  if (
    input.nicStaffId &&
    store.some(
      (item) =>
        item.id !== targetId &&
        item.nicStaffId &&
        item.nicStaffId === input.nicStaffId
    )
  ) {
    throw new Error("NIC/Staff ID already exists");
  }

  const current = store[index];
  const updated: LecturerPersistedRecord = {
    ...current,
    fullName: input.fullName,
    phone: input.phone,
    nicStaffId: input.nicStaffId,
    status: input.status,
    facultyIds: [...input.facultyIds],
    degreeProgramIds: [...input.degreeProgramIds],
    moduleIds: [...input.moduleIds],
    updatedAt: new Date().toISOString(),
  };
  store[index] = updated;

  return updated;
}

export function deleteLecturerInMemory(id: string) {
  const store = lecturerStore();
  const targetId = String(id ?? "").trim();
  const index = store.findIndex((item) => item.id === targetId);
  if (index < 0) {
    return false;
  }

  store.splice(index, 1);
  return true;
}

export function toLecturerPersistedRecordFromUnknown(
  value: unknown
): LecturerPersistedRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = String(row._id ?? row.id ?? "").trim();
  const fullName = sanitizeLecturerName(row.fullName);
  const email = String(row.email ?? "").trim().toLowerCase();

  if (!id || !fullName || !email) {
    return null;
  }

  return {
    id,
    fullName,
    email,
    phone: sanitizeLecturerPhone(row.phone),
    nicStaffId: sanitizeLecturerNicStaffId(row.nicStaffId),
    status: sanitizeLecturerStatus(row.status),
    facultyIds: sanitizeAcademicCodeList(row.facultyIds),
    degreeProgramIds: sanitizeAcademicCodeList(row.degreeProgramIds),
    moduleIds: sanitizeModuleIdList(row.moduleIds),
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}
