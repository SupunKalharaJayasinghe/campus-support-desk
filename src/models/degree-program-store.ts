import { findFaculty } from "@/models/faculty-store";

export type DegreeProgramStatus = "ACTIVE" | "INACTIVE" | "DRAFT";
export type DegreeProgramSort = "updated" | "created" | "az" | "za";

export interface DegreeProgramRecord {
  code: string;
  name: string;
  facultyCode: string;
  award: string;
  credits: number;
  durationYears: number;
  status: DegreeProgramStatus;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

const INITIAL_DEGREE_PROGRAMS: DegreeProgramRecord[] = [
  {
    code: "SE",
    name: "BSc Software Engineering",
    facultyCode: "FOC",
    award: "BSc (Hons)",
    credits: 120,
    durationYears: 4,
    status: "ACTIVE",
    createdAt: "2025-01-12T09:00:00.000Z",
    updatedAt: "2026-02-19T09:00:00.000Z",
    isDeleted: false,
  },
  {
    code: "CS",
    name: "BSc Computer Science",
    facultyCode: "FOC",
    award: "BSc (Hons)",
    credits: 120,
    durationYears: 4,
    status: "ACTIVE",
    createdAt: "2025-01-08T09:00:00.000Z",
    updatedAt: "2026-02-03T09:00:00.000Z",
    isDeleted: false,
  },
  {
    code: "IT",
    name: "BSc Information Technology",
    facultyCode: "FOC",
    award: "BSc",
    credits: 120,
    durationYears: 4,
    status: "DRAFT",
    createdAt: "2025-02-02T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
    isDeleted: false,
  },
  {
    code: "CE",
    name: "BEng Civil Engineering",
    facultyCode: "FOE",
    award: "BEng (Hons)",
    credits: 132,
    durationYears: 4,
    status: "ACTIVE",
    createdAt: "2025-01-15T09:00:00.000Z",
    updatedAt: "2026-02-11T09:00:00.000Z",
    isDeleted: false,
  },
  {
    code: "EE",
    name: "BEng Electrical Engineering",
    facultyCode: "FOE",
    award: "BEng (Hons)",
    credits: 132,
    durationYears: 4,
    status: "ACTIVE",
    createdAt: "2025-01-21T09:00:00.000Z",
    updatedAt: "2026-01-22T09:00:00.000Z",
    isDeleted: false,
  },
  {
    code: "BIZ",
    name: "BBA Business Administration",
    facultyCode: "FOB",
    award: "BBA",
    credits: 120,
    durationYears: 3,
    status: "ACTIVE",
    createdAt: "2025-02-05T09:00:00.000Z",
    updatedAt: "2026-02-25T09:00:00.000Z",
    isDeleted: false,
  },
  {
    code: "FIN",
    name: "BSc Finance",
    facultyCode: "FOB",
    award: "BSc",
    credits: 120,
    durationYears: 3,
    status: "ACTIVE",
    createdAt: "2025-01-28T09:00:00.000Z",
    updatedAt: "2026-02-08T09:00:00.000Z",
    isDeleted: false,
  },
  {
    code: "BIO",
    name: "BSc Biomedical Science",
    facultyCode: "FOS",
    award: "BSc",
    credits: 128,
    durationYears: 4,
    status: "INACTIVE",
    createdAt: "2024-11-15T09:00:00.000Z",
    updatedAt: "2025-11-30T09:00:00.000Z",
    isDeleted: false,
  },
];

const globalForDegreePrograms = globalThis as typeof globalThis & {
  __degreeProgramStore?: DegreeProgramRecord[];
};

function degreeProgramStore() {
  if (!globalForDegreePrograms.__degreeProgramStore) {
    globalForDegreePrograms.__degreeProgramStore = [...INITIAL_DEGREE_PROGRAMS];
  }

  return globalForDegreePrograms.__degreeProgramStore;
}

export function replaceDegreeProgramStore(records: DegreeProgramRecord[]) {
  globalForDegreePrograms.__degreeProgramStore = records.map((record) => ({
    ...record,
  }));
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
}

export function sanitizeDegreeProgramCode(value: unknown) {
  return normalizeCode(String(value ?? ""));
}

export function sanitizeDegreeProgramStatus(value: unknown): DegreeProgramStatus {
  if (value === "INACTIVE") return "INACTIVE";
  if (value === "DRAFT") return "DRAFT";
  return "ACTIVE";
}

export function sanitizeDurationYears(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

export function sanitizeCredits(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

export function listDegreePrograms(options?: {
  search?: string;
  faculty?: string;
  code?: string;
  award?: string;
  creditsMin?: number;
  creditsMax?: number;
  durationYears?: number;
  status?: "" | DegreeProgramStatus;
  sort?: DegreeProgramSort;
}) {
  const search = options?.search?.trim().toLowerCase() ?? "";
  const faculty = normalizeCode(options?.faculty ?? "");
  const code = normalizeCode(options?.code ?? "");
  const award = options?.award?.trim().toLowerCase() ?? "";
  const creditsMin = options?.creditsMin && options.creditsMin > 0 ? options.creditsMin : 0;
  const creditsMax = options?.creditsMax && options.creditsMax > 0 ? options.creditsMax : 0;
  const durationYears =
    options?.durationYears && options.durationYears > 0 ? options.durationYears : 0;
  const status = options?.status ?? "";
  const sort = options?.sort ?? "updated";

  const filtered = degreeProgramStore().filter((program) => {
    if (program.isDeleted) {
      return false;
    }

    if (faculty && program.facultyCode !== faculty) {
      return false;
    }

    if (code && !program.code.includes(code)) {
      return false;
    }

    if (award && program.award.toLowerCase() !== award) {
      return false;
    }

    if (creditsMin && program.credits < creditsMin) {
      return false;
    }

    if (creditsMax && program.credits > creditsMax) {
      return false;
    }

    if (durationYears && program.durationYears !== durationYears) {
      return false;
    }

    if (status && program.status !== status) {
      return false;
    }

    if (!search) {
      return true;
    }

    return `${program.code} ${program.name} ${program.award}`
      .toLowerCase()
      .includes(search);
  });

  return filtered.sort((left, right) => {
    if (sort === "az") {
      return left.code.localeCompare(right.code);
    }

    if (sort === "za") {
      return right.code.localeCompare(left.code);
    }

    if (sort === "created") {
      return right.createdAt.localeCompare(left.createdAt);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function findDegreeProgram(
  code: string,
  options?: {
    includeDeleted?: boolean;
  }
) {
  const targetCode = normalizeCode(code);
  return (
    degreeProgramStore().find((program) => {
      if (program.code !== targetCode) {
        return false;
      }

      if (options?.includeDeleted) {
        return true;
      }

      return !program.isDeleted;
    }) ?? null
  );
}

export function createDegreeProgram(input: {
  code: string;
  name: string;
  facultyCode: string;
  award: string;
  credits: number;
  durationYears: number;
  status: DegreeProgramStatus;
}) {
  const now = new Date().toISOString();
  const nextProgram: DegreeProgramRecord = {
    code: normalizeCode(input.code),
    name: input.name.trim(),
    facultyCode: input.facultyCode,
    award: input.award.trim(),
    credits: input.credits,
    durationYears: input.durationYears,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  degreeProgramStore().unshift(nextProgram);
  return nextProgram;
}

export function updateDegreeProgram(
  code: string,
  input: {
    name: string;
    facultyCode: string;
    award: string;
    credits: number;
    durationYears: number;
    status: DegreeProgramStatus;
  }
) {
  const targetCode = normalizeCode(code);
  const store = degreeProgramStore();
  const index = store.findIndex(
    (program) => program.code === targetCode && !program.isDeleted
  );

  if (index < 0) {
    return null;
  }

  const updatedProgram: DegreeProgramRecord = {
    ...store[index],
    name: input.name.trim(),
    facultyCode: input.facultyCode,
    award: input.award.trim(),
    credits: input.credits,
    durationYears: input.durationYears,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };

  store[index] = updatedProgram;
  return updatedProgram;
}

export function deleteDegreeProgram(code: string) {
  const targetCode = normalizeCode(code);
  const store = degreeProgramStore();
  const index = store.findIndex(
    (program) => program.code === targetCode && !program.isDeleted
  );

  if (index < 0) {
    return false;
  }

  store[index] = {
    ...store[index],
    isDeleted: true,
    updatedAt: new Date().toISOString(),
  };

  return true;
}

export function isValidFacultyCode(code: string) {
  return Boolean(findFaculty(code));
}

