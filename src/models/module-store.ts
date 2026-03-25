export type ModuleOutlineType = "LECTURE" | "MID" | "QUIZ" | "LAB" | "OTHER";
export type ModuleSort = "updated" | "created" | "az" | "za";
export type ApplicableTermCode =
  | "Y1S1"
  | "Y1S2"
  | "Y2S1"
  | "Y2S2"
  | "Y3S1"
  | "Y3S2"
  | "Y4S1"
  | "Y4S2";
export type SyllabusVersion = "OLD" | "NEW";

export interface ModuleOutlineTemplateItem {
  weekNo: number;
  title: string;
  type?: ModuleOutlineType;
}

export interface ModuleRecord {
  id: string;
  code: string;
  name: string;
  credits: number;
  facultyCode: string;
  applicableTerms: ApplicableTermCode[];
  applicableDegrees: string[];
  defaultSyllabusVersion: SyllabusVersion;
  outlineTemplate: ModuleOutlineTemplateItem[];
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

const TERM_SEQUENCE: ApplicableTermCode[] = [
  "Y1S1",
  "Y1S2",
  "Y2S1",
  "Y2S2",
  "Y3S1",
  "Y3S2",
  "Y4S1",
  "Y4S2",
];

const INITIAL_MODULES: ModuleRecord[] = [
  {
    id: "mod-se101",
    code: "SE101",
    name: "Programming Fundamentals",
    credits: 4,
    facultyCode: "FOC",
    applicableTerms: ["Y1S1"],
    applicableDegrees: ["SE", "CS", "IT"],
    defaultSyllabusVersion: "NEW",
    outlineTemplate: [
      { weekNo: 1, title: "Introduce core programming basics", type: "LECTURE" },
      { weekNo: 7, title: "Mid Exam", type: "MID" },
      { weekNo: 12, title: "Quiz and recap", type: "QUIZ" },
    ],
    createdAt: "2025-11-02T09:00:00.000Z",
    updatedAt: "2026-02-14T09:00:00.000Z",
    isDeleted: false,
  },
  {
    id: "mod-se201",
    code: "SE201",
    name: "Database Systems",
    credits: 4,
    facultyCode: "FOC",
    applicableTerms: ["Y1S2", "Y2S1"],
    applicableDegrees: ["SE", "IT"],
    defaultSyllabusVersion: "NEW",
    outlineTemplate: [
      { weekNo: 1, title: "Introduce relational model", type: "LECTURE" },
      { weekNo: 7, title: "Mid Exam", type: "MID" },
    ],
    createdAt: "2025-12-05T09:00:00.000Z",
    updatedAt: "2026-02-19T09:00:00.000Z",
    isDeleted: false,
  },
  {
    id: "mod-cs105",
    code: "CS105",
    name: "Computer Networks",
    credits: 3,
    facultyCode: "FOC",
    applicableTerms: ["Y1S2", "Y2S1"],
    applicableDegrees: ["CS", "IT"],
    defaultSyllabusVersion: "OLD",
    outlineTemplate: [
      { weekNo: 1, title: "Introduce CN", type: "LECTURE" },
      { weekNo: 7, title: "Mid Exam", type: "MID" },
      { weekNo: 11, title: "Lab quiz", type: "QUIZ" },
    ],
    createdAt: "2025-09-14T09:00:00.000Z",
    updatedAt: "2026-01-28T09:00:00.000Z",
    isDeleted: false,
  },
];

const globalForModuleStore = globalThis as typeof globalThis & {
  __moduleStore?: ModuleRecord[];
};

function moduleStore() {
  if (!globalForModuleStore.__moduleStore) {
    globalForModuleStore.__moduleStore = INITIAL_MODULES.map((module) => ({
      ...module,
      applicableTerms: [...module.applicableTerms],
      applicableDegrees: [...module.applicableDegrees],
      outlineTemplate: module.outlineTemplate.map((outline) => ({ ...outline })),
    }));
  }

  return globalForModuleStore.__moduleStore;
}

function sanitizeCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

function sanitizeFacultyCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function sanitizeDegreeCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function sanitizeCredits(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function sanitizeOutlineType(value: unknown): ModuleOutlineType | undefined {
  if (value === "MID") return "MID";
  if (value === "QUIZ") return "QUIZ";
  if (value === "LAB") return "LAB";
  if (value === "OTHER") return "OTHER";
  if (value === "LECTURE") return "LECTURE";
  return undefined;
}

function sanitizeWeekNo(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(60, Math.floor(parsed)));
}

function sanitizeTermCode(value: unknown): ApplicableTermCode | null {
  const term = String(value ?? "").toUpperCase();
  return TERM_SEQUENCE.find((item) => item === term) ?? null;
}

export function sanitizeApplicableTerms(value: unknown): ApplicableTermCode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ordered = new Set<ApplicableTermCode>();
  value.forEach((item) => {
    const term = sanitizeTermCode(item);
    if (term) {
      ordered.add(term);
    }
  });

  return TERM_SEQUENCE.filter((term) => ordered.has(term));
}

export function sanitizeApplicableDegrees(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  value.forEach((item) => {
    const code = sanitizeDegreeCode(item);
    if (code) {
      seen.add(code);
    }
  });

  return Array.from(seen);
}

