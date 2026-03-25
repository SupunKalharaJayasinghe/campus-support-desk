import mongoose from "mongoose";
import { findDegreeProgram } from "@/models/degree-program-store";
import { findFaculty } from "@/models/faculty-store";
import {
  findIntakeById,
  listIntakes,
  listTermOptions,
  type TermCode,
} from "@/models/intake-store";
import {
  listLabAssistantsInMemory,
  toLabAssistantPersistedRecordFromUnknown,
  type LabAssistantPersistedRecord,
} from "@/models/lab-assistant-store";
import {
  listLecturersInMemory,
  toLecturerPersistedRecordFromUnknown,
  type LecturerPersistedRecord,
} from "@/models/lecturer-store";
import {
  type ModuleOfferingRecord,
  type ModuleOfferingStatus,
  type SyllabusVersion,
} from "@/models/module-offering-store";
import { findModuleByCode, findModuleById } from "@/models/module-store";
import { isStaffEligibleForOffering } from "@/models/staff-eligibility";
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
  facultyCode: string;
  degreeCode: string;
  moduleCode: string;
  moduleId: string;
}

export interface ResolvedOfferingContext extends OfferingScope {
  intakeName: string;
  intakeId: string;
  termCode: TermCode;
  moduleName: string;
  defaultSyllabusVersion: SyllabusVersion;
}

interface IntakeSelection {
  id: string;
  name: string;
  facultyCode: string;
  degreeCode: string;
  termCodes: Set<TermCode>;
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

export function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

export function normalizeIntakeName(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function sanitizeId(value: unknown) {
  return String(value ?? "").trim();
}

function sanitizeAssignmentId(item: unknown) {
  if (typeof item === "string") {
    return sanitizeId(item);
  }

  if (!item || typeof item !== "object") {
    return "";
  }

  const row = item as Record<string, unknown>;
  return sanitizeId(row.id ?? row._id ?? row.lecturerId ?? row.assistantId);
}

export function sanitizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((item) => sanitizeAssignmentId(item)).filter(Boolean)));
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

function normalizeIntakeFromStore(value: unknown): IntakeSelection | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = sanitizeId(row.id ?? row._id);
  const name = normalizeIntakeName(row.name);
  const facultyCode = normalizeAcademicCode(row.facultyCode ?? row.facultyId);
  const degreeCode = normalizeAcademicCode(row.degreeCode ?? row.degreeId);
  if (!id || !name || !facultyCode || !degreeCode) {
    return null;
  }

  const schedules = Array.isArray(row.termSchedules)
    ? row.termSchedules
    : Array.isArray(row.schedules)
      ? row.schedules
      : [];
  const termCodes = new Set<TermCode>();
  schedules.forEach((schedule) => {
    const scheduleRow = asObject(schedule);
    const termCode = parseTermCodeStrict(scheduleRow?.termCode);
    if (termCode) {
      termCodes.add(termCode);
    }
  });

  return {
    id,
    name,
    facultyCode,
    degreeCode,
    termCodes,
  };
}

function resolveIntake(input: {
  intakeId?: unknown;
  intakeName?: unknown;
  facultyCode?: unknown;
  degreeCode?: unknown;
}) {
  const intakeId = sanitizeId(input.intakeId);
  if (intakeId) {
    const intake = findIntakeById(intakeId);
    if (!intake) {
      return null;
    }

    return normalizeIntakeFromStore(intake);
  }

  const intakeName = normalizeIntakeName(input.intakeName);
  const facultyCode = normalizeAcademicCode(input.facultyCode);
  const degreeCode = normalizeAcademicCode(input.degreeCode);
  if (!intakeName || !facultyCode || !degreeCode) {
    return null;
  }

  const candidates = listIntakes({
    faculty: facultyCode,
    degree: degreeCode,
    sort: "updated",
  })
    .map((item) => normalizeIntakeFromStore(item))
    .filter((item): item is IntakeSelection => Boolean(item));

  return (
    candidates.find((item) => item.name.toLowerCase() === intakeName.toLowerCase()) ?? null
  );
}

