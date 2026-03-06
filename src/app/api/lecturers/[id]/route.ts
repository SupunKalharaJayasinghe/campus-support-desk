import { NextResponse } from "next/server";
import "@/models/Lecturer";
import { connectMongoose } from "@/lib/mongoose";
import {
  deleteLecturerInMemory,
  findLecturerInMemoryById,
  sanitizeAcademicCodeList,
  sanitizeLecturerName,
  sanitizeLecturerNicStaffId,
  sanitizeLecturerPhone,
  sanitizeLecturerStatus,
  sanitizeModuleIdList,
  toLecturerPersistedRecordFromUnknown,
  updateLecturerInMemory,
  validateLecturerEligibility,
  type LecturerPersistedRecord,
  type LecturerStatus,
} from "@/lib/lecturer-store";
import { getMongoDuplicateField } from "@/lib/student-registration";
import { LecturerModel } from "@/models/Lecturer";

interface LecturerWriteInput {
  fullName: string;
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
    const row = findLecturerInMemoryById(lecturerId);
    if (!row) {
      return NextResponse.json({ message: "Lecturer not found" }, { status: 404 });
    }

    return NextResponse.json(toApiLecturer(row));
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

    let validated: {
      facultyIds: string[];
      degreeProgramIds: string[];
      moduleIds: string[];
    };
    try {
      validated = validateLecturerEligibility({
        facultyIds: input.facultyIds,
        degreeProgramIds: input.degreeProgramIds,
        moduleIds: input.moduleIds,
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Invalid teaching scope" },
        { status: 400 }
      );
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      try {
        const updated = updateLecturerInMemory({
          id: lecturerId,
          ...input,
          ...validated,
        });
        if (!updated) {
          return NextResponse.json({ message: "Lecturer not found" }, { status: 404 });
        }

        return NextResponse.json(toApiLecturer(updated));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update lecturer";
        if (message === "NIC/Staff ID already exists") {
          return NextResponse.json({ message }, { status: 409 });
        }

        throw error;
      }
    }

    const row = await LecturerModel.findById(lecturerId).exec();
    if (!row) {
      return NextResponse.json({ message: "Lecturer not found" }, { status: 404 });
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

    const parsed = toLecturerPersistedRecordFromUnknown(row.toObject());
    if (!parsed) {
      return NextResponse.json({ message: "Failed to map lecturer" }, { status: 500 });
    }

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
      const deleted = deleteLecturerInMemory(lecturerId);
      if (!deleted) {
        return NextResponse.json({ message: "Lecturer not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    const deletedRow = await LecturerModel.findByIdAndDelete(lecturerId).exec();
    if (!deletedRow) {
      return NextResponse.json({ message: "Lecturer not found" }, { status: 404 });
    }

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
