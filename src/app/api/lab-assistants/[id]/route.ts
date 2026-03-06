import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/ModuleOffering";
import "@/models/User";
import { connectMongoose } from "@/lib/mongoose";
import {
  deleteLabAssistantInMemory,
  findLabAssistantInMemoryById,
  sanitizeAcademicCodeList,
  sanitizeLabAssistantName,
  sanitizeLabAssistantNicStaffId,
  sanitizeLabAssistantPhone,
  sanitizeLabAssistantStatus,
  sanitizeModuleIdList,
  toLabAssistantPersistedRecordFromUnknown,
  updateLabAssistantInMemory,
  validateLabAssistantEligibility,
  type LabAssistantPersistedRecord,
  type LabAssistantStatus,
} from "@/lib/lab-assistant-store";
import { listModuleOfferingsByLabAssistantId } from "@/lib/module-offering-store";
import { getMongoDuplicateField } from "@/lib/student-registration";
import { LabAssistantModel } from "@/models/LabAssistant";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { UserModel } from "@/models/User";

interface LabAssistantWriteInput {
  fullName: string;
  phone: string;
  nicStaffId: string | null;
  status: LabAssistantStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
}

function toWriteInput(body: Partial<Record<string, unknown>>): LabAssistantWriteInput | null {
  const fullName = sanitizeLabAssistantName(body.fullName);
  if (!fullName) {
    return null;
  }

  return {
    fullName,
    phone: sanitizeLabAssistantPhone(body.phone),
    nicStaffId: sanitizeLabAssistantNicStaffId(body.nicStaffId),
    status: sanitizeLabAssistantStatus(body.status),
    facultyIds: sanitizeAcademicCodeList(body.facultyIds),
    degreeProgramIds: sanitizeAcademicCodeList(body.degreeProgramIds),
    moduleIds: sanitizeModuleIdList(body.moduleIds),
  };
}

function toApiLabAssistant(row: LabAssistantPersistedRecord) {
  return {
    ...row,
    eligibilityCounts: {
      faculties: row.facultyIds.length,
      degrees: row.degreeProgramIds.length,
      modules: row.moduleIds.length,
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const labAssistantId = String(params.id ?? "").trim();
  if (!labAssistantId) {
    return NextResponse.json({ message: "Lab assistant id is required" }, { status: 400 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    const row = findLabAssistantInMemoryById(labAssistantId);
    if (!row) {
      return NextResponse.json({ message: "Lab assistant not found" }, { status: 404 });
    }

    return NextResponse.json(toApiLabAssistant(row));
  }

  const row = await LabAssistantModel.findById(labAssistantId).lean().exec().catch(() => null);
  if (!row) {
    return NextResponse.json({ message: "Lab assistant not found" }, { status: 404 });
  }

  const parsed = toLabAssistantPersistedRecordFromUnknown(row);
  if (!parsed) {
    return NextResponse.json({ message: "Failed to map lab assistant" }, { status: 500 });
  }

  return NextResponse.json(toApiLabAssistant(parsed));
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const labAssistantId = String(params.id ?? "").trim();
    if (!labAssistantId) {
      return NextResponse.json({ message: "Lab assistant id is required" }, { status: 400 });
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};
    const input = toWriteInput(body);

    if (!input) {
      return NextResponse.json(
        { message: "Full name is required" },
        { status: 400 }
      );
    }

    let validated: {
      facultyIds: string[];
      degreeProgramIds: string[];
      moduleIds: string[];
    };
    try {
      validated = validateLabAssistantEligibility({
        facultyIds: input.facultyIds,
        degreeProgramIds: input.degreeProgramIds,
        moduleIds: input.moduleIds,
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Invalid support scope" },
        { status: 400 }
      );
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      try {
        const updated = updateLabAssistantInMemory({
          id: labAssistantId,
          ...input,
          ...validated,
        });
        if (!updated) {
          return NextResponse.json({ message: "Lab assistant not found" }, { status: 404 });
        }

        return NextResponse.json(toApiLabAssistant(updated));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update lab assistant";
        if (message === "NIC/Staff ID already exists") {
          return NextResponse.json({ message }, { status: 409 });
        }

        throw error;
      }
    }

    const row = await LabAssistantModel.findById(labAssistantId).exec();
    if (!row) {
      return NextResponse.json({ message: "Lab assistant not found" }, { status: 404 });
    }

    row.fullName = input.fullName;
    row.phone = input.phone;
    row.nicStaffId = input.nicStaffId;
    row.status = input.status;
    row.facultyIds = validated.facultyIds;
    row.degreeProgramIds = validated.degreeProgramIds;
    row.moduleIds = validated.moduleIds;

    try {
      await row.save();
    } catch (error) {
      const duplicateField = getMongoDuplicateField(error);
      if (duplicateField === "nicStaffId") {
        return NextResponse.json(
          { message: "NIC/Staff ID already exists" },
          { status: 409 }
        );
      }

      throw error;
    }

    await UserModel.updateMany(
      {
        $or: [
          { labAssistantRef: row._id },
          { email: String(row.email ?? "").trim().toLowerCase() },
        ],
      },
      {
        $set: {
          status: row.status,
          labAssistantRef: row._id,
        },
      }
    ).catch(() => null);

    const parsed = toLabAssistantPersistedRecordFromUnknown(row.toObject());
    if (!parsed) {
      return NextResponse.json({ message: "Failed to map lab assistant" }, { status: 500 });
    }

    return NextResponse.json(toApiLabAssistant(parsed));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to update lab assistant",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const labAssistantId = String(params.id ?? "").trim();
    if (!labAssistantId) {
      return NextResponse.json({ message: "Lab assistant id is required" }, { status: 400 });
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      const assignedOfferings = listModuleOfferingsByLabAssistantId(labAssistantId);
      if (assignedOfferings.length > 0) {
        return NextResponse.json(
          { message: "Lab assistant is assigned to module offerings" },
          { status: 409 }
        );
      }

      const deleted = deleteLabAssistantInMemory(labAssistantId);
      if (!deleted) {
        return NextResponse.json({ message: "Lab assistant not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    const assignedOfferingExists = Boolean(
      await ModuleOfferingModel.exists({
        assignedLabAssistantIds: labAssistantId,
      }).catch(() => null)
    );
    if (assignedOfferingExists) {
      return NextResponse.json(
        { message: "Lab assistant is assigned to module offerings" },
        { status: 409 }
      );
    }

    const deletedRow = await LabAssistantModel.findByIdAndDelete(labAssistantId).exec();
    if (!deletedRow) {
      return NextResponse.json({ message: "Lab assistant not found" }, { status: 404 });
    }

    const labAssistantObjectId = mongoose.Types.ObjectId.isValid(labAssistantId)
      ? new mongoose.Types.ObjectId(labAssistantId)
      : null;
    await UserModel.updateMany(
      labAssistantObjectId
        ? { $or: [{ labAssistantRef: labAssistantObjectId }, { email: deletedRow.email }] }
        : { email: deletedRow.email },
      {
        $set: {
          status: "INACTIVE",
          mustChangePassword: false,
        },
      }
    ).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to delete lab assistant",
      },
      { status: 500 }
    );
  }
}
