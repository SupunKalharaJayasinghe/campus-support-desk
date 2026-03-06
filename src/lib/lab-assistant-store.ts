import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import { findModuleByCode, findModuleById } from "@/lib/module-store";

export type LabAssistantStatus = "ACTIVE" | "INACTIVE";

export interface LabAssistantPersistedRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  nicStaffId: string | null;
  status: LabAssistantStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
  createdAt: string;
  updatedAt: string;
}

const INITIAL_LAB_ASSISTANTS: LabAssistantPersistedRecord[] = [
  {
    id: "lab-nperera",
    fullName: "Nuwan Perera",
    email: "nuwan.perera@sllit.lk",
    phone: "0778899001",
    nicStaffId: "LA1001",
    status: "ACTIVE",
    facultyIds: ["FOC"],
    degreeProgramIds: ["SE", "CS"],
    moduleIds: ["mod-se101"],
    createdAt: "2025-12-12T09:00:00.000Z",
    updatedAt: "2026-02-18T09:00:00.000Z",
  },
  {
    id: "lab-spinto",
    fullName: "Sachi Pinto",
    email: "sachi.pinto@sllit.lk",
    phone: "0765522003",
    nicStaffId: "LA1002",
    status: "ACTIVE",
    facultyIds: ["FOC", "FOE"],
    degreeProgramIds: ["IT", "EE"],
    moduleIds: ["mod-cs105", "mod-se201"],
    createdAt: "2025-12-18T09:00:00.000Z",
    updatedAt: "2026-02-22T09:00:00.000Z",
  },
  {
    id: "lab-tdias",
    fullName: "Thilini Dias",
    email: "thilini.dias@sllit.lk",
    phone: "0715588990",
    nicStaffId: "LA1003",
    status: "INACTIVE",
    facultyIds: ["FOC"],
    degreeProgramIds: ["CS"],
    moduleIds: [],
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

  return {
    facultyIds,
    degreeProgramIds,
    moduleIds,
  };
}

export function listLabAssistantsInMemory(options?: {
  status?: "" | LabAssistantStatus;
}) {
  const status = options?.status ?? "";

  return labAssistantStore()
    .filter((row) => (status ? row.status === status : true))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function toLabAssistantPersistedRecordFromUnknown(
  value: unknown
): LabAssistantPersistedRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  const fullName = collapseSpaces(row.fullName);
  const email = String(row.email ?? "").trim().toLowerCase();
  if (!id || !fullName || !email) {
    return null;
  }

  return {
    id,
    fullName,
    email,
    phone: collapseSpaces(row.phone),
    nicStaffId: collapseSpaces(row.nicStaffId) || null,
    status: sanitizeLabAssistantStatus(row.status),
    facultyIds: sanitizeAcademicCodeList(row.facultyIds),
    degreeProgramIds: sanitizeAcademicCodeList(row.degreeProgramIds),
    moduleIds: sanitizeModuleIdList(row.moduleIds),
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}
