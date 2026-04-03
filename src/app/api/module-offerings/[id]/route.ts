import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/Lecturer";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import {
  mergeSanitizedIdLists,
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
} from "@/models/module-offering-api";
import {
  deleteModuleOffering,
  findModuleOfferingById,
  hasModuleOfferingProgress,
  listModuleOfferings,
  updateModuleOffering,
  type ModuleOfferingStatus,
  type SyllabusVersion,
} from "@/models/module-offering-store";
import { isMongoDuplicateKeyError } from "@/models/student-registration";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { syncLecturerModuleLinksForOfferingMutation } from "@/models/module-offering-lecturer-module-sync";
import { syncLabAssistantModuleLinksForOfferingMutation } from "@/models/module-offering-lab-assistant-module-sync";

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
      facultyCode: string;
      degreeCode: string;
      intakeName: string;
      moduleCode: string;
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
    const mongooseConnection = await connectMongoose({
      forceAcademicCacheSync: true,
    }).catch(() => null);

    if (mongooseConnection && mongoose.Types.ObjectId.isValid(offeringId)) {
      const row = await ModuleOfferingModel.findById(offeringId).exec();
      if (!row) {
        return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
      }

      const existingLecturerIds = mergeSanitizedIdLists(
        row.assignedLecturerIds,
        row.assignedLecturers
      );
      const existingLabAssistantIds = mergeSanitizedIdLists(
        row.assignedLabAssistantIds,
        row.assignedLabAssistants
      );
      const previousLecturerSyncState = {
        offeringId,
        moduleCode: String(row.moduleCode ?? row.moduleId ?? "").trim(),
        moduleId: String(row.moduleId ?? "").trim(),
        lecturerIds: existingLecturerIds,
      };
      const previousLabAssistantSyncState = {
        offeringId,
        moduleCode: String(row.moduleCode ?? row.moduleId ?? "").trim(),
        moduleId: String(row.moduleId ?? "").trim(),
        labAssistantIds: existingLabAssistantIds,
      };

      const context = resolveOfferingContext({
        facultyCode: body.facultyCode ?? row.facultyCode ?? row.facultyId,
        degreeCode: body.degreeCode ?? row.degreeCode ?? row.degreeProgramId,
        intakeName: body.intakeName ?? row.intakeName,
        moduleCode: body.moduleCode ?? row.moduleCode,
        facultyId: body.facultyId ?? row.facultyId ?? row.facultyCode,
        degreeProgramId:
          body.degreeProgramId ?? row.degreeProgramId ?? row.degreeCode,
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
        ? mergeSanitizedIdLists(
            body.assignedLecturerIds,
            body.assignedLecturers
          )
        : existingLecturerIds;
      const nextLabAssistantIds = hasLabPayload
        ? sanitizeIdList(body.assignedLabAssistantIds)
        : existingLabAssistantIds;

      await validateLecturerAssignments({
        ids: nextLecturerIds,
        scope: {
          facultyCode: context.facultyCode,
          degreeCode: context.degreeCode,
          moduleCode: context.moduleCode,
          moduleId: context.moduleId,
        },
        mongooseConnection,
      });
      await validateLabAssistantAssignments({
        ids: nextLabAssistantIds,
        scope: {
          facultyCode: context.facultyCode,
          degreeCode: context.degreeCode,
          moduleCode: context.moduleCode,
          moduleId: context.moduleId,
        },
        mongooseConnection,
      });

      const assignees = await resolveAssigneeMaps(
        {
          lecturerIds: nextLecturerIds,
          labAssistantIds: nextLabAssistantIds,
        },
        mongooseConnection
      );
      const lecturerSnapshots = nextLecturerIds.map((id) => {
        const rowItem = assignees.lecturerMap.get(id);
        return {
          lecturerId: id,
          name: rowItem?.fullName ?? "",
          email: rowItem?.email ?? "",
        };
      });
      const labAssistantSnapshots = nextLabAssistantIds.map((id) => {
        const rowItem = assignees.labAssistantMap.get(id);
        return {
          assistantId: id,
          name: rowItem?.fullName ?? "",
          email: rowItem?.email ?? "",
        };
      });

      const duplicate = await ModuleOfferingModel.exists({
        _id: { $ne: row._id },
        termCode: context.termCode,
        $or: [
          {
            intakeName: context.intakeName,
            moduleCode: context.moduleCode,
          },
          {
            intakeId: context.intakeId,
            moduleId: context.moduleId,
          },
        ],
      }).catch(() => null);

      if (duplicate) {
        return NextResponse.json(
          { message: "Module is already assigned for this intake term" },
          { status: 409 }
        );
      }

      row.facultyCode = context.facultyCode;
      row.degreeCode = context.degreeCode;
      row.intakeName = context.intakeName;
      row.moduleCode = context.moduleCode;
      row.moduleName = context.moduleName;
      row.facultyId = context.facultyCode;
      row.degreeProgramId = context.degreeCode;
      row.intakeId = context.intakeId;
      row.termCode = context.termCode;
      row.moduleId = context.moduleId;
      row.syllabusVersion = nextSyllabusVersion;
      row.status = nextStatus;
      row.assignedLecturerIds = nextLecturerIds;
      row.assignedLecturers = lecturerSnapshots;
      row.assignedLabAssistantIds = nextLabAssistantIds;
      row.assignedLabAssistants = labAssistantSnapshots;

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

      await syncLecturerModuleLinksForOfferingMutation({
        previous: previousLecturerSyncState,
        next: {
          offeringId: normalized.id,
          moduleCode: normalized.moduleCode,
          moduleId: normalized.moduleId,
          lecturerIds: normalized.assignedLecturerIds,
        },
        mongooseConnection,
      }).catch(() => null);

      await syncLabAssistantModuleLinksForOfferingMutation({
        previous: previousLabAssistantSyncState,
        next: {
          offeringId: normalized.id,
          moduleCode: normalized.moduleCode,
          moduleId: normalized.moduleId,
          labAssistantIds: normalized.assignedLabAssistantIds,
        },
        mongooseConnection,
      }).catch(() => null);

      return NextResponse.json(toApiOfferingItem(normalized, assignees));
    }

    const existing = findModuleOfferingById(offeringId);
    if (!existing) {
      return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
    }

    const previousLecturerSyncState = {
      offeringId: existing.id,
      moduleCode: existing.moduleCode,
      moduleId: existing.moduleId,
      lecturerIds: mergeSanitizedIdLists(
        existing.assignedLecturerIds,
        existing.assignedLecturers
      ),
    };
    const previousLabAssistantSyncState = {
      offeringId: existing.id,
      moduleCode: existing.moduleCode,
      moduleId: existing.moduleId,
      labAssistantIds: existing.assignedLabAssistantIds,
    };

    const context = resolveOfferingContext({
      facultyCode: body.facultyCode ?? existing.facultyCode ?? existing.facultyId,
      degreeCode: body.degreeCode ?? existing.degreeCode ?? existing.degreeProgramId,
      intakeName: body.intakeName ?? existing.intakeName,
      moduleCode: body.moduleCode ?? existing.moduleCode,
      facultyId: body.facultyId ?? existing.facultyId ?? existing.facultyCode,
      degreeProgramId:
        body.degreeProgramId ?? existing.degreeProgramId ?? existing.degreeCode,
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
      ? mergeSanitizedIdLists(
          body.assignedLecturerIds,
          body.assignedLecturers
        )
      : mergeSanitizedIdLists(
          existing.assignedLecturerIds,
          existing.assignedLecturers
        );
    const nextLabAssistantIds = hasLabPayload
      ? sanitizeIdList(body.assignedLabAssistantIds)
      : sanitizeIdList(existing.assignedLabAssistantIds);

    await validateLecturerAssignments({
      ids: nextLecturerIds,
      scope: {
        facultyCode: context.facultyCode,
        degreeCode: context.degreeCode,
        moduleCode: context.moduleCode,
        moduleId: context.moduleId,
      },
      mongooseConnection: null,
    });
    await validateLabAssistantAssignments({
      ids: nextLabAssistantIds,
      scope: {
        facultyCode: context.facultyCode,
        degreeCode: context.degreeCode,
        moduleCode: context.moduleCode,
        moduleId: context.moduleId,
      },
      mongooseConnection: null,
    });

    const duplicateInStore = listModuleOfferings({
      intakeName: context.intakeName,
      termCode: context.termCode,
      moduleCode: context.moduleCode,
    }).some((offering) => offering.id !== offeringId && !offering.isDeleted);

    if (duplicateInStore) {
      return NextResponse.json(
        { message: "Module is already assigned for this intake term" },
        { status: 409 }
      );
    }

    const updated = updateModuleOffering(offeringId, {
      facultyCode: context.facultyCode,
      degreeCode: context.degreeCode,
      intakeName: context.intakeName,
      moduleCode: context.moduleCode,
      facultyId: context.facultyCode,
      degreeProgramId: context.degreeCode,
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

    await syncLecturerModuleLinksForOfferingMutation({
      previous: previousLecturerSyncState,
      next: {
        offeringId: updated.id,
        moduleCode: updated.moduleCode,
        moduleId: updated.moduleId,
        lecturerIds: updated.assignedLecturerIds,
      },
      mongooseConnection: null,
    }).catch(() => null);

    await syncLabAssistantModuleLinksForOfferingMutation({
      previous: previousLabAssistantSyncState,
      next: {
        offeringId: updated.id,
        moduleCode: updated.moduleCode,
        moduleId: updated.moduleId,
        labAssistantIds: updated.assignedLabAssistantIds,
      },
      mongooseConnection: null,
    }).catch(() => null);

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
      .select(
        "_id moduleCode moduleId assignedLecturerIds assignedLecturers assignedLabAssistantIds assignedLabAssistants hasGrades hasAttendance hasContent"
      )
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

      const previousLecturerSyncState = {
        offeringId,
        moduleCode: String(dbOffering.moduleCode ?? dbOffering.moduleId ?? "").trim(),
        moduleId: String(dbOffering.moduleId ?? "").trim(),
        lecturerIds: mergeSanitizedIdLists(
          dbOffering.assignedLecturerIds,
          dbOffering.assignedLecturers
        ),
      };
      const previousLabAssistantSyncState = {
        offeringId,
        moduleCode: String(dbOffering.moduleCode ?? dbOffering.moduleId ?? "").trim(),
        moduleId: String(dbOffering.moduleId ?? "").trim(),
        labAssistantIds: mergeSanitizedIdLists(
          dbOffering.assignedLabAssistantIds,
          dbOffering.assignedLabAssistants
        ),
      };

      await ModuleOfferingModel.deleteOne({ _id: offeringId }).catch(() => null);
      deleteModuleOffering(offeringId);

      await syncLecturerModuleLinksForOfferingMutation({
        previous: previousLecturerSyncState,
        next: null,
        mongooseConnection,
      }).catch(() => null);

      await syncLabAssistantModuleLinksForOfferingMutation({
        previous: previousLabAssistantSyncState,
        next: null,
        mongooseConnection,
      }).catch(() => null);

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

  const previousLecturerSyncState = {
    offeringId: offering.id,
    moduleCode: offering.moduleCode,
    moduleId: offering.moduleId,
    lecturerIds: offering.assignedLecturerIds,
  };
  const previousLabAssistantSyncState = {
    offeringId: offering.id,
    moduleCode: offering.moduleCode,
    moduleId: offering.moduleId,
    labAssistantIds: offering.assignedLabAssistantIds,
  };

  const deleted = deleteModuleOffering(offeringId);
  if (!deleted) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  await syncLecturerModuleLinksForOfferingMutation({
    previous: previousLecturerSyncState,
    next: null,
    mongooseConnection: null,
  }).catch(() => null);

  await syncLabAssistantModuleLinksForOfferingMutation({
    previous: previousLabAssistantSyncState,
    next: null,
    mongooseConnection: null,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
