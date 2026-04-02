import {
  findIntakeById,
  sanitizeTermCode,
  type IntakeRecord,
  type TermCode,
} from "@/models/intake-store";
import {
  findModuleById,
  type ModuleRecord,
  type ModuleOutlineTemplateItem,
} from "@/models/module-store";

export type SyllabusVersion = "OLD" | "NEW";
export type ModuleOfferingStatus = "ACTIVE" | "INACTIVE";
export type ModuleOfferingSort = "updated" | "module" | "term";

export interface ModuleOutlineWeekRecord {
  weekNo: number;
  title: string;
  type?: string;
  plannedStartDate: string;
  plannedEndDate: string;
  manuallyEdited: boolean;
}

export interface ModuleOfferingRecord {
  id: string;
  facultyCode: string;
  degreeCode: string;
  intakeName: string;
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
  termCode: TermCode;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  syllabusVersion: SyllabusVersion;
  assignedLecturerIds: string[];
  assignedLabAssistantIds: string[];
  status: ModuleOfferingStatus;
  // Backward-compatible alias used by existing dependencies flow.
  assignedLecturers: string[];
  outlineWeeks: ModuleOutlineWeekRecord[];
  outlinePending: boolean;
  hasGrades: boolean;
  hasAttendance: boolean;
  hasContent: boolean;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

const globalForModuleOfferingStore = globalThis as typeof globalThis & {
  __moduleOfferingStore?: ModuleOfferingRecord[];
};

const TERM_SORT_ORDER: TermCode[] = [
  "Y1S1",
  "Y1S2",
  "Y2S1",
  "Y2S2",
  "Y3S1",
  "Y3S2",
  "Y4S1",
  "Y4S2",
];

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function toIsoTimestamp(value: unknown) {
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

function sanitizeAssignmentIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }

          if (!item || typeof item !== "object") {
            return "";
          }

          const row = item as Record<string, unknown>;
          return String(
            row.id ?? row._id ?? row.lecturerId ?? row.assistantId ?? ""
          ).trim();
        })
        .filter(Boolean)
    )
  );
}

function mergeAssignmentInputs(...values: unknown[]) {
  return values.flatMap((value) => (Array.isArray(value) ? value : []));
}

function sanitizeMergedAssignmentIds(...values: unknown[]) {
  return sanitizeAssignmentIds(mergeAssignmentInputs(...values));
}

function sanitizeOfferingStatus(value: unknown): ModuleOfferingStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function sanitizeOutlineWeeks(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as ModuleOutlineWeekRecord[];
  }

  const rows = value
    .map((item) => asObject(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => {
      const weekNo = sanitizeWeekNo(item.weekNo);
      return {
        weekNo,
        title: String(item.title ?? "").trim() || `Week ${weekNo}`,
        type: String(item.type ?? "").trim() || undefined,
        plannedStartDate: String(item.plannedStartDate ?? "").trim(),
        plannedEndDate: String(item.plannedEndDate ?? "").trim(),
        manuallyEdited: item.manuallyEdited === true,
      } satisfies ModuleOutlineWeekRecord;
    });

  const byWeek = new Map<number, ModuleOutlineWeekRecord>();
  rows.forEach((row) => {
    byWeek.set(row.weekNo, row);
  });

  return Array.from(byWeek.values()).sort((left, right) => left.weekNo - right.weekNo);
}

