import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/Student";
import { connectMongoose } from "@/lib/mongoose";
import {
  decorateEnrollmentRecord,
  deleteEnrollmentInMemory,
  findEnrollmentInMemoryById,
  isMongoDuplicateKeyError,
  sanitizeStudentStatus,
  sanitizeStudentStream,
  sanitizeSubgroup,
  updateEnrollmentInMemory,
  validateStudentRelations,
  type EnrollmentPersistedRecord,
} from "@/lib/student-registration";
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

function toApiEnrollmentResponseItem(
  row: ReturnType<typeof decorateEnrollmentRecord>
) {
  return {
    ...row,
    facultyCode: row.facultyId,
    degreeCode: row.degreeProgramId,
    intakeCurrentTerm: row.currentTerm,
  };
}

async function hasLockedEnrollmentData(enrollmentId: mongoose.Types.ObjectId | string) {
  const database = mongoose.connection.db;
  if (!database) {
    return false;
  }

  const idString = String(enrollmentId);
  let objectId: mongoose.Types.ObjectId | null = null;
  try {
    objectId = new mongoose.Types.ObjectId(idString);
  } catch {
    objectId = null;
  }

  const checks: Array<{ collection: string; field: string }> = [
    { collection: "grades", field: "enrollmentId" },
    { collection: "gradeEntries", field: "enrollmentId" },
    { collection: "attendance", field: "enrollmentId" },
    { collection: "attendances", field: "enrollmentId" },
    { collection: "payments", field: "enrollmentId" },
    { collection: "paymentRecords", field: "enrollmentId" },
  ];

  for (const check of checks) {
    const exists = await database
      .listCollections({ name: check.collection }, { nameOnly: true })
      .hasNext()
      .catch(() => false);
    if (!exists) {
      continue;
    }

    const query =
      objectId === null
        ? { [check.field]: idString }
        : {
            $or: [
              { [check.field]: objectId },
              { [check.field]: idString },
            ],
          };
    const row = await database
      .collection(check.collection)
      .findOne(query, { projection: { _id: 1 } })
      .catch(() => null);

    if (row) {
      return true;
    }
  }

  return false;
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const enrollmentId = String(params.id ?? "").trim();
    if (!enrollmentId) {
      return NextResponse.json({ message: "Enrollment id is required" }, { status: 400 });
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};
    const incomingIntakeId = String(body.intakeId ?? "").trim();
    const incomingStream = sanitizeStudentStream(body.stream);
    const hasSubgroup = Object.prototype.hasOwnProperty.call(body, "subgroup");
    const incomingSubgroup = sanitizeSubgroup(body.subgroup);

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      const existing = findEnrollmentInMemoryById(enrollmentId);
      if (!existing) {
        return NextResponse.json({ message: "Enrollment not found" }, { status: 404 });
      }

      const nextIntakeId = incomingIntakeId || existing.intakeId;
      const nextStream = incomingStream ?? existing.stream;
      const nextStatus = sanitizeStudentStatus(body.status ?? existing.status);
      const nextSubgroup = hasSubgroup ? incomingSubgroup : existing.subgroup || null;

      try {
        validateStudentRelations({
          facultyId: existing.facultyId,
          degreeProgramId: existing.degreeProgramId,
          intakeId: nextIntakeId,
        });
      } catch (error) {
        return NextResponse.json(
          { message: error instanceof Error ? error.message : "Invalid enrollment data" },
          { status: 400 }
        );
      }

      try {
        const updated = updateEnrollmentInMemory(enrollmentId, {
          intakeId: nextIntakeId,
          stream: nextStream,
          subgroup: nextSubgroup,
          status: nextStatus,
        });
        if (!updated) {
          return NextResponse.json({ message: "Enrollment not found" }, { status: 404 });
        }

        return NextResponse.json({
          enrollment: toApiEnrollmentResponseItem(updated),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update enrollment";
        if (message === "Student already enrolled in this intake") {
          return NextResponse.json({ message }, { status: 409 });
        }

        return NextResponse.json({ message }, { status: 400 });
      }
    }

    const current = await EnrollmentModel.findById(enrollmentId).exec();
    if (!current) {
      return NextResponse.json({ message: "Enrollment not found" }, { status: 404 });
    }

    const nextIntakeId = incomingIntakeId || String(current.intakeId);
    const nextStream = incomingStream ?? (String(current.stream) as "WEEKDAY" | "WEEKEND");
    const nextStatus = sanitizeStudentStatus(body.status ?? current.status);
    const nextSubgroup = hasSubgroup
      ? incomingSubgroup
      : sanitizeSubgroup(current.subgroup);

    try {
      validateStudentRelations({
        facultyId: String(current.facultyId),
        degreeProgramId: String(current.degreeProgramId),
        intakeId: nextIntakeId,
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Invalid enrollment data" },
        { status: 400 }
      );
    }

    const intakeChanged = String(current.intakeId) !== nextIntakeId;
    if (intakeChanged && (await hasLockedEnrollmentData(current._id))) {
      return NextResponse.json(
        {
          message:
            "Enrollment has locked academic data. Intake cannot be changed.",
        },
        { status: 409 }
      );
    }

    current.intakeId = nextIntakeId;
    current.stream = nextStream;
    current.subgroup = nextSubgroup;
    current.status = nextStatus;

    try {
      await current.save();
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        return NextResponse.json(
          { message: "Student already enrolled in this intake" },
          { status: 409 }
        );
      }

      throw error;
    }

    await StudentModel.updateOne(
      { _id: current.studentId },
      { $set: { updatedAt: new Date() } }
    ).catch(() => null);

    const mapped = toEnrollmentRecordFromUnknown(current.toObject());
    if (!mapped) {
      return NextResponse.json(
        { message: "Failed to map enrollment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      enrollment: toApiEnrollmentResponseItem(decorateEnrollmentRecord(mapped)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to update enrollment",
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
    const enrollmentId = String(params.id ?? "").trim();
    if (!enrollmentId) {
      return NextResponse.json({ message: "Enrollment id is required" }, { status: 400 });
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      const deleted = deleteEnrollmentInMemory(enrollmentId);
      if (!deleted) {
        return NextResponse.json({ message: "Enrollment not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    const current = await EnrollmentModel.findById(enrollmentId).exec();
    if (!current) {
      return NextResponse.json({ message: "Enrollment not found" }, { status: 404 });
    }

    if (await hasLockedEnrollmentData(current._id)) {
      return NextResponse.json(
        { message: "Enrollment has locked academic data and cannot be deleted." },
        { status: 409 }
      );
    }

    await EnrollmentModel.deleteOne({ _id: current._id }).catch(() => null);
    await StudentModel.updateOne(
      { _id: current.studentId },
      { $set: { updatedAt: new Date() } }
    ).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to delete enrollment",
      },
      { status: 500 }
    );
  }
}