export function sanitizeDefaultSyllabusVersion(value: unknown): SyllabusVersion {
  return value === "OLD" ? "OLD" : "NEW";
}

export function sanitizeOutlineTemplate(value: unknown): ModuleOutlineTemplateItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byWeek = new Map<number, ModuleOutlineTemplateItem>();

  value.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const row = item as Partial<ModuleOutlineTemplateItem>;
    const weekNo = sanitizeWeekNo(row.weekNo);
    const title = String(row.title ?? "").trim();
    if (!title) {
      return;
    }

    byWeek.set(weekNo, {
      weekNo,
      title,
      type: sanitizeOutlineType(row.type),
    });
  });

  return Array.from(byWeek.values()).sort((left, right) => left.weekNo - right.weekNo);
}

function sortModules(items: ModuleRecord[], sort: ModuleSort) {
  return [...items].sort((left, right) => {
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

export function listModules(options?: {
  search?: string;
  sort?: ModuleSort;
  facultyCode?: string;
  degreeId?: string;
  termCode?: ApplicableTermCode | string;
}) {
  const search = String(options?.search ?? "")
    .trim()
    .toLowerCase();
  const sort = options?.sort ?? "updated";
  const facultyCode = sanitizeFacultyCode(options?.facultyCode);
  const degreeId = sanitizeDegreeCode(options?.degreeId);
  const termCode = sanitizeTermCode(options?.termCode);

  const filtered = moduleStore().filter((module) => {
    if (module.isDeleted) {
      return false;
    }

    if (facultyCode && module.facultyCode !== facultyCode) {
      return false;
    }

    if (degreeId && !module.applicableDegrees.includes(degreeId)) {
      return false;
    }

    if (termCode && !module.applicableTerms.includes(termCode)) {
      return false;
    }

    if (!search) {
      return true;
    }

    return `${module.code} ${module.name}`.toLowerCase().includes(search);
  });

  return sortModules(filtered, sort);
}

export function listApplicableModules(input: {
  facultyCode: string;
  degreeId: string;
  termCode: ApplicableTermCode | string;
}) {
  return listModules({
    sort: "az",
    facultyCode: input.facultyCode,
    degreeId: input.degreeId,
    termCode: input.termCode,
  });
}

export function findModuleById(id: string) {
  const targetId = String(id ?? "").trim();
  return moduleStore().find((module) => module.id === targetId && !module.isDeleted) ?? null;
}

export function findModuleByCode(code: string) {
  const targetCode = sanitizeCode(code);
  return (
    moduleStore().find((module) => module.code === targetCode && !module.isDeleted) ??
    null
  );
}

export function createModule(input: {
  code: string;
  name: string;
  credits: number;
  facultyCode: string;
  applicableTerms: ApplicableTermCode[];
  applicableDegrees: string[];
  defaultSyllabusVersion: SyllabusVersion;
  outlineTemplate: ModuleOutlineTemplateItem[];
}) {
  const now = new Date().toISOString();
  const code = sanitizeCode(input.code);
  const outlineTemplate = sanitizeOutlineTemplate(input.outlineTemplate);
  const next: ModuleRecord = {
    id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code,
    name: String(input.name ?? "").trim(),
    credits: sanitizeCredits(input.credits),
    facultyCode: sanitizeFacultyCode(input.facultyCode),
    applicableTerms: sanitizeApplicableTerms(input.applicableTerms),
    applicableDegrees: sanitizeApplicableDegrees(input.applicableDegrees),
    defaultSyllabusVersion: sanitizeDefaultSyllabusVersion(
      input.defaultSyllabusVersion
    ),
    outlineTemplate,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  moduleStore().unshift(next);
  return next;
}

export function updateModule(
  id: string,
  input: {
    name: string;
    credits: number;
    facultyCode: string;
    applicableTerms: ApplicableTermCode[];
    applicableDegrees: string[];
    defaultSyllabusVersion: SyllabusVersion;
    outlineTemplate: ModuleOutlineTemplateItem[];
  }
) {
  const targetId = String(id ?? "").trim();
  const store = moduleStore();
  const index = store.findIndex((module) => module.id === targetId && !module.isDeleted);
  if (index < 0) {
    return null;
  }

  const updated: ModuleRecord = {
    ...store[index],
    name: String(input.name ?? "").trim(),
    credits: sanitizeCredits(input.credits),
    facultyCode: sanitizeFacultyCode(input.facultyCode),
    applicableTerms: sanitizeApplicableTerms(input.applicableTerms),
    applicableDegrees: sanitizeApplicableDegrees(input.applicableDegrees),
    defaultSyllabusVersion: sanitizeDefaultSyllabusVersion(
      input.defaultSyllabusVersion
    ),
    outlineTemplate: sanitizeOutlineTemplate(input.outlineTemplate),
    updatedAt: new Date().toISOString(),
  };
  store[index] = updated;
  return updated;
}

export function deleteModule(id: string) {
  const targetId = String(id ?? "").trim();
  const store = moduleStore();
  const index = store.findIndex((module) => module.id === targetId && !module.isDeleted);
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
