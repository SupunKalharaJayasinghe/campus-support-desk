export type FacultyStatus = "ACTIVE" | "INACTIVE";

export interface FacultyRecord {
  code: string;
  name: string;
  status: FacultyStatus;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

const INITIAL_FACULTIES: FacultyRecord[] = [
  {
    code: "FOC",
    name: "Faculty of Computing",
    status: "ACTIVE",
    createdAt: "2024-08-12T09:00:00.000Z",
    updatedAt: "2024-08-12T09:00:00.000Z",
    isDeleted: false,
  },
  {
    code: "FOE",
    name: "Faculty of Engineering",
    status: "ACTIVE",
    createdAt: "2024-09-03T09:00:00.000Z",
    updatedAt: "2024-09-03T09:00:00.000Z",
    isDeleted: false,
  },
  {
    code: "FOB",
    name: "Faculty of Business",
    status: "INACTIVE",
    createdAt: "2024-11-21T09:00:00.000Z",
    updatedAt: "2024-11-21T09:00:00.000Z",
    isDeleted: false,
  },
];

const globalForFacultyStore = globalThis as typeof globalThis & {
  __facultyStore?: FacultyRecord[];
};

function facultyStore() {
  if (!globalForFacultyStore.__facultyStore) {
    globalForFacultyStore.__facultyStore = [...INITIAL_FACULTIES];
  }

  return globalForFacultyStore.__facultyStore;
}

export function replaceFacultyStore(records: FacultyRecord[]) {
  globalForFacultyStore.__facultyStore = records.map((record) => ({
    ...record,
  }));
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
}

export function sanitizeFacultyCode(value: unknown) {
  return normalizeCode(String(value ?? ""));
}

export function sanitizeFacultyStatus(value: unknown): FacultyStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

export function listFaculties() {
  return facultyStore()
    .filter((faculty) => !faculty.isDeleted)
    .sort((left, right) => {
    const updatedCompare = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedCompare !== 0) {
      return updatedCompare;
    }

    return left.code.localeCompare(right.code);
    });
}

export function findFaculty(
  code: string,
  options?: {
    includeDeleted?: boolean;
  }
) {
  const targetCode = normalizeCode(code);
  return (
    facultyStore().find((faculty) => {
      if (faculty.code !== targetCode) {
        return false;
      }

      if (options?.includeDeleted) {
        return true;
      }

      return !faculty.isDeleted;
    }) ?? null
  );
}

export function createFaculty(input: {
  code: string;
  name: string;
  status: FacultyStatus;
}) {
  const now = new Date().toISOString();
  const nextFaculty: FacultyRecord = {
    code: normalizeCode(input.code),
    name: input.name.trim(),
    status: input.status,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  facultyStore().unshift(nextFaculty);
  return nextFaculty;
}

export function updateFaculty(
  code: string,
  input: {
    name: string;
    status: FacultyStatus;
  }
) {
  const targetCode = normalizeCode(code);
  const nextUpdatedAt = new Date().toISOString();
  const store = facultyStore();
  const index = store.findIndex(
    (faculty) => faculty.code === targetCode && !faculty.isDeleted
  );

  if (index < 0) {
    return null;
  }

  const updatedFaculty: FacultyRecord = {
    ...store[index],
    name: input.name.trim(),
    status: input.status,
    updatedAt: nextUpdatedAt,
  };

  store[index] = updatedFaculty;
  return updatedFaculty;
}

export function deleteFaculty(code: string) {
  const targetCode = normalizeCode(code);
  const store = facultyStore();
  const index = store.findIndex(
    (faculty) => faculty.code === targetCode && !faculty.isDeleted
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
