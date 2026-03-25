import mongoose from "mongoose";
import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import { findIntakeById, listTermOptions, type TermCode } from "@/lib/intake-store";
import {
  listLabAssistantsInMemory,
  toLabAssistantPersistedRecordFromUnknown,
  type LabAssistantPersistedRecord,
} from "@/lib/lab-assistant-store";
import {
  listLecturersInMemory,
  toLecturerPersistedRecordFromUnknown,
  type LecturerPersistedRecord,
} from "@/lib/lecturer-store";
import {
  type ModuleOfferingRecord,
  type ModuleOfferingStatus,
  type SyllabusVersion,
} from "@/lib/module-offering-store";
import { findModuleById } from "@/lib/module-store";
import { isStaffEligibleForOffering } from "@/lib/staff-eligibility";
import { LabAssistantModel } from "@/models/LabAssistant";
import { LecturerModel } from "@/models/Lecturer";

const TERM_CODES = listTermOptions();

export interface AssigneeItem {
  id: string;
  fullName: string;
  email: string;
  status: string;
}

export interface OfferingScope {
  facultyId: string;
  degreeProgramId: string;
  moduleId: string;
}

export interface ResolvedOfferingContext extends OfferingScope {
  intakeId: string;
  termCode: TermCode;
  moduleCode: string;
  moduleName: string;
  defaultSyllabusVersion: SyllabusVersion;
}

export function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

export function sanitizeId(value: unknown) {
  return String(value ?? "").trim();
}

export function sanitizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => sanitizeId(item))
        .filter(Boolean)
    )
  );
}

export function sanitizeSyllabusVersion(value: unknown): SyllabusVersion {
  return value === "OLD" ? "OLD" : "NEW";
}

export function sanitizeOfferingStatus(value: unknown): ModuleOfferingStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

export function parseTermCodeStrict(value: unknown): TermCode | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) {
    return null;
  }

  return TERM_CODES.find((item) => item === raw) ?? null;
}

export function toIsoDate(value: unknown) {
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

export function normalizeDbOffering(value: unknown): ModuleOfferingRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = sanitizeId(row._id ?? row.id);
  const intakeId = sanitizeId(row.intakeId);
  const moduleId = sanitizeId(row.moduleId);
  const termCode = parseTermCodeStrict(row.termCode);
  if (!id || !intakeId || !moduleId || !termCode) {
    return null;
  }

  const intake = findIntakeById(intakeId);
  const moduleRecord = findModuleById(moduleId);
  const assignedLecturerIds = sanitizeIdList(
    row.assignedLecturerIds ?? row.assignedLecturers
  );
  const createdAt = toIsoDate(row.createdAt);
  const updatedAt = toIsoDate(row.updatedAt);
  const now = new Date().toISOString();

  return {
    id,
    facultyId: normalizeAcademicCode(row.facultyId ?? intake?.facultyCode),
    degreeProgramId: normalizeAcademicCode(row.degreeProgramId ?? intake?.degreeCode),
    intakeId,
    termCode,
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
    assignedLabAssistantIds: sanitizeIdList(row.assignedLabAssistantIds),
    status: sanitizeOfferingStatus(row.status),
    assignedLecturers: assignedLecturerIds,
    outlineWeeks: [],
    outlinePending: row.outlinePending === true,
    hasGrades: row.hasGrades === true,
    hasAttendance: row.hasAttendance === true,
    hasContent: row.hasContent === true,
    createdAt: createdAt || updatedAt || now,
    updatedAt: updatedAt || createdAt || now,
    isDeleted: row.isDeleted === true,
  };
}

