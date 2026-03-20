import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/Lecturer";
import "@/models/ModuleOffering";
import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import { findIntakeById, sanitizeTermCode } from "@/lib/intake-store";
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
import { connectMongoose } from "@/lib/mongoose";
import {
  deleteModuleOffering,
  findModuleOfferingById,
  hasModuleOfferingProgress,
  updateModuleOffering,
  type ModuleOfferingRecord,
  type ModuleOfferingStatus,
  type SyllabusVersion,
} from "@/lib/module-offering-store";
import { findModuleById } from "@/lib/module-store";
import { isStaffEligibleForOffering } from "@/lib/staff-eligibility";
import { LabAssistantModel } from "@/models/LabAssistant";
import { LecturerModel } from "@/models/Lecturer";
import { ModuleOfferingModel } from "@/models/ModuleOffering";

interface AssigneeDisplayItem {
  id: string;
  fullName: string;
  email: string;
  status: string;
}

interface OfferingScope {
  facultyId: string;
  degreeProgramId: string;
  moduleId: string;
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function sanitizeSyllabus(value: unknown): SyllabusVersion {
  return value === "OLD" ? "OLD" : "NEW";
}

function sanitizeStatus(value: unknown): ModuleOfferingStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function sanitizeIdList(value: unknown) {
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

function toIsoDate(value: unknown) {
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeDbOffering(value: unknown): ModuleOfferingRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  const intakeId = String(row.intakeId ?? "").trim();
  const moduleId = String(row.moduleId ?? "").trim();
  if (!id || !intakeId || !moduleId) {
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
    degreeProgramId: normalizeAcademicCode(
      row.degreeProgramId ?? intake?.degreeCode
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
    syllabusVersion: sanitizeSyllabus(row.syllabusVersion),
    assignedLecturerIds,
    assignedLabAssistantIds: sanitizeIdList(row.assignedLabAssistantIds),
    status: sanitizeStatus(row.status),
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

function toApiItem(
  offering: ModuleOfferingRecord,
  assignees: {
    lecturerMap: Map<string, AssigneeDisplayItem>;
    labAssistantMap: Map<string, AssigneeDisplayItem>;
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
      id: offering.moduleId,
      code: offering.moduleCode || moduleRecord?.code || "",
      name: offering.moduleName || moduleRecord?.name || "",
    },
    faculty: {
      code: offering.facultyId,
      name: faculty?.name ?? "",
    },
    degree: {
      code: offering.degreeProgramId,
      name: degree?.name ?? "",
    },
    intake: {
      id: offering.intakeId,
      name: intake?.name ?? "",
      currentTerm: intake?.currentTerm ?? "",
    },
    createdAt: offering.createdAt,
    updatedAt: offering.updatedAt,
  };
}

async function loadLecturersByIds(
  ids: string[],
  mongooseConnection: typeof mongoose | null
) {
  const map = new Map<string, LecturerPersistedRecord>();
  listLecturersInMemory().forEach((row) => {
    map.set(row.id, row);
  });

  if (mongooseConnection) {
    const objectIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (objectIds.length > 0) {
      const rows = (await LecturerModel.find({
        _id: { $in: objectIds },
      })
        .lean()
        .exec()
        .catch(() => [])) as unknown[];

      rows
        .map((row) => toLecturerPersistedRecordFromUnknown(row))
        .filter((row): row is LecturerPersistedRecord => Boolean(row))
        .forEach((row) => {
          map.set(row.id, row);
        });
    }
  }

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

  if (mongooseConnection) {
    const objectIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (objectIds.length > 0) {
      const rows = (await LabAssistantModel.find({
        _id: { $in: objectIds },
      })
        .lean()
        .exec()
        .catch(() => [])) as unknown[];

      rows
        .map((row) => toLabAssistantPersistedRecordFromUnknown(row))
        .filter((row): row is LabAssistantPersistedRecord => Boolean(row))
        .forEach((row) => {
          map.set(row.id, row);
        });
    }
  }

  return map;
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

async function validateLecturerAssignments(
  input: {
    ids: string[];
    scope: OfferingScope;
    mongooseConnection: typeof mongoose | null;
  }
) {
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

async function validateLabAssistantAssignments(
  input: {
    ids: string[];
    scope: OfferingScope;
    mongooseConnection: typeof mongoose | null;
  }
) {
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

async function resolveDisplayAssignees(
  offering: Pick<ModuleOfferingRecord, "assignedLecturerIds" | "assignedLabAssistantIds">,
  mongooseConnection: typeof mongoose | null
) {
  const lecturers = await loadLecturersByIds(
    offering.assignedLecturerIds,
    mongooseConnection
  );
  const labAssistants = await loadLabAssistantsByIds(
    offering.assignedLabAssistantIds,
    mongooseConnection
  );

  const lecturerMap = new Map<string, AssigneeDisplayItem>();
  lecturers.forEach((row) => {
    lecturerMap.set(row.id, {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      status: row.status,
    });
  });

  const labAssistantMap = new Map<string, AssigneeDisplayItem>();
  labAssistants.forEach((row) => {
    labAssistantMap.set(row.id, {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      status: row.status,
    });
  });

  return { lecturerMap, labAssistantMap };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const offeringId = String(params.id ?? "").trim();
  if (!offeringId) {
    return NextResponse.json({ message: "Module offering id is required" }, { status: 400 });
  }

  let offering: ModuleOfferingRecord | null = null;

  if (mongooseConnection && mongoose.Types.ObjectId.isValid(offeringId)) {
    const dbRow = await ModuleOfferingModel.findById(offeringId)
      .lean()
      .exec()
      .catch(() => null);
    offering = normalizeDbOffering(dbRow);
  }

  if (!offering) {
    offering = findModuleOfferingById(offeringId);
  }

  if (!offering || offering.isDeleted) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  const assignees = await resolveDisplayAssignees(offering, mongooseConnection);
  return NextResponse.json(toApiItem(offering, assignees));
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const offeringId = String(params.id ?? "").trim();
    if (!offeringId) {
      return NextResponse.json({ message: "Module offering id is required" }, { status: 400 });
    }

    const body = (await request.json()) as Partial<{
      syllabusVersion: SyllabusVersion;
      status: ModuleOfferingStatus;
      assignedLecturerIds: string[];
      assignedLabAssistantIds: string[];
      assignedLecturers: string[];
    }>;
    const nextSyllabusVersion =
      body.syllabusVersion === undefined ? undefined : sanitizeSyllabus(body.syllabusVersion);
    const nextStatus = body.status === undefined ? undefined : sanitizeStatus(body.status);
    const hasLecturerPayload =
      body.assignedLecturerIds !== undefined || body.assignedLecturers !== undefined;
    const hasLabPayload = body.assignedLabAssistantIds !== undefined;

    const mongooseConnection = await connectMongoose().catch(() => null);

    if (mongooseConnection && mongoose.Types.ObjectId.isValid(offeringId)) {
      const row = await ModuleOfferingModel.findById(offeringId).exec();
      if (!row) {
        return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
      }

      const intake = findIntakeById(String(row.intakeId));
      const nextLecturerIds = hasLecturerPayload
        ? sanitizeIdList(body.assignedLecturerIds ?? body.assignedLecturers)
        : sanitizeIdList(row.assignedLecturerIds ?? row.assignedLecturers);
      const nextLabAssistantIds = hasLabPayload
        ? sanitizeIdList(body.assignedLabAssistantIds)
        : sanitizeIdList(row.assignedLabAssistantIds);
      const scope: OfferingScope = {
        facultyId: normalizeAcademicCode(row.facultyId ?? intake?.facultyCode),
        degreeProgramId: normalizeAcademicCode(
          row.degreeProgramId ?? intake?.degreeCode
        ),
        moduleId: String(row.moduleId ?? "").trim(),
      };

      try {
        await validateLecturerAssignments({
          ids: nextLecturerIds,
          scope,
          mongooseConnection,
        });
        await validateLabAssistantAssignments({
          ids: nextLabAssistantIds,
          scope,
          mongooseConnection,
        });
      } catch (error) {
        return NextResponse.json(
          {
            message:
              error instanceof Error
                ? error.message
                : "Invalid staff assignment",
          },
          { status: 400 }
        );
      }

      if (nextSyllabusVersion) {
        row.syllabusVersion = nextSyllabusVersion;
      }
      if (nextStatus) {
        row.status = nextStatus;
      }
      row.assignedLecturerIds = nextLecturerIds;
      row.assignedLecturers = nextLecturerIds;
      row.assignedLabAssistantIds = nextLabAssistantIds;
      await row.save();

      const normalized = normalizeDbOffering(row.toObject());
      if (!normalized) {
        return NextResponse.json(
          { message: "Failed to map module offering" },
          { status: 500 }
        );
      }

      const assignees = await resolveDisplayAssignees(normalized, mongooseConnection);
      return NextResponse.json(toApiItem(normalized, assignees));
    }

    const existing = findModuleOfferingById(offeringId);
    if (!existing) {
      return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
    }
    const nextLecturerIds = hasLecturerPayload
      ? sanitizeIdList(body.assignedLecturerIds ?? body.assignedLecturers)
      : existing.assignedLecturerIds;
    const nextLabAssistantIds = hasLabPayload
      ? sanitizeIdList(body.assignedLabAssistantIds)
      : existing.assignedLabAssistantIds;

    try {
      await validateLecturerAssignments({
        ids: nextLecturerIds,
        scope: {
          facultyId: existing.facultyId,
          degreeProgramId: existing.degreeProgramId,
          moduleId: existing.moduleId,
        },
        mongooseConnection: null,
      });
      await validateLabAssistantAssignments({
        ids: nextLabAssistantIds,
        scope: {
          facultyId: existing.facultyId,
          degreeProgramId: existing.degreeProgramId,
          moduleId: existing.moduleId,
        },
        mongooseConnection: null,
      });
    } catch (error) {
      return NextResponse.json(
        {
          message:
            error instanceof Error ? error.message : "Invalid staff assignment",
        },
        { status: 400 }
      );
    }

    const updated = updateModuleOffering(offeringId, {
      syllabusVersion: nextSyllabusVersion,
      status: nextStatus,
      assignedLecturerIds: hasLecturerPayload ? nextLecturerIds : undefined,
      assignedLabAssistantIds: hasLabPayload ? nextLabAssistantIds : undefined,
    });
    if (!updated) {
      return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
    }

    const assignees = await resolveDisplayAssignees(updated, null);
    return NextResponse.json(toApiItem(updated, assignees));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to update module offering",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const offeringId = String(params.id ?? "").trim();

  if (mongooseConnection && mongoose.Types.ObjectId.isValid(offeringId)) {
    const dbOffering = (await ModuleOfferingModel.findById(offeringId)
      .select("_id hasGrades hasAttendance hasContent")
      .lean()
      .exec()
      .catch(() => null)) as Record<string, unknown> | null;

    if (dbOffering) {
      if (
        hasModuleOfferingProgress({
          hasGrades: dbOffering.hasGrades === true,
          hasAttendance: dbOffering.hasAttendance === true,
          hasContent: dbOffering.hasContent === true,
        })
      ) {
        return NextResponse.json(
          { message: "Offering has grades, attendance, or content data" },
          { status: 409 }
        );
      }

      await ModuleOfferingModel.deleteOne({ _id: offeringId }).catch(() => null);
      return NextResponse.json({ ok: true });
    }
  }

  const offering = findModuleOfferingById(offeringId);
  if (!offering) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  if (hasModuleOfferingProgress(offering)) {
    return NextResponse.json(
      { message: "Offering has grades, attendance, or content data" },
      { status: 409 }
    );
  }

  const deleted = deleteModuleOffering(offeringId);
  if (!deleted) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
