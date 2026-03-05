import bcrypt from "bcryptjs";
import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import { findIntakeById } from "@/lib/intake-store";

export type StudentStream = "WEEKDAY" | "WEEKEND";
export type StudentStatus = "ACTIVE" | "INACTIVE";
export type StudentSort = "updated" | "created" | "az" | "za";

export interface StudentWriteInput {
  firstName: string;
  lastName: string;
  phone: string;
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
  stream: StudentStream;
  subgroup?: string | null;
  status: StudentStatus;
}

export interface StudentPersistedRecord
  extends Omit<StudentWriteInput, "subgroup"> {
  subgroup: string | null;
  id: string;
  studentId: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentApiRecord extends StudentPersistedRecord {
  facultyName: string;
  degreeProgramName: string;
  intakeName: string;
  intake: {
    id: string;
    name: string;
    currentTerm: string;
  };
}

interface UserPersistedRecord {
  id: string;
  username: string;
  email: string;
  role: "ADMIN" | "LECTURER" | "STUDENT";
  passwordHash: string;
  mustChangePassword: boolean;
  status: StudentStatus;
  studentRef: string;
  createdAt: string;
  updatedAt: string;
}

const MONTH_NAME_TO_CODE: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

const globalForStudentRegistration = globalThis as typeof globalThis & {
  __studentMemoryStore?: StudentPersistedRecord[];
  __studentUserMemoryStore?: UserPersistedRecord[];
  __studentCounterMemoryStore?: Map<string, number>;
};

function studentMemoryStore() {
  if (!globalForStudentRegistration.__studentMemoryStore) {
    globalForStudentRegistration.__studentMemoryStore = [];
  }

  return globalForStudentRegistration.__studentMemoryStore;
}

function userMemoryStore() {
  if (!globalForStudentRegistration.__studentUserMemoryStore) {
    globalForStudentRegistration.__studentUserMemoryStore = [];
  }

  return globalForStudentRegistration.__studentUserMemoryStore;
}

function counterMemoryStore() {
  if (!globalForStudentRegistration.__studentCounterMemoryStore) {
    globalForStudentRegistration.__studentCounterMemoryStore = new Map();
  }

  return globalForStudentRegistration.__studentCounterMemoryStore;
}

function collapseSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

export function sanitizeStudentStatus(value: unknown): StudentStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

export function sanitizeStudentStream(value: unknown): StudentStream | null {
  if (value === "WEEKDAY") return "WEEKDAY";
  if (value === "WEEKEND") return "WEEKEND";
  return null;
}

export function sanitizeName(value: unknown) {
  return collapseSpaces(String(value ?? ""));
}

export function sanitizePhone(value: unknown) {
  return collapseSpaces(String(value ?? "")).slice(0, 32);
}

export function sanitizeSubgroup(value: unknown) {
  const trimmed = collapseSpaces(String(value ?? "")).slice(0, 40);
  return trimmed || null;
}

function parseMonthCode(value: string) {
  const normalized = value.toLowerCase().trim();
  if (!normalized) {
    return "";
  }

  if (/^(0[1-9]|1[0-2])$/.test(normalized)) {
    return normalized;
  }

  const byFullName = MONTH_NAME_TO_CODE[normalized];
  if (byFullName) {
    return byFullName;
  }

  const partial = Object.entries(MONTH_NAME_TO_CODE).find(([monthName]) =>
    monthName.startsWith(normalized)
  );
  if (!partial) {
    return "";
  }

  return partial[1];
}

function extractYearMonthFromIntakeName(name: string) {
  const match = collapseSpaces(name).match(/(\d{4})\s+([A-Za-z0-9]+)/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthCode = parseMonthCode(String(match[2] ?? ""));
  if (!Number.isFinite(year) || year < 2000 || year > 2100 || !monthCode) {
    return null;
  }

  return { year, monthCode };
}

export function getStudentIdStartSeed() {
  const raw = Number(process.env.STUDENT_ID_START_SEED ?? "1");
  if (!Number.isFinite(raw)) {
    return 1;
  }

  return Math.max(1, Math.floor(raw));
}

export function getStudentEmailDomain() {
  const domain = String(process.env.STUDENT_EMAIL_DOMAIN ?? "my.sllit.lk")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

  return domain || "my.sllit.lk";
}

export function buildStudentEmail(studentId: string) {
  return `${studentId}@${getStudentEmailDomain()}`;
}

export function buildStudentId(prefixKey: string, sequence: number) {
  const seq = Math.max(0, Math.floor(sequence));
  return `${prefixKey}${String(seq).padStart(3, "0")}`;
}

export function resolveStudentPrefix(intakeId: string) {
  const resolvedIntakeId = String(intakeId ?? "").trim();
  if (!resolvedIntakeId) {
    throw new Error("Intake is required");
  }

  const intake = findIntakeById(resolvedIntakeId);
  if (!intake) {
    throw new Error("Intake not found");
  }

  const year =
    Number.isFinite(intake.intakeYear) && intake.intakeYear > 0
      ? intake.intakeYear
      : extractYearMonthFromIntakeName(intake.name)?.year ?? 0;
  const monthCode =
    parseMonthCode(intake.intakeMonth) ||
    extractYearMonthFromIntakeName(intake.name)?.monthCode ||
    "";

  if (!Number.isFinite(year) || year < 2000 || year > 2100 || !monthCode) {
    throw new Error("Selected intake has invalid year/month configuration");
  }

  const yearCode = String(year).slice(-2).padStart(2, "0");
  const prefixKey = `IT${yearCode}${monthCode}`;

  return { intake, prefixKey };
}

export function validateStudentRelations(input: {
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
}) {
  const facultyId = normalizeAcademicCode(input.facultyId);
  const degreeProgramId = normalizeAcademicCode(input.degreeProgramId);
  const intakeId = String(input.intakeId ?? "").trim();

  if (!facultyId) {
    throw new Error("Faculty is required");
  }

  if (!degreeProgramId) {
    throw new Error("Degree is required");
  }

  if (!intakeId) {
    throw new Error("Intake is required");
  }

  const faculty = findFaculty(facultyId);
  if (!faculty) {
    throw new Error("Select a valid faculty");
  }

  const degree = findDegreeProgram(degreeProgramId);
  if (!degree) {
    throw new Error("Select a valid degree");
  }

  if (degree.facultyCode !== facultyId) {
    throw new Error("Selected degree does not belong to selected faculty");
  }

  const intake = findIntakeById(intakeId);
  if (!intake) {
    throw new Error("Select a valid intake");
  }

  if (normalizeAcademicCode(intake.facultyCode) !== facultyId) {
    throw new Error("Selected intake does not belong to selected faculty");
  }

  if (normalizeAcademicCode(intake.degreeCode) !== degreeProgramId) {
    throw new Error("Selected intake does not belong to selected degree");
  }

  return { faculty, degree, intake };
}

export function decorateStudentRecord(record: StudentPersistedRecord): StudentApiRecord {
  const faculty = findFaculty(record.facultyId);
  const degree = findDegreeProgram(record.degreeProgramId);
  const intake = findIntakeById(record.intakeId);

  return {
    ...record,
    facultyName: faculty?.name ?? "",
    degreeProgramName: degree?.name ?? "",
    intakeName: intake?.name ?? "",
    intake: {
      id: intake?.id ?? record.intakeId,
      name: intake?.name ?? "",
      currentTerm: intake?.currentTerm ?? "",
    },
  };
}

export function listStudentsInMemory(options?: {
  search?: string;
  status?: "" | StudentStatus;
  sort?: StudentSort;
}) {
  const search = String(options?.search ?? "").trim().toLowerCase();
  const status = options?.status ?? "";
  const sort = options?.sort ?? "updated";

  const filtered = studentMemoryStore().filter((item) => {
    if (status && item.status !== status) {
      return false;
    }

    if (!search) {
      return true;
    }

    return `${item.studentId} ${item.firstName} ${item.lastName} ${item.email}`
      .toLowerCase()
      .includes(search);
  });

  return [...filtered].sort((left, right) => {
    if (sort === "az") {
      return left.studentId.localeCompare(right.studentId);
    }

    if (sort === "za") {
      return right.studentId.localeCompare(left.studentId);
    }

    if (sort === "created") {
      return right.createdAt.localeCompare(left.createdAt);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function findStudentInMemoryById(id: string) {
  const targetId = String(id ?? "").trim();
  return studentMemoryStore().find((item) => item.id === targetId) ?? null;
}

export function previewNextStudentIdentityInMemory(intakeId: string) {
  const { prefixKey } = resolveStudentPrefix(intakeId);
  const counters = counterMemoryStore();
  const seed = getStudentIdStartSeed();
  const currentSeq = counters.get(prefixKey);
  const nextSeq =
    currentSeq === undefined ? seed : Math.max(seed, Math.floor(currentSeq) + 1);
  const studentIdPreview = buildStudentId(prefixKey, nextSeq);

  return {
    prefixKey,
    nextSeq,
    studentIdPreview,
    emailPreview: buildStudentEmail(studentIdPreview),
  };
}

function reserveNextStudentIdentityInMemory(intakeId: string) {
  const preview = previewNextStudentIdentityInMemory(intakeId);
  counterMemoryStore().set(preview.prefixKey, preview.nextSeq);
  return {
    prefixKey: preview.prefixKey,
    sequence: preview.nextSeq,
    studentId: preview.studentIdPreview,
    email: preview.emailPreview,
  };
}

export async function createStudentAndUserInMemory(input: StudentWriteInput) {
  const reserved = reserveNextStudentIdentityInMemory(input.intakeId);
  const students = studentMemoryStore();
  const users = userMemoryStore();

  const duplicateStudent = students.find(
    (item) => item.studentId === reserved.studentId || item.email === reserved.email
  );
  if (duplicateStudent) {
    throw new Error("Generated student ID already exists. Retry registration.");
  }

  const duplicateUser = users.find(
    (item) => item.username === reserved.studentId || item.email === reserved.email
  );
  if (duplicateUser) {
    throw new Error("Generated login account already exists. Retry registration.");
  }

  const now = new Date().toISOString();
  const studentId = `stu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nextStudent: StudentPersistedRecord = {
    id: studentId,
    studentId: reserved.studentId,
    email: reserved.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    facultyId: input.facultyId,
    degreeProgramId: input.degreeProgramId,
    intakeId: input.intakeId,
    stream: input.stream,
    subgroup: input.subgroup ?? null,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };

  const passwordHash = await bcrypt.hash(reserved.studentId, 10);
  const nextUser: UserPersistedRecord = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: reserved.studentId,
    email: reserved.email,
    role: "STUDENT",
    passwordHash,
    mustChangePassword: true,
    status: "ACTIVE",
    studentRef: studentId,
    createdAt: now,
    updatedAt: now,
  };

  students.unshift(nextStudent);
  users.unshift(nextUser);

  return nextStudent;
}

export function updateStudentInMemory(id: string, input: StudentWriteInput) {
  const targetId = String(id ?? "").trim();
  const store = studentMemoryStore();
  const index = store.findIndex((item) => item.id === targetId);
  if (index < 0) {
    return null;
  }

  const updated: StudentPersistedRecord = {
    ...store[index],
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    facultyId: input.facultyId,
    degreeProgramId: input.degreeProgramId,
    intakeId: input.intakeId,
    stream: input.stream,
    subgroup: input.subgroup === undefined ? store[index].subgroup : input.subgroup,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };

  store[index] = updated;
  return updated;
}

export function deleteStudentInMemory(id: string) {
  const targetId = String(id ?? "").trim();
  const students = studentMemoryStore();
  const index = students.findIndex((item) => item.id === targetId);
  if (index < 0) {
    return false;
  }

  const target = students[index];
  students.splice(index, 1);

  const users = userMemoryStore();
  const userIndex = users.findIndex((user) => user.studentRef === target.id);
  if (userIndex >= 0) {
    users[userIndex] = {
      ...users[userIndex],
      status: "INACTIVE",
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    };
  }

  return true;
}

export function isMongoDuplicateKeyError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const row = error as { code?: unknown };
  return Number(row.code) === 11000;
}
