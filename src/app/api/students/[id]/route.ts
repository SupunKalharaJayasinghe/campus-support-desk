import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/Student";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import {
  decorateStudentDetailRecord,
  getMongoDuplicateField,
  sanitizeName,
  sanitizeNicNumber,
  sanitizeOptionalEmail,
  sanitizePhone,
  sanitizeStudentStatus,
  type EnrollmentPersistedRecord,
  type StudentPersistedRecord,
  type StudentProfileWriteInput,
} from "@/models/student-registration";
import { EnrollmentModel } from "@/models/Enrollment";
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

function toStudentProfileInput(
  body: Partial<Record<string, unknown>>
): StudentProfileWriteInput | null {
  const firstName = sanitizeName(body.firstName);
  const lastName = sanitizeName(body.lastName);
  const nicNumber = sanitizeNicNumber(body.nicNumber);
  const phone = sanitizePhone(body.phone);
  const optionalEmail = sanitizeOptionalEmail(body.optionalEmail);
  const status = sanitizeStudentStatus(body.status);

  if (!firstName || !lastName || !nicNumber) {
    return null;
  }

  return {
    firstName,
    lastName,
    nicNumber,
    phone,
    optionalEmail,
    status,
  };
}

function toStudentRecordFromUnknown(row: unknown): StudentPersistedRecord | null {
  const doc = asObject(row);
  if (!doc) {
    return null;
  }

  const id = String(doc._id ?? doc.id ?? "").trim();
  const studentId = String(doc.studentId ?? "").trim().toUpperCase();
  const email = String(doc.email ?? "").trim().toLowerCase();
  const firstName = sanitizeName(doc.firstName);
  const lastName = sanitizeName(doc.lastName);
  const nicNumber = sanitizeNicNumber(doc.nicNumber);

  if (!id || !studentId || !email || !firstName || !lastName) {
    return null;
  }

  return {
    id,
    studentId,
    email,
    firstName,
    lastName,
    nicNumber,
    phone: sanitizePhone(doc.phone),
    optionalEmail: sanitizeOptionalEmail(doc.optionalEmail),
    status: sanitizeStudentStatus(doc.status),
    createdAt: toIsoDate(doc.createdAt),
    updatedAt: toIsoDate(doc.updatedAt),
  };
}

function toEnrollmentRecordFromUnknown(
  row: unknown
): EnrollmentPersistedRecord | null {
  const doc = asObject(row);
  if (!doc) {
    return null;
  }

  const id = String(doc._id ?? doc.id ?? "").trim();
  const studentId = String(doc.studentId ?? "").trim();
  const facultyId = String(doc.facultyId ?? "").trim().toUpperCase();
  const degreeProgramId = String(doc.degreeProgramId ?? "").trim().toUpperCase();
  const intakeId = String(doc.intakeId ?? "").trim();
  const stream = doc.stream === "WEEKEND" ? "WEEKEND" : doc.stream === "WEEKDAY" ? "WEEKDAY" : null;

  if (!id || !studentId || !facultyId || !degreeProgramId || !intakeId || !stream) {
    return null;
  }

  return {
    id,
    studentId,
    facultyId,
    degreeProgramId,
    intakeId,
    stream,
    subgroup: String(doc.subgroup ?? "").trim() || null,
    status: sanitizeStudentStatus(doc.status),
    createdAt: toIsoDate(doc.createdAt),
    updatedAt: toIsoDate(doc.updatedAt),
  };
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "MongoDB connection is required" },
        { status: 503 }
      );
    }

    const studentRecordId = String(params.id ?? "").trim();
    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};
    const profile = toStudentProfileInput(body);

    if (!profile) {
      return NextResponse.json(
        {
          message: "First name, last name, and NIC number are required",
        },
        { status: 400 }
      );
    }

    const current = await StudentModel.findById(studentRecordId).exec();
    if (!current) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    current.firstName = profile.firstName;
    current.lastName = profile.lastName;
    current.nicNumber = profile.nicNumber;
    current.phone = profile.phone;
    current.optionalEmail = profile.optionalEmail;
    current.status = profile.status;
    try {
      await current.save();
    } catch (error) {
      const duplicateField = getMongoDuplicateField(error);
      if (duplicateField === "nicNumber") {
        return NextResponse.json(
          { message: "NIC number already exists" },
          { status: 409 }
        );
      }

      throw error;
    }

    const studentRecord = toStudentRecordFromUnknown(current.toObject());
    if (!studentRecord) {
      return NextResponse.json({ message: "Failed to map student" }, { status: 500 });
    }

    const enrollmentRows = (await EnrollmentModel.find({
      studentId: current._id,
    })
      .sort({ updatedAt: -1 })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const enrollments = enrollmentRows
      .map((row) => toEnrollmentRecordFromUnknown(row))
      .filter((row): row is EnrollmentPersistedRecord => Boolean(row));

    return NextResponse.json(decorateStudentDetailRecord(studentRecord, enrollments));
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
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "MongoDB connection is required" },
        { status: 503 }
      );
    }

    const studentRecordId = String(params.id ?? "").trim();

    const current = await StudentModel.findById(studentRecordId).exec();
    if (!current) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    await EnrollmentModel.deleteMany({ studentId: current._id }).catch(() => null);
    await StudentModel.deleteOne({ _id: current._id }).catch(() => null);
    await UserModel.updateOne(
      { studentRef: current._id },
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
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "MongoDB connection is required" },
      { status: 503 }
    );
  }

  const studentRecordId = String(params.id ?? "").trim();

  const row = await StudentModel.findById(studentRecordId)
    .lean()
    .exec()
    .catch(() => null);
  if (!row) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const studentRecord = toStudentRecordFromUnknown(row);
  if (!studentRecord) {
    return NextResponse.json({ message: "Failed to map student" }, { status: 500 });
  }

  const enrollmentRows = (await EnrollmentModel.find({ studentId: studentRecordId })
    .sort({ updatedAt: -1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const enrollments = enrollmentRows
    .map((item) => toEnrollmentRecordFromUnknown(item))
    .filter((item): item is EnrollmentPersistedRecord => Boolean(item));

  return NextResponse.json(decorateStudentDetailRecord(studentRecord, enrollments));
}