function normalizeModuleOfferingRecord(value: unknown): ModuleOfferingRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row.id ?? row._id ?? "").trim();
  const intakeId = String(row.intakeId ?? "").trim();
  const moduleId = String(row.moduleId ?? "").trim();

  if (!id || !intakeId || !moduleId) {
    return null;
  }

  const intake = findIntakeById(intakeId);
  const moduleRecord = findModuleById(moduleId);
  const assignedLecturerIds = sanitizeMergedAssignmentIds(
    row.assignedLecturerIds,
    row.assignedLecturers
  );
  const createdAt = toIsoTimestamp(row.createdAt);
  const updatedAt = toIsoTimestamp(row.updatedAt);
  const now = new Date().toISOString();

  return {
    id,
    facultyCode: normalizeAcademicCode(
      row.facultyCode ?? row.facultyId ?? intake?.facultyCode
    ),
    degreeCode: normalizeAcademicCode(
      row.degreeCode ?? row.degreeProgramId ?? intake?.degreeCode
    ),
    intakeName:
      String(row.intakeName ?? intake?.name ?? "")
        .replace(/\s+/g, " ")
        .trim() || intakeId,
    facultyId: normalizeAcademicCode(
      row.facultyId ?? row.facultyCode ?? intake?.facultyCode
    ),
    degreeProgramId: normalizeAcademicCode(
      row.degreeProgramId ?? row.degreeCode ?? intake?.degreeCode
    ),
    intakeId,
    termCode: sanitizeTermCode(row.termCode),
    moduleId,
    moduleCode:
      String(row.moduleCode ?? moduleRecord?.code ?? "")
        .trim()
        .toUpperCase() || moduleId.toUpperCase(),
    moduleName:
      String(row.moduleName ?? moduleRecord?.name ?? "").trim() ||
      String(moduleRecord?.code ?? moduleId).trim(),
    syllabusVersion: sanitizeSyllabusVersion(row.syllabusVersion),
    assignedLecturerIds,
    assignedLabAssistantIds: sanitizeMergedAssignmentIds(
      row.assignedLabAssistantIds,
      row.assignedLabAssistants
    ),
    status: sanitizeOfferingStatus(row.status),
    assignedLecturers: assignedLecturerIds,
    outlineWeeks: sanitizeOutlineWeeks(row.outlineWeeks),
    outlinePending: row.outlinePending === true,
    hasGrades: row.hasGrades === true,
    hasAttendance: row.hasAttendance === true,
    hasContent: row.hasContent === true,
    createdAt: createdAt || updatedAt || now,
    updatedAt: updatedAt || createdAt || now,
    isDeleted: row.isDeleted === true,
  };
}

function offeringStore() {
  if (!globalForModuleOfferingStore.__moduleOfferingStore) {
    globalForModuleOfferingStore.__moduleOfferingStore = [];
  }

  const store = globalForModuleOfferingStore.__moduleOfferingStore
    .map((row) => normalizeModuleOfferingRecord(row))
    .filter((row): row is ModuleOfferingRecord => Boolean(row));

  globalForModuleOfferingStore.__moduleOfferingStore = store;
  return store;
}

