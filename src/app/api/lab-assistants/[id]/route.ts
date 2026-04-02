import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/ModuleOffering";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import {
  deleteLabAssistantInMemory,
  findLabAssistantInMemoryById,
  sanitizeAcademicCodeList,
  sanitizeLabAssistantName,
  sanitizeLabAssistantNicStaffId,
  sanitizeLabAssistantOptionalEmail,
  sanitizeLabAssistantPhone,
  sanitizeLabAssistantStatus,
  sanitizeModuleIdList,
  toLabAssistantPersistedRecordFromUnknown,
  updateLabAssistantInMemory,
  type LabAssistantPersistedRecord,
  type LabAssistantStatus,
} from "@/models/lab-assistant-store";
import { listModuleOfferingsByLabAssistantId } from "@/models/module-offering-store";
import { getMongoDuplicateField } from "@/models/student-registration";
import { LabAssistantModel } from "@/models/LabAssistant";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { UserModel } from "@/models/User";
import {
  StaffEligibilityValidationError,
  validateStaffEligibilityWithDb,
} from "@/models/staff-eligibility-db";

interface LabAssistantWriteInput {
  fullName: string;
  optionalEmail: string;
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
    optionalEmail: sanitizeLabAssistantOptionalEmail(body.optionalEmail),
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
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
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

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    let validated: {
      facultyIds: string[];
      degreeProgramIds: string[];
      moduleIds: string[];
    };
    try {
      validated = await validateStaffEligibilityWithDb({
        facultyIds: input.facultyIds,
        degreeProgramIds: input.degreeProgramIds,
        moduleIds: input.moduleIds,
      });
    } catch (error) {
      if (!(error instanceof StaffEligibilityValidationError)) {
        throw error;
      }
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Invalid support scope" },
        { status: 400 }
      );
    }

    const row = await LabAssistantModel.findById(labAssistantId).exec();
    if (!row) {
      return NextResponse.json({ message: "Lab assistant not found" }, { status: 404 });
    }

    row.fullName = input.fullName;
    row.optionalEmail = input.optionalEmail;
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
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
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
    const normalizedEmail = String(deletedRow.email ?? "").trim().toLowerCase();
    await UserModel.deleteMany(
      labAssistantObjectId
        ? {
            role: "LAB_ASSISTANT",
            $or: [
              { labAssistantRef: labAssistantObjectId },
              { email: normalizedEmail },
              { username: normalizedEmail },
            ],
          }
        : {
            role: "LAB_ASSISTANT",
            $or: [{ email: normalizedEmail }, { username: normalizedEmail }],
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
