import bcrypt from "bcryptjs";
import { findDegreeProgram } from "@/models/degree-program-store";
import { findFaculty } from "@/models/faculty-store";
import { findIntakeById } from "@/models/intake-store";

export type StudentStream = "WEEKDAY" | "WEEKEND";
export type StudentStatus = "ACTIVE" | "INACTIVE";
export type StudentSort = "updated" | "created" | "az" | "za";

export const DUPLICATE_ENROLLMENT_MESSAGE =
  "Student already enrolled in this program intake";

export interface StudentProfileWriteInput {
  firstName: string;
  lastName: string;
  nicNumber: string;
  phone: string;
  status: StudentStatus;
}

export interface EnrollmentWriteInput {
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
  stream: StudentStream;
  subgroup?: string | null;
  status: StudentStatus;
}

export interface StudentRegistrationWriteInput {
  profile: StudentProfileWriteInput;
  enrollment: EnrollmentWriteInput;
}

export interface StudentPersistedRecord extends StudentProfileWriteInput {
  id: string;
  studentId: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentPersistedRecord extends EnrollmentWriteInput {
  id: string;
  studentId: string;
  subgroup: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentApiEnrollment extends EnrollmentPersistedRecord {
  facultyName: string;
  degreeProgramName: string;
  intakeName: string;
  currentTerm: string;
}

export interface StudentApiRecord extends StudentPersistedRecord {
  enrollmentCount: number;
  latestEnrollment: StudentApiEnrollment | null;
}

export interface StudentDetailApiRecord extends StudentApiRecord {
  enrollments: StudentApiEnrollment[];
}

export interface IntakeEnrollmentCandidateInMemory {
  enrollmentId: string;
  studentRecordId: string;
  studentId: string;
  currentSubgroup: string | null;
}

interface UserPersistedRecord {
  id: string;
  username: string;
  email: string;
  role: "ADMIN" | "LECTURER" | "LAB_ASSISTANT" | "STUDENT";
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
  __studentProfileMemoryStore?: StudentPersistedRecord[];
  __studentEnrollmentMemoryStore?: EnrollmentPersistedRecord[];
  __studentUserMemoryStore?: UserPersistedRecord[];
  __studentCounterMemoryStore?: Map<string, number>;
};

function studentMemoryStore() {
  if (!globalForStudentRegistration.__studentProfileMemoryStore) {
    globalForStudentRegistration.__studentProfileMemoryStore = [];
  }

  return globalForStudentRegistration.__studentProfileMemoryStore;
}

function enrollmentMemoryStore() {
  if (!globalForStudentRegistration.__studentEnrollmentMemoryStore) {
    globalForStudentRegistration.__studentEnrollmentMemoryStore = [];
  }

  return globalForStudentRegistration.__studentEnrollmentMemoryStore;
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

  return partial?.[1] ?? "";
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

function enrollmentSearchText(item: StudentApiEnrollment) {
  return [
    item.facultyId,
    item.facultyName,
    item.degreeProgramId,
    item.degreeProgramName,
    item.intakeId,
    item.intakeName,
    item.currentTerm,
    item.stream,
    item.subgroup ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function sortEnrollmentsByLatest(
  enrollments: StudentApiEnrollment[]
): StudentApiEnrollment[] {
  return [...enrollments].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
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

export function sanitizeNicNumber(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 20);
}

export function sanitizeSubgroup(value: unknown) {
  const trimmed = collapseSpaces(String(value ?? "")).slice(0, 40);
  return trimmed || null;
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

export function decorateEnrollmentRecord(
  record: EnrollmentPersistedRecord
): StudentApiEnrollment {
  const faculty = findFaculty(record.facultyId);
  const degree = findDegreeProgram(record.degreeProgramId);
  const intake = findIntakeById(record.intakeId);

  return {
    ...record,
    facultyName: faculty?.name ?? "",
    degreeProgramName: degree?.name ?? "",
    intakeName: intake?.name ?? "",
    currentTerm: intake?.currentTerm ?? "",
  };
}

export function decorateStudentListRecord(
  student: StudentPersistedRecord,
  enrollments: EnrollmentPersistedRecord[]
): StudentApiRecord {
  const decoratedEnrollments = sortEnrollmentsByLatest(
    enrollments.map((item) => decorateEnrollmentRecord(item))
  );

  return {
    ...student,
    enrollmentCount: decoratedEnrollments.length,
    latestEnrollment: decoratedEnrollments[0] ?? null,
  };
}

export function decorateStudentDetailRecord(
  student: StudentPersistedRecord,
  enrollments: EnrollmentPersistedRecord[]
): StudentDetailApiRecord {
  const decoratedEnrollments = sortEnrollmentsByLatest(
    enrollments.map((item) => decorateEnrollmentRecord(item))
  );

  return {
    ...student,
    enrollmentCount: decoratedEnrollments.length,
    latestEnrollment: decoratedEnrollments[0] ?? null,
    enrollments: decoratedEnrollments,
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
  const enrollments = enrollmentMemoryStore();

  const mapped = studentMemoryStore()
    .filter((student) => {
      if (status && student.status !== status) {
        return false;
      }

      if (!search) {
        return true;
      }

      const studentSearch = [
        student.studentId,
        student.firstName,
        student.lastName,
        student.email,
        student.nicNumber,
      ]
        .join(" ")
        .toLowerCase();

      if (studentSearch.includes(search)) {
        return true;
      }

      const studentEnrollments = enrollments.filter(
        (item) => item.studentId === student.id
      );

      return studentEnrollments
        .map((item) => enrollmentSearchText(decorateEnrollmentRecord(item)))
        .some((text) => text.includes(search));
    })
    .map((student) => {
      const studentEnrollments = enrollments.filter(
        (item) => item.studentId === student.id
      );

      return decorateStudentListRecord(student, studentEnrollments);
    });

  return mapped.sort((left, right) => {
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

export function findStudentDetailInMemoryById(id: string) {
  const target = findStudentInMemoryById(id);
  if (!target) {
    return null;
  }

  const enrollments = enrollmentMemoryStore().filter(
    (item) => item.studentId === target.id
  );

  return decorateStudentDetailRecord(target, enrollments);
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

function createEnrollmentInMemoryInternal(
  studentRecordId: string,
  input: EnrollmentWriteInput
) {
  const store = enrollmentMemoryStore();
  const duplicate = store.find(
    (item) =>
      item.studentId === studentRecordId &&
      item.degreeProgramId === input.degreeProgramId &&
      item.intakeId === input.intakeId
  );

  if (duplicate) {
    throw new Error(DUPLICATE_ENROLLMENT_MESSAGE);
  }

  const now = new Date().toISOString();
  const record: EnrollmentPersistedRecord = {
    id: `enr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentId: studentRecordId,
    facultyId: input.facultyId,
    degreeProgramId: input.degreeProgramId,
    intakeId: input.intakeId,
    stream: input.stream,
    subgroup: input.subgroup ?? null,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };

  store.unshift(record);
  return record;
}

export async function createStudentAndUserInMemory(
  input: StudentRegistrationWriteInput
) {
  const reserved = reserveNextStudentIdentityInMemory(input.enrollment.intakeId);
  const students = studentMemoryStore();
  const users = userMemoryStore();

  const duplicateStudent = students.find(
    (item) =>
      item.studentId === reserved.studentId ||
      item.email === reserved.email ||
      item.nicNumber === input.profile.nicNumber
  );
  if (duplicateStudent) {
    if (duplicateStudent.nicNumber === input.profile.nicNumber) {
      throw new Error("NIC number already exists");
    }

    throw new Error("Generated student ID already exists. Retry registration.");
  }

  const duplicateUser = users.find(
    (item) => item.username === reserved.studentId || item.email === reserved.email
  );
  if (duplicateUser) {
    throw new Error("Generated login account already exists. Retry registration.");
  }

  const now = new Date().toISOString();
  const studentRecordId = `stu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nextStudent: StudentPersistedRecord = {
    id: studentRecordId,
    studentId: reserved.studentId,
    email: reserved.email,
    firstName: input.profile.firstName,
    lastName: input.profile.lastName,
    nicNumber: input.profile.nicNumber,
    phone: input.profile.phone,
    status: input.profile.status,
    createdAt: now,
    updatedAt: now,
  };

  students.unshift(nextStudent);

  try {
    createEnrollmentInMemoryInternal(studentRecordId, input.enrollment);
  } catch (error) {
    const studentIndex = students.findIndex((item) => item.id === studentRecordId);
    if (studentIndex >= 0) {
      students.splice(studentIndex, 1);
    }

    throw error;
  }

  const passwordHash = await bcrypt.hash(input.profile.nicNumber, 10);
  const nextUser: UserPersistedRecord = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: reserved.studentId,
    email: reserved.email,
    role: "STUDENT",
    passwordHash,
    mustChangePassword: true,
    status: "ACTIVE",
    studentRef: studentRecordId,
    createdAt: now,
    updatedAt: now,
  };

  users.unshift(nextUser);

  return findStudentDetailInMemoryById(studentRecordId);
}

export function addEnrollmentToStudentInMemory(
  studentRecordId: string,
  input: EnrollmentWriteInput
) {
  const student = findStudentInMemoryById(studentRecordId);
  if (!student) {
    throw new Error("Student not found");
  }

  const enrollment = createEnrollmentInMemoryInternal(student.id, input);
  const students = studentMemoryStore();
  const index = students.findIndex((item) => item.id === student.id);
  if (index >= 0) {
    students[index] = {
      ...students[index],
      updatedAt: new Date().toISOString(),
    };
  }

  return decorateEnrollmentRecord(enrollment);
}

export function listStudentEnrollmentsInMemory(studentRecordId: string) {
  const targetStudentId = String(studentRecordId ?? "").trim();
  if (!targetStudentId) {
    return [];
  }

  const rows = enrollmentMemoryStore()
    .filter((item) => item.studentId === targetStudentId)
    .map((item) => decorateEnrollmentRecord(item));

  return sortEnrollmentsByLatest(rows);
}

export function listIntakeEnrollmentCandidatesInMemory(intakeId: string) {
  const targetIntakeId = String(intakeId ?? "").trim();
  if (!targetIntakeId) {
    return [] as IntakeEnrollmentCandidateInMemory[];
  }

  const studentsById = new Map(
    studentMemoryStore()
      .filter((item) => item.status === "ACTIVE")
      .map((item) => [item.id, item] as const)
  );

  const rows = enrollmentMemoryStore()
    .filter(
      (item) => item.intakeId === targetIntakeId && item.status === "ACTIVE"
    )
    .map((item) => {
      const student = studentsById.get(item.studentId);
      if (!student || !student.studentId) {
        return null;
      }

      return {
        enrollmentId: item.id,
        studentRecordId: item.studentId,
        studentId: student.studentId,
        currentSubgroup: item.subgroup ?? null,
      } satisfies IntakeEnrollmentCandidateInMemory;
    })
    .filter((item): item is IntakeEnrollmentCandidateInMemory => Boolean(item));

  return rows.sort((left, right) => left.studentId.localeCompare(right.studentId));
}

export function bulkAssignEnrollmentSubgroupsInMemory(
  assignments: Array<{ enrollmentId: string; subgroup: string | null }>
) {
  const store = enrollmentMemoryStore();
  const lookup = new Map<string, number>();

  store.forEach((item, index) => {
    lookup.set(item.id, index);
  });

  const now = new Date().toISOString();
  const touchedStudents = new Set<string>();
  let changedCount = 0;
  let unchangedCount = 0;

  assignments.forEach((assignment) => {
    const targetEnrollmentId = String(assignment.enrollmentId ?? "").trim();
    const targetSubgroup = sanitizeSubgroup(assignment.subgroup);
    if (!targetEnrollmentId) {
      return;
    }

    const index = lookup.get(targetEnrollmentId);
    if (index === undefined) {
      return;
    }

    const current = store[index];
    const currentSubgroup = sanitizeSubgroup(current.subgroup);
    if (currentSubgroup === targetSubgroup) {
      unchangedCount += 1;
      return;
    }

    store[index] = {
      ...current,
      subgroup: targetSubgroup,
      updatedAt: now,
    };
    changedCount += 1;
    touchedStudents.add(current.studentId);
  });

  if (touchedStudents.size > 0) {
    const students = studentMemoryStore();
    const touchedSet = new Set(touchedStudents);
    students.forEach((student, index) => {
      if (!touchedSet.has(student.id)) {
        return;
      }

      students[index] = {
        ...student,
        updatedAt: now,
      };
    });
  }

  return {
    changedCount,
    unchangedCount,
  };
}

export function findEnrollmentInMemoryById(enrollmentId: string) {
  const targetEnrollmentId = String(enrollmentId ?? "").trim();
  if (!targetEnrollmentId) {
    return null;
  }

  const row = enrollmentMemoryStore().find((item) => item.id === targetEnrollmentId);
  if (!row) {
    return null;
  }

  return decorateEnrollmentRecord(row);
}

export function updateEnrollmentInMemory(
  enrollmentId: string,
  input: {
    intakeId: string;
    stream: StudentStream;
    subgroup?: string | null;
    status: StudentStatus;
  }
) {
  const targetEnrollmentId = String(enrollmentId ?? "").trim();
  const store = enrollmentMemoryStore();
  const index = store.findIndex((item) => item.id === targetEnrollmentId);
  if (index < 0) {
    return null;
  }

  const current = store[index];
  const duplicate = store.find(
    (item) =>
      item.id !== current.id &&
      item.studentId === current.studentId &&
      item.degreeProgramId === current.degreeProgramId &&
      item.intakeId === input.intakeId
  );
  if (duplicate) {
    throw new Error("Student already enrolled in this intake");
  }

  const updated: EnrollmentPersistedRecord = {
    ...current,
    intakeId: input.intakeId,
    stream: input.stream,
    subgroup: input.subgroup ?? null,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  store[index] = updated;

  const students = studentMemoryStore();
  const studentIndex = students.findIndex((item) => item.id === current.studentId);
  if (studentIndex >= 0) {
    students[studentIndex] = {
      ...students[studentIndex],
      updatedAt: new Date().toISOString(),
    };
  }

  return decorateEnrollmentRecord(updated);
}

export function deleteEnrollmentInMemory(enrollmentId: string) {
  const targetEnrollmentId = String(enrollmentId ?? "").trim();
  const store = enrollmentMemoryStore();
  const index = store.findIndex((item) => item.id === targetEnrollmentId);
  if (index < 0) {
    return null;
  }

  const [removed] = store.splice(index, 1);
  const students = studentMemoryStore();
  const studentIndex = students.findIndex((item) => item.id === removed.studentId);
  if (studentIndex >= 0) {
    students[studentIndex] = {
      ...students[studentIndex],
      updatedAt: new Date().toISOString(),
    };
  }

  return decorateEnrollmentRecord(removed);
}

export function updateStudentInMemory(
  id: string,
  input: StudentProfileWriteInput
) {
  const targetId = String(id ?? "").trim();
  const store = studentMemoryStore();
  const index = store.findIndex((item) => item.id === targetId);
  if (index < 0) {
    return null;
  }

  const duplicateNic = store.find(
    (item) => item.id !== targetId && item.nicNumber === input.nicNumber
  );
  if (duplicateNic) {
    throw new Error("NIC number already exists");
  }

  const updated: StudentPersistedRecord = {
    ...store[index],
    firstName: input.firstName,
    lastName: input.lastName,
    nicNumber: input.nicNumber,
    phone: input.phone,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };

  store[index] = updated;
  return updated;
}

export async function resetStudentPasswordInMemory(studentRecordId: string) {
  const targetId = String(studentRecordId ?? "").trim();
  if (!targetId) {
    throw new Error("Student not found");
  }

  const student = findStudentInMemoryById(targetId);
  if (!student) {
    throw new Error("Student not found");
  }

  if (!student.nicNumber) {
    throw new Error("Student NIC number is missing");
  }

  const users = userMemoryStore();
  const passwordHash = await bcrypt.hash(student.nicNumber, 10);
  const now = new Date().toISOString();
  const index = users.findIndex((user) => user.studentRef === student.id);

  if (index >= 0) {
    users[index] = {
      ...users[index],
      passwordHash,
      mustChangePassword: true,
      status: "ACTIVE",
      updatedAt: now,
    };
    return;
  }

  users.unshift({
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: student.studentId,
    email: student.email,
    role: "STUDENT",
    passwordHash,
    mustChangePassword: true,
    status: "ACTIVE",
    studentRef: student.id,
    createdAt: now,
    updatedAt: now,
  });
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

  const enrollments = enrollmentMemoryStore();
  for (let cursor = enrollments.length - 1; cursor >= 0; cursor -= 1) {
    if (enrollments[cursor].studentId === target.id) {
      enrollments.splice(cursor, 1);
    }
  }

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

export function getMongoDuplicateField(error: unknown) {
  if (!isMongoDuplicateKeyError(error) || !error || typeof error !== "object") {
    return null;
  }

  const row = error as {
    keyPattern?: unknown;
    keyValue?: unknown;
  };

  if (row.keyPattern && typeof row.keyPattern === "object") {
    const key = Object.keys(row.keyPattern as Record<string, unknown>)[0];
    if (key) {
      return key;
    }
  }

  if (row.keyValue && typeof row.keyValue === "object") {
    const key = Object.keys(row.keyValue as Record<string, unknown>)[0];
    if (key) {
      return key;
    }
  }

  return null;
}

