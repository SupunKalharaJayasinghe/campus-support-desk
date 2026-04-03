import {
  readStoredUser,
  updateStoredUser,
  type DemoUser,
} from "@/lib/rbac";

export interface StudentPortalEnrollment {
  id: string;
  facultyId: string;
  facultyName: string;
  degreeProgramId: string;
  degreeProgramName: string;
  intakeId: string;
  intakeName: string;
  currentTerm: string;
  stream: string;
  subgroup: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentPortalRecord {
  id: string;
  studentId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  status: string;
  enrollmentCount: number;
  latestEnrollment: StudentPortalEnrollment | null;
  enrollments: StudentPortalEnrollment[];
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeText(value: unknown) {
  return collapseSpaces(value).toLowerCase();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function buildStudentPortalName(student: {
  firstName?: unknown;
  lastName?: unknown;
}) {
  return `${collapseSpaces(student.firstName)} ${collapseSpaces(student.lastName)}`.trim();
}

function parseEnrollment(value: unknown): StudentPortalEnrollment | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = collapseSpaces(row.id ?? row._id);
  if (!id) {
    return null;
  }

  return {
    id,
    facultyId: collapseSpaces(row.facultyId).toUpperCase(),
    facultyName: collapseSpaces(row.facultyName),
    degreeProgramId: collapseSpaces(row.degreeProgramId).toUpperCase(),
    degreeProgramName: collapseSpaces(row.degreeProgramName),
    intakeId: collapseSpaces(row.intakeId),
    intakeName: collapseSpaces(row.intakeName),
    currentTerm: collapseSpaces(row.currentTerm),
    stream: collapseSpaces(row.stream),
    subgroup: collapseSpaces(row.subgroup) || null,
    status: collapseSpaces(row.status),
    createdAt: collapseSpaces(row.createdAt),
    updatedAt: collapseSpaces(row.updatedAt),
  };
}

function parseStudentRecord(value: unknown): StudentPortalRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = collapseSpaces(row.id ?? row._id);
  const studentId = collapseSpaces(row.studentId).toUpperCase();
  if (!id || !studentId) {
    return null;
  }

  const firstName = collapseSpaces(row.firstName);
  const lastName = collapseSpaces(row.lastName);
  const enrollments = Array.isArray(row.enrollments)
    ? row.enrollments
        .map((item) => parseEnrollment(item))
        .filter((item): item is StudentPortalEnrollment => Boolean(item))
    : [];
  const latestEnrollment =
    parseEnrollment(row.latestEnrollment) ?? enrollments[0] ?? null;

  return {
    id,
    studentId,
    email: collapseSpaces(row.email).toLowerCase(),
    firstName,
    lastName,
    fullName: buildStudentPortalName({ firstName, lastName }) || studentId,
    phone: collapseSpaces(row.phone),
    status: collapseSpaces(row.status),
    enrollmentCount: Math.max(
      0,
      Number(collapseSpaces(row.enrollmentCount)) || enrollments.length
    ),
    latestEnrollment,
    enrollments,
  };
}

function parseStudentItems(payload: unknown): StudentPortalRecord[] {
  const row = asObject(payload);
  const items = row?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => parseStudentRecord(item))
    .filter((item): item is StudentPortalRecord => Boolean(item));
}

function findBestStudentMatch(items: StudentPortalRecord[], user: DemoUser) {
  if (items.length === 0) {
    return null;
  }

  const sessionEmail = normalizeText(user.email);
  const sessionUsername = normalizeText(user.username);
  const sessionId = normalizeText(user.id);
  const sessionName = normalizeText(user.name);
  const sessionRegistration = normalizeText(user.studentRegistrationNumber);

  if (sessionRegistration) {
    const registrationMatch = items.find(
      (item) => normalizeText(item.studentId) === sessionRegistration
    );
    if (registrationMatch) {
      return registrationMatch;
    }
  }

  if (sessionEmail) {
    const emailMatch = items.find((item) => normalizeText(item.email) === sessionEmail);
    if (emailMatch) {
      return emailMatch;
    }
  }

  if (sessionUsername) {
    const usernameMatch = items.find(
      (item) => normalizeText(item.studentId) === sessionUsername
    );
    if (usernameMatch) {
      return usernameMatch;
    }
  }

  if (sessionId) {
    const idMatch = items.find(
      (item) =>
        normalizeText(item.id) === sessionId ||
        normalizeText(item.studentId) === sessionId
    );
    if (idMatch) {
      return idMatch;
    }
  }

  if (sessionName) {
    const nameMatch = items.find(
      (item) => normalizeText(item.fullName) === sessionName
    );
    if (nameMatch) {
      return nameMatch;
    }
  }

  return items.length === 1 ? items[0] : null;
}

async function fetchStudentDetail(studentRecordId: string) {
  const id = collapseSpaces(studentRecordId);
  if (!id) {
    return null;
  }

  const response = await fetch(`/api/students/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  const payload = await readJson<unknown>(response);
  if (!response.ok) {
    return null;
  }

  return parseStudentRecord(payload);
}

function syncStoredStudent(student: StudentPortalRecord) {
  updateStoredUser({
    studentRef: student.id,
    studentRegistrationNumber: student.studentId,
    username: student.studentId,
    email: student.email || undefined,
    name: student.fullName || undefined,
  });
}

export function getStudentPortalSessionUser() {
  return readStoredUser();
}

export async function resolveCurrentStudentRecord(user?: DemoUser | null) {
  const effectiveUser = user ?? getStudentPortalSessionUser();
  if (!effectiveUser) {
    throw new Error("No student session found. Please sign in again.");
  }

  const directStudentRef = collapseSpaces(effectiveUser.studentRef);
  if (directStudentRef) {
    const directMatch = await fetchStudentDetail(directStudentRef);
    if (directMatch) {
      syncStoredStudent(directMatch);
      return directMatch;
    }
  }

  const candidates = [
    effectiveUser.studentRegistrationNumber,
    effectiveUser.email,
    effectiveUser.username,
    effectiveUser.id,
    effectiveUser.name,
  ]
    .map((value) => collapseSpaces(value))
    .filter(Boolean);
  const seen = new Set<string>();
  let hadSuccessfulLookup = false;
  let lastLookupError = "";

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    const response = await fetch(
      `/api/students?search=${encodeURIComponent(candidate)}&page=1&pageSize=100&sort=az`,
      { cache: "no-store" }
    );
    const payload = await readJson<{ error?: string; message?: string; items?: unknown }>(
      response
    );
    if (!response.ok) {
      lastLookupError =
        collapseSpaces(payload?.error ?? payload?.message) ||
        "Failed to look up your student profile.";
      continue;
    }
    hadSuccessfulLookup = true;

    const items = parseStudentItems(payload);
    const match = findBestStudentMatch(items, effectiveUser);
    if (!match) {
      continue;
    }

    const detailedMatch = (await fetchStudentDetail(match.id)) ?? match;
    syncStoredStudent(detailedMatch);
    return detailedMatch;
  }

  if (!hadSuccessfulLookup && lastLookupError) {
    throw new Error(lastLookupError);
  }

  return null;
}
