import { findDegreeProgram } from "@/models/degree-program-store";
import { findFaculty } from "@/models/faculty-store";
import { findModuleByCode, findModuleById } from "@/models/module-store";

export type LabAssistantStatus = "ACTIVE" | "INACTIVE";
export type LabAssistantSort = "updated" | "created" | "az" | "za";

export interface LabAssistantPersistedRecord {
  id: string;
  fullName: string;
  email: string;
  optionalEmail: string;
  phone: string;
  nicStaffId: string | null;
  status: LabAssistantStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
  assignedOfferingIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface LabAssistantCreateInput {
  fullName: string;
  optionalEmail: string;
  phone: string;
  nicStaffId: string | null;
  status: LabAssistantStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
}

interface LabAssistantUpdateInput extends LabAssistantCreateInput {
  id: string;
}

const INITIAL_LAB_ASSISTANTS: LabAssistantPersistedRecord[] = [
  {
    id: "lab-nperera",
    fullName: "Nuwan Perera",
    email: "nuwan.perera@sllit.lk",
    optionalEmail: "",
    phone: "0778899001",
    nicStaffId: "LA1001",
    status: "ACTIVE",
    facultyIds: ["FOC"],
    degreeProgramIds: ["SE", "CS"],
    moduleIds: ["mod-se101"],
    assignedOfferingIds: [],
    createdAt: "2025-12-12T09:00:00.000Z",
    updatedAt: "2026-02-18T09:00:00.000Z",
  },
  {
    id: "lab-spinto",
    fullName: "Sachi Pinto",
    email: "sachi.pinto@sllit.lk",
    optionalEmail: "",
    phone: "0765522003",
    nicStaffId: "LA1002",
    status: "ACTIVE",
    facultyIds: ["FOC", "FOE"],
    degreeProgramIds: ["IT", "EE"],
    moduleIds: ["mod-cs105", "mod-se201"],
    assignedOfferingIds: [],
    createdAt: "2025-12-18T09:00:00.000Z",
    updatedAt: "2026-02-22T09:00:00.000Z",
  },
  {
    id: "lab-tdias",
    fullName: "Thilini Dias",
    email: "thilini.dias@sllit.lk",
    optionalEmail: "",
    phone: "0715588990",
    nicStaffId: "LA1003",
    status: "INACTIVE",
    facultyIds: ["FOC"],
    degreeProgramIds: ["CS"],
    moduleIds: [],
    assignedOfferingIds: [],
    createdAt: "2025-11-28T09:00:00.000Z",
    updatedAt: "2026-01-28T09:00:00.000Z",
  },
];

const globalForLabAssistantStore = globalThis as typeof globalThis & {
  __labAssistantStore?: LabAssistantPersistedRecord[];
};

function labAssistantStore() {
  if (!globalForLabAssistantStore.__labAssistantStore) {
    globalForLabAssistantStore.__labAssistantStore = INITIAL_LAB_ASSISTANTS.map((item) => ({
      ...item,
      facultyIds: [...item.facultyIds],
      degreeProgramIds: [...item.degreeProgramIds],
      moduleIds: [...item.moduleIds],
      assignedOfferingIds: [...item.assignedOfferingIds],
    }));
  }

  return globalForLabAssistantStore.__labAssistantStore;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
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

export function sanitizeLabAssistantName(value: unknown) {
  return collapseSpaces(value).slice(0, 120);
}

export function sanitizeLabAssistantPhone(value: unknown) {
  return collapseSpaces(value).slice(0, 32);
}

export function sanitizeLabAssistantOptionalEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .slice(0, 254);
}

export function sanitizeLabAssistantNicStaffId(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 32);

  return normalized || null;
}

export function sanitizeLabAssistantStatus(value: unknown): LabAssistantStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

export function sanitizeAcademicCodeList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((item) => normalizeAcademicCode(item)).filter(Boolean)));
}

export function sanitizeModuleIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
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

export function getLabAssistantEmailDomain() {
  const domain = String(process.env.LAB_ASSISTANT_EMAIL_DOMAIN ?? "sllit.lk")
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

  return normalized || "lab.assistant";
}