function asDate(value: string) {
  if (!value) return null;
  const parsed = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDaysToDateOnly(value: string, days: number) {
  const base = asDate(value);
  if (!base) return "";
  base.setUTCDate(base.getUTCDate() + days);
  return formatDateOnly(base);
}

function sanitizeSyllabusVersion(value: unknown): SyllabusVersion {
  return value === "OLD" ? "OLD" : "NEW";
}

function sanitizeModuleIdList(value: unknown) {
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

function hasOfferingProgress(
  offering: Pick<ModuleOfferingRecord, "hasGrades" | "hasAttendance" | "hasContent">
) {
  return offering.hasGrades || offering.hasAttendance || offering.hasContent;
}

export function hasModuleOfferingProgress(
  offering: Pick<ModuleOfferingRecord, "hasGrades" | "hasAttendance" | "hasContent">
) {
  return hasOfferingProgress(offering);
}

function isModuleApplicableToIntakeTerm(
  moduleRecord: Pick<ModuleRecord, "facultyCode" | "applicableDegrees" | "applicableTerms">,
  intake: Pick<IntakeRecord, "facultyCode" | "degreeCode">,
  termCode: TermCode
) {
  return (
    moduleRecord.facultyCode === intake.facultyCode &&
    moduleRecord.applicableDegrees.includes(intake.degreeCode) &&
    moduleRecord.applicableTerms.includes(termCode)
  );
}

function sanitizeWeekNo(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(60, Math.floor(parsed)));
}

function getIntakeTermStartDate(intake: IntakeRecord, termCode: TermCode) {
  const row =
    intake.termSchedules.find((schedule) => schedule.termCode === termCode) ?? null;
  return row?.startDate ?? "";
}

export function generateOutlineWeeks(
  termStartDate: string,
  template: ModuleOutlineTemplateItem[]
) {
  if (!termStartDate) {
    return [] as ModuleOutlineWeekRecord[];
  }

  const cleanTemplate = [...template]
    .filter((item) => item && Number.isFinite(item.weekNo))
    .sort((left, right) => left.weekNo - right.weekNo);

  return cleanTemplate.map((item) => {
    const weekNo = sanitizeWeekNo(item.weekNo);
    const plannedStartDate = addDaysToDateOnly(termStartDate, (weekNo - 1) * 7);
    const plannedEndDate = addDaysToDateOnly(plannedStartDate, 6);

    return {
      weekNo,
      title: String(item.title ?? "").trim() || `Week ${weekNo}`,
      type: item.type,
      plannedStartDate,
      plannedEndDate,
      manuallyEdited: false,
    };
  });
}

function mergeOutlineWeeks(
  generated: ModuleOutlineWeekRecord[],
  existing: ModuleOutlineWeekRecord[],
  overwriteManual: boolean
) {
  const existingMap = new Map<number, ModuleOutlineWeekRecord>();
  existing.forEach((item) => existingMap.set(item.weekNo, item));

  const merged = generated.map((generatedRow) => {
    const existingRow = existingMap.get(generatedRow.weekNo);
    if (!existingRow) {
      return generatedRow;
    }

    if (existingRow.manuallyEdited && !overwriteManual) {
      return existingRow;
    }

    return generatedRow;
  });

  const extraRows = existing.filter(
    (row) => !generated.some((generatedRow) => generatedRow.weekNo === row.weekNo)
  );

  return [...merged, ...extraRows].sort((left, right) => left.weekNo - right.weekNo);
}

export function listModuleOfferings(options?: {
  facultyCode?: string;
  degreeCode?: string;
  intakeName?: string;
  moduleCode?: string;
  facultyId?: string;
  degreeProgramId?: string;
  intakeId?: string;
  termCode?: TermCode;
  moduleId?: string;
  status?: "" | ModuleOfferingStatus;
  sort?: ModuleOfferingSort;
  search?: string;
}) {
  const facultyCode = normalizeAcademicCode(options?.facultyCode ?? options?.facultyId);
  const degreeCode = normalizeAcademicCode(
    options?.degreeCode ?? options?.degreeProgramId
  );
  const intakeName = String(options?.intakeName ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const moduleCode = String(options?.moduleCode ?? "")
    .trim()
    .toUpperCase();
  const facultyId = normalizeAcademicCode(options?.facultyId ?? options?.facultyCode);
  const degreeProgramId = normalizeAcademicCode(
    options?.degreeProgramId ?? options?.degreeCode
  );
  const intakeId = String(options?.intakeId ?? "").trim();
  const termCode = options?.termCode ? sanitizeTermCode(options.termCode) : null;
  const moduleId = String(options?.moduleId ?? "").trim();
  const status = options?.status ?? "";
  const sort = options?.sort ?? "updated";
  const search = String(options?.search ?? "").trim().toLowerCase();

  const filtered = offeringStore()
    .filter((offering) => !offering.isDeleted)
    .filter((offering) => (facultyCode ? offering.facultyCode === facultyCode : true))
    .filter((offering) => (degreeCode ? offering.degreeCode === degreeCode : true))
    .filter((offering) =>
      intakeName ? offering.intakeName.toLowerCase() === intakeName : true
    )
    .filter((offering) => (moduleCode ? offering.moduleCode === moduleCode : true))
    .filter((offering) => (facultyId ? offering.facultyId === facultyId : true))
    .filter((offering) =>
      degreeProgramId ? offering.degreeProgramId === degreeProgramId : true
    )
    .filter((offering) => (intakeId ? offering.intakeId === intakeId : true))
    .filter((offering) => (termCode ? offering.termCode === termCode : true))
    .filter((offering) => (moduleId ? offering.moduleId === moduleId : true))
    .filter((offering) => (status ? offering.status === status : true))
    .filter((offering) => {
      if (!search) {
        return true;
      }

      return `${offering.moduleCode} ${offering.moduleName}`.toLowerCase().includes(search);
    });

  return filtered.sort((left, right) => {
    if (sort === "module") {
      const codeCompare = left.moduleCode.localeCompare(right.moduleCode);
      if (codeCompare !== 0) {
        return codeCompare;
      }

      const termCompare =
        TERM_SORT_ORDER.indexOf(left.termCode) - TERM_SORT_ORDER.indexOf(right.termCode);
      if (termCompare !== 0) {
        return termCompare;
      }
    }

    if (sort === "term") {
      const termCompare =
        TERM_SORT_ORDER.indexOf(left.termCode) - TERM_SORT_ORDER.indexOf(right.termCode);
      if (termCompare !== 0) {
        return termCompare;
      }

      const codeCompare = left.moduleCode.localeCompare(right.moduleCode);
      if (codeCompare !== 0) {
        return codeCompare;
      }
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function listModuleOfferingsByModuleId(moduleId: string) {
  const targetModuleId = String(moduleId ?? "").trim();
  if (!targetModuleId) {
    return [] as ModuleOfferingRecord[];
  }

  return listModuleOfferings().filter((offering) => offering.moduleId === targetModuleId);
}

export function listModuleOfferingsByLecturerId(lecturerId: string) {
  const targetLecturerId = String(lecturerId ?? "").trim();
  if (!targetLecturerId) {
    return [] as ModuleOfferingRecord[];
  }

  return listModuleOfferings().filter((offering) =>
    offering.assignedLecturerIds.includes(targetLecturerId)
  );
}

export function listModuleOfferingsByLabAssistantId(labAssistantId: string) {
  const targetLabAssistantId = String(labAssistantId ?? "").trim();
  if (!targetLabAssistantId) {
    return [] as ModuleOfferingRecord[];
  }

  return listModuleOfferings().filter((offering) =>
    offering.assignedLabAssistantIds.includes(targetLabAssistantId)
  );
}

export function findModuleOfferingById(id: string) {
  const targetId = String(id ?? "").trim();
  return offeringStore().find((offering) => offering.id === targetId && !offering.isDeleted) ?? null;
}

export function createModuleOffering(input: {
  facultyCode?: string;
  degreeCode?: string;
  intakeName?: string;
  moduleCode?: string;
  facultyId?: string;
  degreeProgramId?: string;
  intakeId: string;
  termCode: TermCode;
  moduleId: string;
  syllabusVersion?: SyllabusVersion;
  assignedLecturerIds?: string[];
  assignedLabAssistantIds?: string[];
  status?: ModuleOfferingStatus;
  assignedLecturers?: string[];
}) {
  const intakeId = String(input.intakeId ?? "").trim();
  const termCode = sanitizeTermCode(input.termCode);
  const moduleId = String(input.moduleId ?? "").trim();
  const assignedLecturerIds = sanitizeAssignmentIds(
    input.assignedLecturerIds ?? input.assignedLecturers
  );
  const assignedLabAssistantIds = sanitizeAssignmentIds(input.assignedLabAssistantIds);

  if (!intakeId) {
    throw new Error("Intake is required");
  }

  if (!moduleId) {
    throw new Error("Module is required");
  }

  const intake = findIntakeById(intakeId);
  if (!intake) {
    throw new Error("Intake not found");
  }

  const moduleRecord = findModuleById(moduleId);
  if (!moduleRecord) {
    throw new Error("Module not found");
  }

  if (!isModuleApplicableToIntakeTerm(moduleRecord, intake, termCode)) {
    throw new Error("Module is not applicable for the selected faculty, degree, and term");
  }

  const syllabusVersion = sanitizeSyllabusVersion(
    input.syllabusVersion ?? moduleRecord.defaultSyllabusVersion
  );
  const status = sanitizeOfferingStatus(input.status);

  const termStartDate = getIntakeTermStartDate(intake, termCode);

  const duplicate = offeringStore().find(
    (offering) =>
      !offering.isDeleted &&
      offering.termCode === termCode &&
      ((offering.intakeId === intakeId && offering.moduleId === moduleId) ||
        (offering.intakeName === intake.name && offering.moduleCode === moduleRecord.code))
  );
  if (duplicate) {
    throw new Error("Module is already assigned for this intake term");
  }

  const outlineWeeks = termStartDate
    ? generateOutlineWeeks(termStartDate, moduleRecord.outlineTemplate)
    : [];
  const now = new Date().toISOString();

  const next: ModuleOfferingRecord = {
    id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    facultyCode: normalizeAcademicCode(
      input.facultyCode ?? input.facultyId ?? intake.facultyCode
    ),
    degreeCode: normalizeAcademicCode(
      input.degreeCode ?? input.degreeProgramId ?? intake.degreeCode
    ),
    intakeName:
      String(input.intakeName ?? intake.name)
        .replace(/\s+/g, " ")
        .trim() || intake.id,
    facultyId: normalizeAcademicCode(input.facultyId ?? intake.facultyCode),
    degreeProgramId: normalizeAcademicCode(
      input.degreeProgramId ?? intake.degreeCode
    ),
    intakeId,
    termCode,
    moduleId,
    moduleCode: moduleRecord.code,
    moduleName: moduleRecord.name,
    syllabusVersion,
    assignedLecturerIds,
    assignedLabAssistantIds,
    status,
    assignedLecturers: assignedLecturerIds,
    outlineWeeks,
    outlinePending: !termStartDate,
    hasGrades: false,
    hasAttendance: false,
    hasContent: false,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  offeringStore().unshift(next);
  return next;
}

export function updateModuleOffering(
  id: string,
  input: {
    facultyCode?: string;
    degreeCode?: string;
    intakeName?: string;
    moduleCode?: string;
    facultyId?: string;
    degreeProgramId?: string;
    intakeId?: string;
    termCode?: TermCode;
    moduleId?: string;
    syllabusVersion?: SyllabusVersion;
    assignedLecturerIds?: string[];
    assignedLabAssistantIds?: string[];
    status?: ModuleOfferingStatus;
    assignedLecturers?: string[];
  }
) {
  const targetId = String(id ?? "").trim();
  const store = offeringStore();
  const index = store.findIndex((offering) => offering.id === targetId && !offering.isDeleted);
  if (index < 0) {
    return null;
  }

  const current = store[index];
  const nextIntakeId =
    input.intakeId === undefined ? current.intakeId : String(input.intakeId ?? "").trim();
  const nextTermCode =
    input.termCode === undefined ? current.termCode : sanitizeTermCode(input.termCode);
  const nextModuleId =
    input.moduleId === undefined ? current.moduleId : String(input.moduleId ?? "").trim();

  if (!nextIntakeId) {
    throw new Error("Intake is required");
  }

  if (!nextModuleId) {
    throw new Error("Module is required");
  }

  const intake = findIntakeById(nextIntakeId);
  if (!intake) {
    throw new Error("Intake not found");
  }

  const moduleRecord = findModuleById(nextModuleId);
  if (!moduleRecord) {
    throw new Error("Module not found");
  }

  const nextFacultyId = normalizeAcademicCode(
    input.facultyId ?? input.facultyCode ?? current.facultyId ?? intake.facultyCode
  );
  const nextDegreeProgramId = normalizeAcademicCode(
    input.degreeProgramId ??
      input.degreeCode ??
      current.degreeProgramId ??
      intake.degreeCode
  );

  if (!nextFacultyId) {
    throw new Error("Faculty is required");
  }

  if (!nextDegreeProgramId) {
    throw new Error("Degree is required");
  }

  if (nextFacultyId !== intake.facultyCode) {
    throw new Error("Selected intake does not belong to the selected faculty");
  }

  if (nextDegreeProgramId !== intake.degreeCode) {
    throw new Error("Selected intake does not belong to the selected degree");
  }

  if (!isModuleApplicableToIntakeTerm(moduleRecord, intake, nextTermCode)) {
    throw new Error("Module is not applicable for the selected faculty, degree, and term");
  }

  const duplicate = store.find(
    (offering) =>
      offering.id !== targetId &&
      !offering.isDeleted &&
      offering.termCode === nextTermCode &&
      ((offering.intakeId === nextIntakeId && offering.moduleId === nextModuleId) ||
        (offering.intakeName === intake.name && offering.moduleCode === moduleRecord.code))
  );
  if (duplicate) {
    throw new Error("Module is already assigned for this intake term");
  }

  const contextChanged =
    nextFacultyId !== current.facultyId ||
    nextDegreeProgramId !== current.degreeProgramId ||
    nextIntakeId !== current.intakeId ||
    nextTermCode !== current.termCode ||
    nextModuleId !== current.moduleId;
  const termStartDate = getIntakeTermStartDate(intake, nextTermCode);
  const nextOutlineWeeks = contextChanged
    ? termStartDate
      ? generateOutlineWeeks(termStartDate, moduleRecord.outlineTemplate)
      : []
    : current.outlineWeeks;
  const nextOutlinePending = contextChanged ? !termStartDate : current.outlinePending;

  const updated: ModuleOfferingRecord = {
    ...current,
    facultyCode: nextFacultyId,
    degreeCode: nextDegreeProgramId,
    intakeName:
      String(input.intakeName ?? intake.name)
        .replace(/\s+/g, " ")
        .trim() || intake.id,
    facultyId: nextFacultyId,
    degreeProgramId: nextDegreeProgramId,
    intakeId: nextIntakeId,
    termCode: nextTermCode,
    moduleId: nextModuleId,
    moduleCode: moduleRecord.code,
    moduleName: moduleRecord.name,
    syllabusVersion:
      input.syllabusVersion === undefined
        ? current.syllabusVersion
        : sanitizeSyllabusVersion(input.syllabusVersion),
    assignedLecturerIds:
      input.assignedLecturerIds !== undefined || input.assignedLecturers !== undefined
        ? sanitizeAssignmentIds(input.assignedLecturerIds ?? input.assignedLecturers)
        : current.assignedLecturerIds,
    assignedLabAssistantIds:
      input.assignedLabAssistantIds === undefined
        ? current.assignedLabAssistantIds
        : sanitizeAssignmentIds(input.assignedLabAssistantIds),
    status:
      input.status === undefined
        ? current.status
        : sanitizeOfferingStatus(input.status),
    outlineWeeks: nextOutlineWeeks,
    outlinePending: nextOutlinePending,
    updatedAt: new Date().toISOString(),
  };
  updated.assignedLecturers = [...updated.assignedLecturerIds];

  store[index] = updated;
  return updated;
}

export function updateModuleOfferingOutlineWeek(
  id: string,
  input: {
    weekNo: number;
    title?: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
    type?: string;
  }
) {
  const targetId = String(id ?? "").trim();
  const weekNo = sanitizeWeekNo(input.weekNo);
  const store = offeringStore();
  const index = store.findIndex((offering) => offering.id === targetId && !offering.isDeleted);
  if (index < 0) {
    return null;
  }

  const current = store[index];
  const outlineWeeks = [...current.outlineWeeks];
  const existingIndex = outlineWeeks.findIndex((row) => row.weekNo === weekNo);
  const currentRow =
    existingIndex >= 0
      ? outlineWeeks[existingIndex]
      : {
          weekNo,
          title: `Week ${weekNo}`,
          plannedStartDate: "",
          plannedEndDate: "",
          manuallyEdited: true,
        };

  const nextRow: ModuleOutlineWeekRecord = {
    ...currentRow,
    title:
      input.title === undefined
        ? currentRow.title
        : String(input.title ?? "").trim() || currentRow.title,
    plannedStartDate:
      input.plannedStartDate === undefined
        ? currentRow.plannedStartDate
        : String(input.plannedStartDate ?? "").trim(),
    plannedEndDate:
      input.plannedEndDate === undefined
        ? currentRow.plannedEndDate
        : String(input.plannedEndDate ?? "").trim(),
    type: input.type === undefined ? currentRow.type : String(input.type ?? "").trim() || undefined,
    manuallyEdited: true,
  };

  if (existingIndex >= 0) {
    outlineWeeks[existingIndex] = nextRow;
  } else {
    outlineWeeks.push(nextRow);
  }

  outlineWeeks.sort((left, right) => left.weekNo - right.weekNo);

  const updated: ModuleOfferingRecord = {
    ...current,
    outlineWeeks,
    outlinePending: false,
    updatedAt: new Date().toISOString(),
  };

  store[index] = updated;
  return updated;
}

export function recalculateModuleOfferingOutline(
  id: string,
  options?: {
    overwriteManual?: boolean;
  }
) {
  const targetId = String(id ?? "").trim();
  const store = offeringStore();
  const index = store.findIndex((offering) => offering.id === targetId && !offering.isDeleted);
  if (index < 0) {
    return null;
  }

  const current = store[index];
  const intake = findIntakeById(current.intakeId);
  if (!intake) {
    throw new Error("Intake not found");
  }

  const moduleRecord = findModuleById(current.moduleId);
  if (!moduleRecord) {
    throw new Error("Module not found");
  }

  const termStartDate = getIntakeTermStartDate(intake, current.termCode);
  if (!termStartDate) {
    throw new Error("Set term start date first.");
  }

  const generated = generateOutlineWeeks(termStartDate, moduleRecord.outlineTemplate);
  const outlineWeeks = mergeOutlineWeeks(
    generated,
    current.outlineWeeks,
    options?.overwriteManual === true
  );

  const updated: ModuleOfferingRecord = {
    ...current,
    outlineWeeks,
    outlinePending: false,
    updatedAt: new Date().toISOString(),
  };

  store[index] = updated;
  return updated;
}

export interface ModuleOfferingSyncBlockedItem {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  reason: string;
}

export interface ModuleOfferingSyncSummary {
  created: ModuleOfferingRecord[];
  removed: string[];
  blocked: ModuleOfferingSyncBlockedItem[];
}

export function syncIntakeOfferingsForTerm(input: {
  intakeId: string;
  termCode: TermCode;
  selectedModuleIds: string[];
}) {
  const intakeId = String(input.intakeId ?? "").trim();
  const termCode = sanitizeTermCode(input.termCode);
  const selectedModuleIds = sanitizeModuleIdList(input.selectedModuleIds);

  if (!intakeId) {
    throw new Error("Intake is required");
  }

  const intake = findIntakeById(intakeId);
  if (!intake) {
    throw new Error("Intake not found");
  }

  const summary: ModuleOfferingSyncSummary = {
    created: [],
    removed: [],
    blocked: [],
  };

  const store = offeringStore();
  const activeOfferings = store.filter(
    (offering) =>
      !offering.isDeleted &&
      offering.intakeId === intakeId &&
      offering.termCode === termCode
  );
  const activeByModuleId = new Map(
    activeOfferings.map((offering) => [offering.moduleId, offering])
  );

  selectedModuleIds.forEach((moduleId) => {
    if (activeByModuleId.has(moduleId)) {
      return;
    }

    const moduleRecord = findModuleById(moduleId);
    if (!moduleRecord) {
      return;
    }

    if (!isModuleApplicableToIntakeTerm(moduleRecord, intake, termCode)) {
      return;
    }

    const created = createModuleOffering({
      intakeId,
      termCode,
      moduleId,
      syllabusVersion: moduleRecord.defaultSyllabusVersion,
    });
    summary.created.push(created);
  });

  activeOfferings.forEach((offering) => {
    if (selectedModuleIds.includes(offering.moduleId)) {
      return;
    }

    if (hasOfferingProgress(offering)) {
      summary.blocked.push({
        moduleId: offering.moduleId,
        moduleCode: offering.moduleCode,
        moduleName: offering.moduleName,
        reason: "Module has grades, attendance, or content data",
      });
      return;
    }

    const index = store.findIndex((item) => item.id === offering.id && !item.isDeleted);
    if (index < 0) {
      return;
    }

    store[index] = {
      ...store[index],
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    };
    summary.removed.push(offering.id);
  });

  return summary;
}

export function deleteModuleOffering(id: string) {
  const targetId = String(id ?? "").trim();
  const store = offeringStore();
  const index = store.findIndex((offering) => offering.id === targetId && !offering.isDeleted);
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