export function resolveOfferingContext(input: {
  facultyId?: unknown;
  degreeProgramId?: unknown;
  intakeId: unknown;
  termCode: unknown;
  moduleId: unknown;
}): ResolvedOfferingContext {
  const intakeId = sanitizeId(input.intakeId);
  if (!intakeId) {
    throw new Error("Intake is required");
  }

  const termCode = parseTermCodeStrict(input.termCode);
  if (!termCode) {
    throw new Error("Select a valid semester / term");
  }

  const moduleId = sanitizeId(input.moduleId);
  if (!moduleId) {
    throw new Error("Module is required");
  }

  const intake = findIntakeById(intakeId);
  if (!intake) {
    throw new Error("Intake not found");
  }

  const hasTermSchedule = intake.termSchedules.some((row) => row.termCode === termCode);
  if (!hasTermSchedule) {
    throw new Error("Selected term is not configured for this intake");
  }

  const facultyId = normalizeAcademicCode(input.facultyId ?? intake.facultyCode);
  if (!facultyId) {
    throw new Error("Faculty is required");
  }

  const degreeProgramId = normalizeAcademicCode(
    input.degreeProgramId ?? intake.degreeCode
  );
  if (!degreeProgramId) {
    throw new Error("Degree is required");
  }

  if (facultyId !== intake.facultyCode) {
    throw new Error("Selected intake does not belong to the selected faculty");
  }

  if (degreeProgramId !== intake.degreeCode) {
    throw new Error("Selected intake does not belong to the selected degree");
  }

  const moduleRecord = findModuleById(moduleId);
  if (!moduleRecord) {
    throw new Error("Module not found");
  }

  if (moduleRecord.facultyCode !== facultyId) {
    throw new Error("Module does not belong to the selected faculty");
  }

  if (!moduleRecord.applicableDegrees.includes(degreeProgramId)) {
    throw new Error("Module is not applicable for the selected degree");
  }

  if (!moduleRecord.applicableTerms.includes(termCode)) {
    throw new Error("Module is not applicable for the selected term");
  }

  return {
    facultyId,
    degreeProgramId,
    intakeId,
    termCode,
    moduleId,
    moduleCode: moduleRecord.code,
    moduleName: moduleRecord.name,
    defaultSyllabusVersion: moduleRecord.defaultSyllabusVersion,
  };
}

function isEligibleByScope(
  row: {
    facultyIds: string[];
    degreeProgramIds: string[];
    moduleIds: string[];
  },
  scope: OfferingScope
) {
  return isStaffEligibleForOffering(row, {
    facultyId: scope.facultyId,
    degreeProgramId: scope.degreeProgramId,
    moduleId: scope.moduleId,
  });
}

