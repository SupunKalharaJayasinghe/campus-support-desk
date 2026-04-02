import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Lecturer";
import "@/models/ModuleOffering";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import {
  deleteLecturerInMemory,
  findLecturerInMemoryById,
  sanitizeAcademicCodeList,
  sanitizeLecturerName,
  sanitizeLecturerNicStaffId,
  sanitizeLecturerOptionalEmail,
  sanitizeLecturerPhone,
  sanitizeLecturerStatus,
  sanitizeModuleIdList,
  toLecturerPersistedRecordFromUnknown,
  updateLecturerInMemory,
  type LecturerPersistedRecord,
  type LecturerStatus,
} from "@/models/lecturer-store";
import { listModuleOfferingsByLecturerId } from "@/models/module-offering-store";
import { getMongoDuplicateField } from "@/models/student-registration";
import { LecturerModel } from "@/models/Lecturer";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { UserModel } from "@/models/User";
import { syncLecturerAssignmentsAcrossModuleOfferings } from "@/models/module-offering-lecturer-sync";
import {
  StaffEligibilityValidationError,
  validateStaffEligibilityWithDb,
} from "@/models/staff-eligibility-db";

interface LecturerWriteInput {
  fullName: string;
  optionalEmail: string;
  phone: string;
  nicStaffId: string | null;
  status: LecturerStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
}

function toWriteInput(body: Partial<Record<string, unknown>>): LecturerWriteInput | null {
  const fullName = sanitizeLecturerName(body.fullName);
  if (!fullName) {
    return null;
  }

  return {
    fullName,
    optionalEmail: sanitizeLecturerOptionalEmail(body.optionalEmail),
    phone: sanitizeLecturerPhone(body.phone),
    nicStaffId: sanitizeLecturerNicStaffId(body.nicStaffId),
    status: sanitizeLecturerStatus(body.status),
    facultyIds: sanitizeAcademicCodeList(body.facultyIds),
    degreeProgramIds: sanitizeAcademicCodeList(body.degreeProgramIds),
    moduleIds: sanitizeModuleIdList(body.moduleIds),
  };
}

function toApiLecturer(row: LecturerPersistedRecord) {
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
  const lecturerId = String(params.id ?? "").trim();
  if (!lecturerId) {
    return NextResponse.json({ message: "Lecturer id is required" }, { status: 400 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const row = await LecturerModel.findById(lecturerId).lean().exec().catch(() => null);
  if (!row) {
    return NextResponse.json({ message: "Lecturer not found" }, { status: 404 });
  }

  const parsed = toLecturerPersistedRecordFromUnknown(row);
  if (!parsed) {
    return NextResponse.json({ message: "Failed to map lecturer" }, { status: 500 });
  }

  return NextResponse.json(toApiLecturer(parsed));
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const lecturerId = String(params.id ?? "").trim();
    if (!lecturerId) {
      return NextResponse.json({ message: "Lecturer id is required" }, { status: 400 });
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
        { message: error instanceof Error ? error.message : "Invalid teaching scope" },
        { status: 400 }
      );
    }

    const row = await LecturerModel.findById(lecturerId).exec();
    if (!row) {
      return NextResponse.json({ message: "Lecturer not found" }, { status: 404 });
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
        $or: [{ lecturerRef: row._id }, { email: String(row.email ?? "").trim().toLowerCase() }],
      },
      {
        $set: {
          status: row.status,
          lecturerRef: row._id,
        },
      }
    ).catch(() => null);

    const parsed = toLecturerPersistedRecordFromUnknown(row.toObject());
    if (!parsed) {
      return NextResponse.json({ message: "Failed to map lecturer" }, { status: 500 });
    }

    await syncLecturerAssignmentsAcrossModuleOfferings(
      {
        lecturerId: parsed.id,
        fullName: parsed.fullName,
        email: parsed.email,
        status: parsed.status,
        facultyIds: parsed.facultyIds,
        degreeProgramIds: parsed.degreeProgramIds,
        moduleIds: parsed.moduleIds,
      },
      { mongooseConnection }
    ).catch(() => null);

    return NextResponse.json(toApiLecturer(parsed));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to update lecturer",
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
    const lecturerId = String(params.id ?? "").trim();
    if (!lecturerId) {
      return NextResponse.json({ message: "Lecturer id is required" }, { status: 400 });
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
        assignedLecturerIds: lecturerId,
      }).catch(() => null)
    );
    if (assignedOfferingExists) {
      return NextResponse.json(
        { message: "Lecturer is assigned to module offerings" },
        { status: 409 }
      );
    }

    const deletedRow = await LecturerModel.findByIdAndDelete(lecturerId).exec();
    if (!deletedRow) {
      return NextResponse.json({ message: "Lecturer not found" }, { status: 404 });
    }

    const lecturerObjectId = mongoose.Types.ObjectId.isValid(lecturerId)
      ? new mongoose.Types.ObjectId(lecturerId)
      : null;
    const normalizedEmail = String(deletedRow.email ?? "").trim().toLowerCase();
    await UserModel.deleteMany(
      lecturerObjectId
        ? {
            role: "LECTURER",
            $or: [
              { lecturerRef: lecturerObjectId },
              { email: normalizedEmail },
              { username: normalizedEmail },
            ],
          }
        : {
            role: "LECTURER",
            $or: [{ email: normalizedEmail }, { username: normalizedEmail }],
          }
    ).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to delete lecturer",
      },
      { status: 500 }
    );
  }
}
