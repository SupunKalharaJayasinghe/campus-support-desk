import {
  findIntakeById,
  sanitizeTermCode,
  type IntakeRecord,
  type TermCode,
} from "@/lib/intake-store";
import {
  findModuleById,
  type ModuleRecord,
  type ModuleOutlineTemplateItem,
} from "@/lib/module-store";

export type SyllabusVersion = "OLD" | "NEW";

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
  intakeId: string;
  termCode: TermCode;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  syllabusVersion: SyllabusVersion;
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

function offeringStore() {
  if (!globalForModuleOfferingStore.__moduleOfferingStore) {
    globalForModuleOfferingStore.__moduleOfferingStore = [];
  }

  return globalForModuleOfferingStore.__moduleOfferingStore;
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

function sanitizeAssignedLecturers(value: unknown) {
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
  intakeId?: string;
  termCode?: TermCode;
  search?: string;
}) {
  const intakeId = String(options?.intakeId ?? "").trim();
  const termCode = options?.termCode ? sanitizeTermCode(options.termCode) : null;
  const search = String(options?.search ?? "").trim().toLowerCase();

  return offeringStore()
    .filter((offering) => !offering.isDeleted)
    .filter((offering) => (intakeId ? offering.intakeId === intakeId : true))
    .filter((offering) => (termCode ? offering.termCode === termCode : true))
    .filter((offering) => {
      if (!search) {
        return true;
      }

      return `${offering.moduleCode} ${offering.moduleName}`.toLowerCase().includes(search);
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function findModuleOfferingById(id: string) {
  const targetId = String(id ?? "").trim();
  return offeringStore().find((offering) => offering.id === targetId && !offering.isDeleted) ?? null;
}

export function createModuleOffering(input: {
  intakeId: string;
  termCode: TermCode;
  moduleId: string;
  syllabusVersion?: SyllabusVersion;
  assignedLecturers?: string[];
}) {
  const intakeId = String(input.intakeId ?? "").trim();
  const termCode = sanitizeTermCode(input.termCode);
  const moduleId = String(input.moduleId ?? "").trim();
  const assignedLecturers = sanitizeAssignedLecturers(input.assignedLecturers);

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

  const termStartDate = getIntakeTermStartDate(intake, termCode);

  const duplicate = offeringStore().find(
    (offering) =>
      !offering.isDeleted &&
      offering.intakeId === intakeId &&
      offering.termCode === termCode &&
      offering.moduleId === moduleId
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
    intakeId,
    termCode,
    moduleId,
    moduleCode: moduleRecord.code,
    moduleName: moduleRecord.name,
    syllabusVersion,
    assignedLecturers,
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
    syllabusVersion?: SyllabusVersion;
    assignedLecturers?: string[];
  }
) {
  const targetId = String(id ?? "").trim();
  const store = offeringStore();
  const index = store.findIndex((offering) => offering.id === targetId && !offering.isDeleted);
  if (index < 0) {
    return null;
  }

  const updated: ModuleOfferingRecord = {
    ...store[index],
    syllabusVersion:
      input.syllabusVersion === undefined
        ? store[index].syllabusVersion
        : sanitizeSyllabusVersion(input.syllabusVersion),
    assignedLecturers:
      input.assignedLecturers === undefined
        ? store[index].assignedLecturers
        : sanitizeAssignedLecturers(input.assignedLecturers),
    updatedAt: new Date().toISOString(),
  };

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