function resolveModule(input: {
  moduleId?: unknown;
  moduleCode?: unknown;
}) {
  const moduleId = sanitizeId(input.moduleId);
  if (moduleId) {
    return findModuleById(moduleId);
  }

  const moduleCode = normalizeModuleCode(input.moduleCode);
  if (!moduleCode) {
    return null;
  }

  return findModuleByCode(moduleCode);
}

export function normalizeDbOffering(value: unknown): ModuleOfferingRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = sanitizeId(row._id ?? row.id);
  const termCode = parseTermCodeStrict(row.termCode);
  if (!id || !termCode) {
    return null;
  }

  const facultyCode = normalizeAcademicCode(row.facultyCode ?? row.facultyId);
  const degreeCode = normalizeAcademicCode(row.degreeCode ?? row.degreeProgramId);
  const intakeName = normalizeIntakeName(row.intakeName);
  const moduleCode = normalizeModuleCode(row.moduleCode);

  const intake = resolveIntake({
    intakeId: row.intakeId,
    intakeName,
    facultyCode,
    degreeCode,
  });
  const moduleRecord = resolveModule({
    moduleId: row.moduleId,
    moduleCode,
  });

  const resolvedFacultyCode = normalizeAcademicCode(
    facultyCode || intake?.facultyCode
  );
  const resolvedDegreeCode = normalizeAcademicCode(degreeCode || intake?.degreeCode);
  const resolvedIntakeName =
    intakeName || normalizeIntakeName(intake?.name) || sanitizeId(row.intakeId);
  const resolvedIntakeId = sanitizeId(row.intakeId) || intake?.id || "";
  const resolvedModuleCode =
    moduleCode || normalizeModuleCode(moduleRecord?.code) || sanitizeId(row.moduleId).toUpperCase();
  const resolvedModuleId = sanitizeId(row.moduleId) || moduleRecord?.id || "";

  if (!resolvedFacultyCode || !resolvedDegreeCode || !resolvedIntakeName || !resolvedModuleCode) {
    return null;
  }

  const assignedLecturerIds = sanitizeIdList(
    row.assignedLecturerIds ?? row.assignedLecturers
  );
  const assignedLabAssistantIds = sanitizeIdList(
    row.assignedLabAssistantIds ?? row.assignedLabAssistants
  );
  const createdAt = toIsoDate(row.createdAt);
  const updatedAt = toIsoDate(row.updatedAt);
  const now = new Date().toISOString();

  return {
    id,
    facultyCode: resolvedFacultyCode,
    degreeCode: resolvedDegreeCode,
    intakeName: resolvedIntakeName,
    facultyId: resolvedFacultyCode,
    degreeProgramId: resolvedDegreeCode,
    intakeId: resolvedIntakeId || resolvedIntakeName,
    termCode,
    moduleId: resolvedModuleId || resolvedModuleCode,
    moduleCode: resolvedModuleCode,
    moduleName:
      normalizeIntakeName(row.moduleName) ||
      normalizeIntakeName(moduleRecord?.name) ||
      resolvedModuleCode,
    syllabusVersion: sanitizeSyllabusVersion(row.syllabusVersion),
    assignedLecturerIds,
    assignedLabAssistantIds,
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
  facultyCode?: unknown;
  degreeCode?: unknown;
  intakeName?: unknown;
  moduleCode?: unknown;
  facultyId?: unknown;
  degreeProgramId?: unknown;
  intakeId?: unknown;
  moduleId?: unknown;
  termCode: unknown;
}): ResolvedOfferingContext {
  const termCode = parseTermCodeStrict(input.termCode);
  if (!termCode) {
    throw new Error("Select a valid semester / term");
  }

  const facultyCodeInput = normalizeAcademicCode(input.facultyCode ?? input.facultyId);
  const degreeCodeInput = normalizeAcademicCode(input.degreeCode ?? input.degreeProgramId);
  const intake = resolveIntake({
    intakeId: input.intakeId,
    intakeName: input.intakeName,
    facultyCode: facultyCodeInput,
    degreeCode: degreeCodeInput,
  });
  if (!intake) {
    throw new Error("Intake not found");
  }

  const facultyCode = normalizeAcademicCode(facultyCodeInput || intake.facultyCode);
  const degreeCode = normalizeAcademicCode(degreeCodeInput || intake.degreeCode);

  if (!facultyCode) {
    throw new Error("Faculty is required");
  }

  if (!degreeCode) {
    throw new Error("Degree is required");
  }

  if (facultyCode !== intake.facultyCode) {
    throw new Error("Selected intake does not belong to the selected faculty");
  }

  if (degreeCode !== intake.degreeCode) {
    throw new Error("Selected intake does not belong to the selected degree");
  }

  if (intake.termCodes.size > 0 && !intake.termCodes.has(termCode)) {
    throw new Error("Selected term is not configured for this intake");
  }

  const moduleRecord = resolveModule({
    moduleId: input.moduleId,
    moduleCode: input.moduleCode,
  });
  if (!moduleRecord) {
    throw new Error("Module not found");
  }

  if (moduleRecord.facultyCode !== facultyCode) {
    throw new Error("Module does not belong to the selected faculty");
  }

  if (!moduleRecord.applicableDegrees.includes(degreeCode)) {
    throw new Error("Module is not applicable for the selected degree");
  }

  if (!moduleRecord.applicableTerms.includes(termCode)) {
    throw new Error("Module is not applicable for the selected term");
  }

  return {
    facultyCode,
    degreeCode,
    intakeName: intake.name,
    intakeId: intake.id,
    termCode,
    moduleCode: moduleRecord.code,
    moduleId: moduleRecord.id,
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
    facultyCode: scope.facultyCode,
    degreeCode: scope.degreeCode,
    moduleCode: scope.moduleCode,
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
  const facultyCode = normalizeAcademicCode(offering.facultyCode ?? offering.facultyId);
  const degreeCode = normalizeAcademicCode(offering.degreeCode ?? offering.degreeProgramId);
  const intake = findIntakeById(offering.intakeId);
  const moduleRecord = findModuleById(offering.moduleId) ?? findModuleByCode(offering.moduleCode);
  const faculty = findFaculty(facultyCode);
  const degree = findDegreeProgram(degreeCode);

  const intakeName =
    normalizeIntakeName(offering.intakeName) || normalizeIntakeName(intake?.name) || offering.intakeId;
  const moduleCode =
    normalizeModuleCode(offering.moduleCode) || normalizeModuleCode(moduleRecord?.code) || offering.moduleId;
  const moduleName =
    normalizeIntakeName(offering.moduleName) || normalizeIntakeName(moduleRecord?.name) || moduleCode;

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
    facultyCode,
    degreeCode,
    intakeName,
    termCode: offering.termCode,
    moduleCode,
    moduleName,
    syllabusVersion: offering.syllabusVersion,
    status: offering.status,
    assignedLecturerIds: offering.assignedLecturerIds,
    assignedLabAssistantIds: offering.assignedLabAssistantIds,
    assignedLecturers: lecturers.map((item) => ({
      lecturerId: item.id,
      name: item.fullName,
      email: item.email,
    })),
    assignedLabAssistants: labAssistants.map((item) => ({
      assistantId: item.id,
      name: item.fullName,
      email: item.email,
    })),
    lecturers,
    labAssistants,
    lecturerCount: lecturers.length,
    labAssistantCount: labAssistants.length,
    // Legacy aliases for existing clients.
    facultyId: facultyCode,
    degreeProgramId: degreeCode,
    intakeId: offering.intakeId,
    moduleId: offering.moduleId,
    module: {
      _id: offering.moduleId,
      id: offering.moduleId,
      code: moduleCode,
      name: moduleName,
    },
    faculty: {
      _id: facultyCode,
      id: facultyCode,
      code: facultyCode,
      name: faculty?.name ?? "",
    },
    degree: {
      _id: degreeCode,
      id: degreeCode,
      code: degreeCode,
      name: degree?.name ?? "",
    },
    intake: {
      _id: offering.intakeId,
      id: offering.intakeId,
      name: intakeName,
      currentTerm: intake?.currentTerm ?? "",
    },
    createdAt: offering.createdAt,
    updatedAt: offering.updatedAt,
  };
}