export function buildLabAssistantEmailLocalPart(fullName: string) {
  const normalized = normalizeEmailLocalPart(fullName);
  return normalized.slice(0, 50) || "lab.assistant";
}

export function buildLabAssistantEmail(fullName: string, suffix?: number) {
  const local = buildLabAssistantEmailLocalPart(fullName);
  const numberedLocal = suffix && suffix > 1 ? `${local}${suffix}` : local;
  return `${numberedLocal}@${getLabAssistantEmailDomain()}`;
}

export function validateLabAssistantEligibility(input: {
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

export function listLabAssistantsInMemory(options?: {
  search?: string;
  status?: "" | LabAssistantStatus;
  sort?: LabAssistantSort;
}) {
  const search = collapseSpaces(options?.search ?? "").toLowerCase();
  const status = options?.status ?? "";
  const sort = options?.sort ?? "updated";

  const filtered = labAssistantStore().filter((item) => {
    if (status && item.status !== status) {
      return false;
    }

    if (!search) {
      return true;
    }

    return [
      item.fullName,
      item.email,
      item.optionalEmail,
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

export function findLabAssistantInMemoryById(id: string) {
  const targetId = String(id ?? "").trim();
  if (!targetId) {
    return null;
  }

  return labAssistantStore().find((item) => item.id === targetId) ?? null;
}

function reserveUniqueLabAssistantEmailInMemory(
  fullName: string,
  excludeId?: string | null
) {
  const normalizedExcludeId = String(excludeId ?? "").trim();
  const store = labAssistantStore();
  for (let index = 1; index <= 999; index += 1) {
    const candidate = buildLabAssistantEmail(fullName, index);
    const exists = store.some(
      (item) =>
        item.email === candidate &&
        (!normalizedExcludeId || item.id !== normalizedExcludeId)
    );
    if (!exists) {
      return candidate;
    }
  }

  throw new Error("Failed to allocate lab assistant email");
}

function toPersistedRecord(input: LabAssistantCreateInput): LabAssistantPersistedRecord {
  const now = new Date().toISOString();
  return {
    id: `lab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName: input.fullName,
    email: reserveUniqueLabAssistantEmailInMemory(input.fullName),
    optionalEmail: sanitizeLabAssistantOptionalEmail(input.optionalEmail),
    phone: input.phone,
    nicStaffId: input.nicStaffId,
    status: input.status,
    facultyIds: [...input.facultyIds],
    degreeProgramIds: [...input.degreeProgramIds],
    moduleIds: [...input.moduleIds],
    assignedOfferingIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createLabAssistantInMemory(input: LabAssistantCreateInput) {
  const store = labAssistantStore();

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

export function updateLabAssistantInMemory(input: LabAssistantUpdateInput) {
  const store = labAssistantStore();
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
  const updated: LabAssistantPersistedRecord = {
    ...current,
    fullName: input.fullName,
    optionalEmail: sanitizeLabAssistantOptionalEmail(input.optionalEmail),
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

export function deleteLabAssistantInMemory(id: string) {
  const store = labAssistantStore();
  const targetId = String(id ?? "").trim();
  const index = store.findIndex((item) => item.id === targetId);
  if (index < 0) {
    return false;
  }

  store.splice(index, 1);
  return true;
}

export function toLabAssistantPersistedRecordFromUnknown(
  value: unknown
): LabAssistantPersistedRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  const fullName = sanitizeLabAssistantName(row.fullName);
  const email = String(row.email ?? "").trim().toLowerCase();
  if (!id || !fullName || !email) {
    return null;
  }

  return {
    id,
    fullName,
    email,
    optionalEmail: sanitizeLabAssistantOptionalEmail(row.optionalEmail),
    phone: sanitizeLabAssistantPhone(row.phone),
    nicStaffId: sanitizeLabAssistantNicStaffId(row.nicStaffId),
    status: sanitizeLabAssistantStatus(row.status),
    facultyIds: sanitizeAcademicCodeList(row.facultyIds),
    degreeProgramIds: sanitizeAcademicCodeList(row.degreeProgramIds),
    moduleIds: sanitizeModuleIdList(row.moduleIds),
    assignedOfferingIds: sanitizeModuleIdList(row.assignedOfferingIds),
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

