import { type GradeLetter, type GradeStatus } from "@/lib/grade-utils";
import { setModuleOfferingGradesState } from "@/lib/module-offering-store";

export interface GradePersistedRecord {
  id: string;
  studentId: string;
  moduleOfferingId: string;
  caMarks: number;
  finalExamMarks: number;
  totalMarks: number;
  gradeLetter: GradeLetter;
  gradePoint: number;
  status: GradeStatus;
  academicYear: string;
  semester: 1 | 2;
  gradedBy: string | null;
  gradedAt: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface GradeWriteInput {
  studentId: string;
  moduleOfferingId: string;
  caMarks: number;
  finalExamMarks: number;
  totalMarks: number;
  gradeLetter: GradeLetter;
  gradePoint: number;
  status: GradeStatus;
  academicYear: string;
  semester: 1 | 2;
  gradedBy?: string | null;
  gradedAt?: string;
  remarks?: string;
}

const globalForGradeStore = globalThis as typeof globalThis & {
  __gradeMemoryStore?: GradePersistedRecord[];
};

function gradeStore() {
  if (!globalForGradeStore.__gradeMemoryStore) {
    globalForGradeStore.__gradeMemoryStore = [];
  }

  return globalForGradeStore.__gradeMemoryStore;
}

function cloneGradeRecord(row: GradePersistedRecord): GradePersistedRecord {
  return { ...row };
}

export function listGradesInMemory(options?: {
  studentId?: string;
  moduleOfferingId?: string;
  academicYear?: string;
  semester?: 1 | 2 | null;
  status?: "" | GradeStatus;
}) {
  const studentId = String(options?.studentId ?? "").trim();
  const moduleOfferingId = String(options?.moduleOfferingId ?? "").trim();
  const academicYear = String(options?.academicYear ?? "").trim();
  const semester = options?.semester ?? null;
  const status = options?.status ?? "";

  return gradeStore()
    .filter((row) => (studentId ? row.studentId === studentId : true))
    .filter((row) => (moduleOfferingId ? row.moduleOfferingId === moduleOfferingId : true))
    .filter((row) => (academicYear ? row.academicYear === academicYear : true))
    .filter((row) => (semester !== null ? row.semester === semester : true))
    .filter((row) => (status ? row.status === status : true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((row) => cloneGradeRecord(row));
}

export function findGradeInMemoryById(id: string) {
  const targetId = String(id ?? "").trim();
  if (!targetId) {
    return null;
  }

  const row = gradeStore().find((item) => item.id === targetId);
  return row ? cloneGradeRecord(row) : null;
}

export function findGradeInMemoryByStudentOffering(
  studentId: string,
  moduleOfferingId: string
) {
  const targetStudentId = String(studentId ?? "").trim();
  const targetModuleOfferingId = String(moduleOfferingId ?? "").trim();
  if (!targetStudentId || !targetModuleOfferingId) {
    return null;
  }

  const row = gradeStore().find(
    (item) =>
      item.studentId === targetStudentId &&
      item.moduleOfferingId === targetModuleOfferingId
  );

  return row ? cloneGradeRecord(row) : null;
}

export function countGradesForModuleOfferingInMemory(moduleOfferingId: string) {
  const targetModuleOfferingId = String(moduleOfferingId ?? "").trim();
  if (!targetModuleOfferingId) {
    return 0;
  }

  return gradeStore().filter((row) => row.moduleOfferingId === targetModuleOfferingId).length;
}

export function createGradeInMemory(input: GradeWriteInput) {
  const store = gradeStore();
  const duplicate = store.find(
    (row) =>
      row.studentId === input.studentId &&
      row.moduleOfferingId === input.moduleOfferingId
  );
  if (duplicate) {
    throw new Error("Grade already exists for this student in this module offering");
  }

  const now = new Date().toISOString();
  const next: GradePersistedRecord = {
    id: `grd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentId: input.studentId,
    moduleOfferingId: input.moduleOfferingId,
    caMarks: input.caMarks,
    finalExamMarks: input.finalExamMarks,
    totalMarks: input.totalMarks,
    gradeLetter: input.gradeLetter,
    gradePoint: input.gradePoint,
    status: input.status,
    academicYear: input.academicYear,
    semester: input.semester,
    gradedBy: String(input.gradedBy ?? "").trim() || null,
    gradedAt: String(input.gradedAt ?? "").trim() || now,
    remarks: String(input.remarks ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };

  store.unshift(next);
  setModuleOfferingGradesState(next.moduleOfferingId, true);
  return cloneGradeRecord(next);
}

export function updateGradeInMemory(
  id: string,
  input: Partial<Omit<GradePersistedRecord, "id" | "createdAt">>
) {
  const targetId = String(id ?? "").trim();
  const store = gradeStore();
  const index = store.findIndex((row) => row.id === targetId);
  if (index < 0) {
    return null;
  }

  const current = store[index];
  const updated: GradePersistedRecord = {
    ...current,
    ...input,
    gradedBy:
      input.gradedBy === undefined
        ? current.gradedBy
        : String(input.gradedBy ?? "").trim() || null,
    gradedAt:
      input.gradedAt === undefined
        ? current.gradedAt
        : String(input.gradedAt ?? "").trim() || current.gradedAt,
    remarks:
      input.remarks === undefined
        ? current.remarks
        : String(input.remarks ?? "").trim(),
    updatedAt: new Date().toISOString(),
  };

  store[index] = updated;
  setModuleOfferingGradesState(updated.moduleOfferingId, true);
  return cloneGradeRecord(updated);
}

export function upsertGradeInMemory(input: GradeWriteInput) {
  const existing = findGradeInMemoryByStudentOffering(
    input.studentId,
    input.moduleOfferingId
  );
  if (!existing) {
    return {
      created: true,
      grade: createGradeInMemory(input),
    };
  }

  const updated = updateGradeInMemory(existing.id, {
    caMarks: input.caMarks,
    finalExamMarks: input.finalExamMarks,
    totalMarks: input.totalMarks,
    gradeLetter: input.gradeLetter,
    gradePoint: input.gradePoint,
    status: input.status,
    academicYear: input.academicYear,
    semester: input.semester,
    gradedBy: input.gradedBy ?? null,
    gradedAt: input.gradedAt ?? new Date().toISOString(),
    remarks: input.remarks ?? "",
  });

  if (!updated) {
    throw new Error("Failed to update grade");
  }

  return {
    created: false,
    grade: updated,
  };
}

export function deleteGradeInMemory(id: string) {
  const targetId = String(id ?? "").trim();
  const store = gradeStore();
  const index = store.findIndex((row) => row.id === targetId);
  if (index < 0) {
    return null;
  }

  const [removed] = store.splice(index, 1);
  if (countGradesForModuleOfferingInMemory(removed.moduleOfferingId) === 0) {
    setModuleOfferingGradesState(removed.moduleOfferingId, false);
  }

  return cloneGradeRecord(removed);
}
