import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/Student";
import { connectMongoose } from "@/models/mongoose";
import {
  DUPLICATE_ENROLLMENT_MESSAGE,
  addEnrollmentToStudentInMemory,
  decorateEnrollmentRecord,
  isMongoDuplicateKeyError,
  listStudentEnrollmentsInMemory,
  normalizeAcademicCode,
  sanitizeStudentStatus,
  sanitizeStudentStream,
  sanitizeSubgroup,
  validateStudentRelations,
  type EnrollmentPersistedRecord,
  type EnrollmentWriteInput,
} from "@/models/student-registration";
import { EnrollmentModel } from "@/models/Enrollment";
import { StudentModel } from "@/models/Student";

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

function toEnrollmentInput(
  body: Partial<Record<string, unknown>>
): EnrollmentWriteInput | null {
  const facultyId = normalizeAcademicCode(body.facultyId);
  const degreeProgramId = normalizeAcademicCode(body.degreeProgramId);
  const intakeId = String(body.intakeId ?? "").trim();
  const stream = sanitizeStudentStream(body.stream);
  const subgroup = sanitizeSubgroup(body.subgroup);
  const status = sanitizeStudentStatus(body.status);

  if (!facultyId || !degreeProgramId || !intakeId || !stream) {
    return null;
  }

  return {
    facultyId,
    degreeProgramId,
    intakeId,
    stream,
    subgroup,
    status,
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
  const facultyId = normalizeAcademicCode(doc.facultyId);
  const degreeProgramId = normalizeAcademicCode(doc.degreeProgramId);
  const intakeId = String(doc.intakeId ?? "").trim();
  const stream = sanitizeStudentStream(doc.stream);

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
    subgroup: sanitizeSubgroup(doc.subgroup),
    status: sanitizeStudentStatus(doc.status),
    createdAt: toIsoDate(doc.createdAt),
    updatedAt: toIsoDate(doc.updatedAt),
  };
}

function toApiEnrollmentResponseItem(row: ReturnType<typeof decorateEnrollmentRecord>) {
  return {
    ...row,
    facultyCode: row.facultyId,
    degreeCode: row.degreeProgramId,
    intakeCurrentTerm: row.currentTerm,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    const studentRecordId = String(params.id ?? "").trim();
    if (!studentRecordId) {
      return NextResponse.json({ message: "Student id is required" }, { status: 400 });
    }

    if (!mongooseConnection) {
      return NextResponse.json({
        items: listStudentEnrollmentsInMemory(studentRecordId).map((item) =>
          toApiEnrollmentResponseItem(item)
        ),
      });
    }

    const student = await StudentModel.findById(studentRecordId).exec();
    if (!student) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    const enrollmentRows = (await EnrollmentModel.find({
      studentId: student._id,
    })
      .sort({ updatedAt: -1 })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const items = enrollmentRows
      .map((row) => toEnrollmentRecordFromUnknown(row))
      .filter((row): row is EnrollmentPersistedRecord => Boolean(row))
      .map((row) => toApiEnrollmentResponseItem(decorateEnrollmentRecord(row)));

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to load enrollments",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    const studentRecordId = String(params.id ?? "").trim();
    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};
    const enrollment = toEnrollmentInput(body);

    if (!studentRecordId) {
      return NextResponse.json({ message: "Student id is required" }, { status: 400 });
    }

    if (!enrollment) {
      return NextResponse.json(
        {
          message: "Faculty, degree, intake, and stream are required",
        },
        { status: 400 }
      );
    }

    try {
      validateStudentRelations(enrollment);
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Invalid enrollment data" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      try {
        const created = addEnrollmentToStudentInMemory(studentRecordId, enrollment);
        return NextResponse.json({ enrollment: created }, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create enrollment";
        if (message === DUPLICATE_ENROLLMENT_MESSAGE) {
          return NextResponse.json({ message }, { status: 409 });
        }

        if (message === "Student not found") {
          return NextResponse.json({ message }, { status: 404 });
        }

        return NextResponse.json({ message }, { status: 400 });
      }
    }

    const student = await StudentModel.findById(studentRecordId).exec();
    if (!student) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    try {
      const createdEnrollment = await EnrollmentModel.create({
        studentId: student._id,
        facultyId: enrollment.facultyId,
        degreeProgramId: enrollment.degreeProgramId,
        intakeId: enrollment.intakeId,
        stream: enrollment.stream,
        subgroup: enrollment.subgroup ?? null,
        status: enrollment.status,
      });

      await StudentModel.updateOne(
        { _id: student._id },
        { $set: { updatedAt: new Date() } }
      ).catch(() => null);

      const enrollmentRecord = toEnrollmentRecordFromUnknown(
        createdEnrollment.toObject()
      );
      if (!enrollmentRecord) {
        return NextResponse.json(
          { message: "Failed to map enrollment" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { enrollment: decorateEnrollmentRecord(enrollmentRecord) },
        { status: 201 }
      );
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        return NextResponse.json(
          { message: DUPLICATE_ENROLLMENT_MESSAGE },
          { status: 409 }
        );
      }

      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to create enrollment",
      },
      { status: 500 }
    );
  }
}