async function loadLecturersByIds(
  ids: string[],
  mongooseConnection: typeof mongoose | null
) {
  const map = new Map<string, LecturerPersistedRecord>();
  listLecturersInMemory().forEach((row) => {
    map.set(row.id, row);
  });

  if (!mongooseConnection) {
    return map;
  }

  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (objectIds.length === 0) {
    return map;
  }

  const rows = (await LecturerModel.find({ _id: { $in: objectIds } })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  rows
    .map((row) => toLecturerPersistedRecordFromUnknown(row))
    .filter((row): row is LecturerPersistedRecord => Boolean(row))
    .forEach((row) => {
      map.set(row.id, row);
    });

  return map;
}

async function loadLabAssistantsByIds(
  ids: string[],
  mongooseConnection: typeof mongoose | null
) {
  const map = new Map<string, LabAssistantPersistedRecord>();
  listLabAssistantsInMemory().forEach((row) => {
    map.set(row.id, row);
  });

  if (!mongooseConnection) {
    return map;
  }

  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (objectIds.length === 0) {
    return map;
  }

  const rows = (await LabAssistantModel.find({ _id: { $in: objectIds } })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  rows
    .map((row) => toLabAssistantPersistedRecordFromUnknown(row))
    .filter((row): row is LabAssistantPersistedRecord => Boolean(row))
    .forEach((row) => {
      map.set(row.id, row);
    });

  return map;
}

export async function validateLecturerAssignments(input: {
  ids: string[];
  scope: OfferingScope;
  mongooseConnection: typeof mongoose | null;
}) {
  const map = await loadLecturersByIds(input.ids, input.mongooseConnection);

  for (const lecturerId of input.ids) {
    const row = map.get(lecturerId);
    if (!row) {
      throw new Error(`Lecturer not found: ${lecturerId}`);
    }
    if (row.status !== "ACTIVE") {
      throw new Error(`Lecturer is inactive: ${row.fullName}`);
    }
    if (!isEligibleByScope(row, input.scope)) {
      throw new Error(`Lecturer is not eligible for this offering: ${row.fullName}`);
    }
  }
}

export async function validateLabAssistantAssignments(input: {
  ids: string[];
  scope: OfferingScope;
  mongooseConnection: typeof mongoose | null;
}) {
  const map = await loadLabAssistantsByIds(input.ids, input.mongooseConnection);

  for (const labAssistantId of input.ids) {
    const row = map.get(labAssistantId);
    if (!row) {
      throw new Error(`Lab assistant not found: ${labAssistantId}`);
    }
    if (row.status !== "ACTIVE") {
      throw new Error(`Lab assistant is inactive: ${row.fullName}`);
    }
    if (!isEligibleByScope(row, input.scope)) {
      throw new Error(`Lab assistant is not eligible for this offering: ${row.fullName}`);
    }
  }
}

export async function resolveAssigneeMaps(
  input: {
    lecturerIds: string[];
    labAssistantIds: string[];
  },
  mongooseConnection: typeof mongoose | null
) {
  const lecturerRows = await loadLecturersByIds(input.lecturerIds, mongooseConnection);
  const labAssistantRows = await loadLabAssistantsByIds(
    input.labAssistantIds,
    mongooseConnection
  );

  const lecturerMap = new Map<string, AssigneeItem>();
  lecturerRows.forEach((row) => {
    lecturerMap.set(row.id, {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      status: row.status,
    });
  });

  const labAssistantMap = new Map<string, AssigneeItem>();
  labAssistantRows.forEach((row) => {
    labAssistantMap.set(row.id, {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      status: row.status,
    });
  });

  return {
    lecturerMap,
    labAssistantMap,
  };
}

export function toApiOfferingItem(
  offering: ModuleOfferingRecord,
  assignees: {
    lecturerMap: Map<string, AssigneeItem>;
    labAssistantMap: Map<string, AssigneeItem>;
  }
) {
  const faculty = findFaculty(offering.facultyId);
  const degree = findDegreeProgram(offering.degreeProgramId);
  const intake = findIntakeById(offering.intakeId);
  const moduleRecord = findModuleById(offering.moduleId);

  const lecturers = offering.assignedLecturerIds.map((id) => {
    const row = assignees.lecturerMap.get(id);
    return {
      _id: id,
      id,
      fullName: row?.fullName ?? "Unknown Lecturer",
      email: row?.email ?? "",
      status: row?.status ?? "INACTIVE",
    };
  });

  const labAssistants = offering.assignedLabAssistantIds.map((id) => {
    const row = assignees.labAssistantMap.get(id);
    return {
      _id: id,
      id,
      fullName: row?.fullName ?? "Unknown Lab Assistant",
      email: row?.email ?? "",
      status: row?.status ?? "INACTIVE",
    };
  });

  return {
    id: offering.id,
    _id: offering.id,
    facultyId: offering.facultyId,
    degreeProgramId: offering.degreeProgramId,
    intakeId: offering.intakeId,
    termCode: offering.termCode,
    moduleId: offering.moduleId,
    moduleCode: offering.moduleCode || moduleRecord?.code || "",
    moduleName: offering.moduleName || moduleRecord?.name || "",
    syllabusVersion: offering.syllabusVersion,
    status: offering.status,
    assignedLecturerIds: offering.assignedLecturerIds,
    assignedLabAssistantIds: offering.assignedLabAssistantIds,
    assignedLecturers: offering.assignedLecturerIds,
    lecturers,
    labAssistants,
    lecturerCount: lecturers.length,
    labAssistantCount: labAssistants.length,
    module: {
      _id: offering.moduleId,
      id: offering.moduleId,
      code: offering.moduleCode || moduleRecord?.code || "",
      name: offering.moduleName || moduleRecord?.name || "",
    },
    faculty: {
      _id: offering.facultyId,
      id: offering.facultyId,
      code: offering.facultyId,
      name: faculty?.name ?? "",
    },
    degree: {
      _id: offering.degreeProgramId,
      id: offering.degreeProgramId,
      code: offering.degreeProgramId,
      name: degree?.name ?? "",
    },
    intake: {
      _id: offering.intakeId,
      id: offering.intakeId,
      name: intake?.name ?? "",
      currentTerm: intake?.currentTerm ?? "",
    },
    createdAt: offering.createdAt,
    updatedAt: offering.updatedAt,
  };
}
