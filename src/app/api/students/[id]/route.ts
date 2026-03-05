import { NextResponse } from "next/server";
import "@/models/Student";
import "@/models/User";
import { connectMongoose } from "@/lib/mongoose";
import {
  decorateStudentRecord,
  deleteStudentInMemory,
  findStudentInMemoryById,
  normalizeAcademicCode,
  sanitizeName,
  sanitizePhone,
  sanitizeStudentStatus,
  sanitizeStudentStream,
  sanitizeSubgroup,
  updateStudentInMemory,
  validateStudentRelations,
  type StudentWriteInput,
} from "@/lib/student-registration";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
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

function toStudentInput(body: Partial<Record<string, unknown>>): StudentWriteInput | null {
  const firstName = sanitizeName(body.firstName);
  const lastName = sanitizeName(body.lastName);
  const phone = sanitizePhone(body.phone);
  const facultyId = normalizeAcademicCode(body.facultyId);
  const degreeProgramId = normalizeAcademicCode(body.degreeProgramId);
  const intakeId = String(body.intakeId ?? "").trim();
  const stream = sanitizeStudentStream(body.stream);
  const subgroup = Object.prototype.hasOwnProperty.call(body, "subgroup")
    ? sanitizeSubgroup(body.subgroup)
    : undefined;
  const status = sanitizeStudentStatus(body.status);

  if (!firstName || !lastName || !facultyId || !degreeProgramId || !intakeId || !stream) {
    return null;
  }

  return {
    firstName,
    lastName,
    phone,
    facultyId,
    degreeProgramId,
    intakeId,
    stream,
    subgroup,
    status,
  };
}

function toApiStudentRecordFromUnknown(row: unknown) {
  const doc = asObject(row);
  if (!doc) {
    return null;
  }

  const firstName = sanitizeName(doc.firstName);
  const lastName = sanitizeName(doc.lastName);
  const facultyId = normalizeAcademicCode(doc.facultyId);
  const degreeProgramId = normalizeAcademicCode(doc.degreeProgramId);
  const intakeId = String(doc.intakeId ?? "").trim();
  const stream = sanitizeStudentStream(doc.stream);
  const subgroup = sanitizeSubgroup(doc.subgroup);
  const studentId = String(doc.studentId ?? "").trim().toUpperCase();
  const email = String(doc.email ?? "").trim().toLowerCase();

  if (
    !studentId ||
    !email ||
    !firstName ||
    !lastName ||
    !facultyId ||
    !degreeProgramId ||
    !intakeId ||
    !stream
  ) {
    return null;
  }

  const status = sanitizeStudentStatus(doc.status);

  return decorateStudentRecord({
    id: String(doc._id ?? doc.id ?? "").trim(),
    studentId,
    email,
    firstName,
    lastName,
    phone: sanitizePhone(doc.phone),
    facultyId,
    degreeProgramId,
    intakeId,
    stream,
    subgroup,
    status,
    createdAt: toIsoDate(doc.createdAt),
    updatedAt: toIsoDate(doc.updatedAt),
  });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    const studentId = String(params.id ?? "").trim();
    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};
    const input = toStudentInput(body);

    if (!input) {
      return NextResponse.json(
        {
          message:
            "First name, last name, faculty, degree, intake, and stream are required",
        },
        { status: 400 }
      );
    }

    try {
      validateStudentRelations(input);
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Invalid student data" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      const updated = updateStudentInMemory(studentId, input);
      if (!updated) {
        return NextResponse.json({ message: "Student not found" }, { status: 404 });
      }

      return NextResponse.json(decorateStudentRecord(updated));
    }

    const current = await StudentModel.findById(studentId).exec();
    if (!current) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    current.firstName = input.firstName;
    current.lastName = input.lastName;
    current.phone = input.phone;
    current.facultyId = input.facultyId;
    current.degreeProgramId = input.degreeProgramId;
    current.intakeId = input.intakeId;
    current.stream = input.stream;
    if (input.subgroup !== undefined) {
      current.subgroup = input.subgroup;
    }
    current.status = input.status;
    await current.save();

    const item = toApiStudentRecordFromUnknown(current.toObject());
    if (!item) {
      return NextResponse.json({ message: "Failed to map student" }, { status: 500 });
    }

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update student",
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
    const mongooseConnection = await connectMongoose().catch(() => null);
    const studentId = String(params.id ?? "").trim();

    if (!mongooseConnection) {
      const deleted = deleteStudentInMemory(studentId);
      if (!deleted) {
        return NextResponse.json({ message: "Student not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    const current = await StudentModel.findById(studentId).exec();
    if (!current) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    const studentRef = String(current._id);
    await StudentModel.deleteOne({ _id: studentRef }).catch(() => null);
    await UserModel.updateOne(
      { studentRef },
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
        message: error instanceof Error ? error.message : "Failed to delete student",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const studentId = String(params.id ?? "").trim();

  if (!mongooseConnection) {
    const student = findStudentInMemoryById(studentId);
    if (!student) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(decorateStudentRecord(student));
  }

  const row = await StudentModel.findById(studentId).lean().exec().catch(() => null);
  if (!row) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const item = toApiStudentRecordFromUnknown(row);
  if (!item) {
    return NextResponse.json({ message: "Failed to map student" }, { status: 500 });
  }

  return NextResponse.json(item);
}
