import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/Lecturer";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/lib/mongoose";
import {
  normalizeDbOffering,
  resolveAssigneeMaps,
  resolveOfferingContext,
  sanitizeId,
  sanitizeIdList,
  sanitizeOfferingStatus,
  sanitizeSyllabusVersion,
  toApiOfferingItem,
  validateLabAssistantAssignments,
  validateLecturerAssignments,
} from "@/lib/module-offering-api";
import {
  deleteModuleOffering,
  findModuleOfferingById,
  hasModuleOfferingProgress,
  listModuleOfferings,
  updateModuleOffering,
  type ModuleOfferingStatus,
  type SyllabusVersion,
} from "@/lib/module-offering-store";
import { isMongoDuplicateKeyError } from "@/lib/student-registration";
import { ModuleOfferingModel } from "@/models/ModuleOffering";

function isDuplicateMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /already assigned/i.test(error.message);
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const offeringId = sanitizeId(params.id);
  if (!offeringId) {
    return NextResponse.json({ message: "Module offering id is required" }, { status: 400 });
  }

  if (mongooseConnection && mongoose.Types.ObjectId.isValid(offeringId)) {
    const dbRow = await ModuleOfferingModel.findById(offeringId)
      .lean()
      .exec()
      .catch(() => null);
    const normalized = normalizeDbOffering(dbRow);

    if (normalized && !normalized.isDeleted) {
      const assignees = await resolveAssigneeMaps(
        {
          lecturerIds: normalized.assignedLecturerIds,
          labAssistantIds: normalized.assignedLabAssistantIds,
        },
        mongooseConnection
      );

      return NextResponse.json(toApiOfferingItem(normalized, assignees));
    }
  }

  const offering = findModuleOfferingById(offeringId);
  if (!offering || offering.isDeleted) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  const assignees = await resolveAssigneeMaps(
    {
      lecturerIds: offering.assignedLecturerIds,
      labAssistantIds: offering.assignedLabAssistantIds,
    },
    null
  );

  return NextResponse.json(toApiOfferingItem(offering, assignees));
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const offeringId = sanitizeId(params.id);
    if (!offeringId) {
      return NextResponse.json({ message: "Module offering id is required" }, { status: 400 });
    }

    const body = (await request.json()) as Partial<{
      facultyId: string;
      degreeProgramId: string;
      intakeId: string;
      termCode: string;
      moduleId: string;
      syllabusVersion: SyllabusVersion;
      status: ModuleOfferingStatus;
      assignedLecturerIds: string[];
      assignedLabAssistantIds: string[];
      assignedLecturers: string[];
    }>;

    const hasLecturerPayload =
      body.assignedLecturerIds !== undefined || body.assignedLecturers !== undefined;
    const hasLabPayload = body.assignedLabAssistantIds !== undefined;
    const mongooseConnection = await connectMongoose().catch(() => null);

    if (mongooseConnection && mongoose.Types.ObjectId.isValid(offeringId)) {
      const row = await ModuleOfferingModel.findById(offeringId).exec();
      if (!row) {
        return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
      }

      const existingLecturerIds = sanitizeIdList(
        row.assignedLecturerIds ?? row.assignedLecturers
      );
      const existingLabAssistantIds = sanitizeIdList(row.assignedLabAssistantIds);

      const context = resolveOfferingContext({
        facultyId: body.facultyId ?? row.facultyId,
        degreeProgramId: body.degreeProgramId ?? row.degreeProgramId,
        intakeId: body.intakeId ?? row.intakeId,
        termCode: body.termCode ?? row.termCode,
        moduleId: body.moduleId ?? row.moduleId,
      });

      const nextSyllabusVersion =
        body.syllabusVersion === undefined
          ? sanitizeSyllabusVersion(row.syllabusVersion)
          : sanitizeSyllabusVersion(body.syllabusVersion);
      const nextStatus =
        body.status === undefined
          ? sanitizeOfferingStatus(row.status)
          : sanitizeOfferingStatus(body.status);
      const nextLecturerIds = hasLecturerPayload
        ? sanitizeIdList(body.assignedLecturerIds ?? body.assignedLecturers)
        : existingLecturerIds;
      const nextLabAssistantIds = hasLabPayload
        ? sanitizeIdList(body.assignedLabAssistantIds)
        : existingLabAssistantIds;

      await validateLecturerAssignments({
        ids: nextLecturerIds,
        scope: {
          facultyId: context.facultyId,
          degreeProgramId: context.degreeProgramId,
          moduleId: context.moduleId,
        },
        mongooseConnection,
      });
      await validateLabAssistantAssignments({
        ids: nextLabAssistantIds,
        scope: {
          facultyId: context.facultyId,
          degreeProgramId: context.degreeProgramId,
          moduleId: context.moduleId,
        },
        mongooseConnection,
      });

      const duplicate = await ModuleOfferingModel.exists({
        _id: { $ne: row._id },
        intakeId: context.intakeId,
        termCode: context.termCode,
        moduleId: context.moduleId,
      }).catch(() => null);

      if (duplicate) {
        return NextResponse.json(
          { message: "Module is already assigned for this intake term" },
          { status: 409 }
        );
      }

      row.facultyId = context.facultyId;
      row.degreeProgramId = context.degreeProgramId;
      row.intakeId = context.intakeId;
      row.termCode = context.termCode;
      row.moduleId = context.moduleId;
      row.syllabusVersion = nextSyllabusVersion;
      row.status = nextStatus;
      row.assignedLecturerIds = nextLecturerIds;
      row.assignedLecturers = nextLecturerIds;
      row.assignedLabAssistantIds = nextLabAssistantIds;

      try {
        await row.save();
      } catch (error) {
        if (isMongoDuplicateKeyError(error)) {
          return NextResponse.json(
            { message: "Module is already assigned for this intake term" },
            { status: 409 }
          );
        }

        throw error;
      }

      const normalized = normalizeDbOffering(row.toObject());
      if (!normalized) {
        return NextResponse.json(
          { message: "Failed to map module offering" },
          { status: 500 }
        );
      }

      const assignees = await resolveAssigneeMaps(
        {
          lecturerIds: normalized.assignedLecturerIds,
          labAssistantIds: normalized.assignedLabAssistantIds,
        },
        mongooseConnection
      );

      return NextResponse.json(toApiOfferingItem(normalized, assignees));
    }

    const existing = findModuleOfferingById(offeringId);
    if (!existing) {
      return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
    }

    const context = resolveOfferingContext({
      facultyId: body.facultyId ?? existing.facultyId,
      degreeProgramId: body.degreeProgramId ?? existing.degreeProgramId,
      intakeId: body.intakeId ?? existing.intakeId,
      termCode: body.termCode ?? existing.termCode,
      moduleId: body.moduleId ?? existing.moduleId,
    });

    const nextSyllabusVersion =
      body.syllabusVersion === undefined
        ? existing.syllabusVersion
        : sanitizeSyllabusVersion(body.syllabusVersion);
    const nextStatus =
      body.status === undefined
        ? existing.status
        : sanitizeOfferingStatus(body.status);
    const nextLecturerIds = hasLecturerPayload
      ? sanitizeIdList(body.assignedLecturerIds ?? body.assignedLecturers)
      : sanitizeIdList(existing.assignedLecturerIds ?? existing.assignedLecturers);
    const nextLabAssistantIds = hasLabPayload
      ? sanitizeIdList(body.assignedLabAssistantIds)
      : sanitizeIdList(existing.assignedLabAssistantIds);

    await validateLecturerAssignments({
      ids: nextLecturerIds,
      scope: {
        facultyId: context.facultyId,
        degreeProgramId: context.degreeProgramId,
        moduleId: context.moduleId,
      },
      mongooseConnection: null,
    });
    await validateLabAssistantAssignments({
      ids: nextLabAssistantIds,
      scope: {
        facultyId: context.facultyId,
        degreeProgramId: context.degreeProgramId,
        moduleId: context.moduleId,
      },
      mongooseConnection: null,
    });

    const duplicateInStore = listModuleOfferings({
      intakeId: context.intakeId,
      termCode: context.termCode,
      moduleId: context.moduleId,
    }).some((offering) => offering.id !== offeringId && !offering.isDeleted);

    if (duplicateInStore) {
      return NextResponse.json(
        { message: "Module is already assigned for this intake term" },
        { status: 409 }
      );
    }

    const updated = updateModuleOffering(offeringId, {
      facultyId: context.facultyId,
      degreeProgramId: context.degreeProgramId,
      intakeId: context.intakeId,
      termCode: context.termCode,
      moduleId: context.moduleId,
      syllabusVersion: nextSyllabusVersion,
      status: nextStatus,
      assignedLecturerIds: hasLecturerPayload ? nextLecturerIds : undefined,
      assignedLabAssistantIds: hasLabPayload ? nextLabAssistantIds : undefined,
    });
    if (!updated) {
      return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
    }

    const assignees = await resolveAssigneeMaps(
      {
        lecturerIds: updated.assignedLecturerIds,
        labAssistantIds: updated.assignedLabAssistantIds,
      },
      null
    );

    return NextResponse.json(toApiOfferingItem(updated, assignees));
  } catch (error) {
    if (isDuplicateMessage(error)) {
      return NextResponse.json(
        { message: "Module is already assigned for this intake term" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update module offering",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const offeringId = sanitizeId(params.id);

  if (!offeringId) {
    return NextResponse.json({ message: "Module offering id is required" }, { status: 400 });
  }

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
