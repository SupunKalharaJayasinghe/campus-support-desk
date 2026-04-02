import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Counter";
import "@/models/Enrollment";
import "@/models/Student";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import {
  buildStudentEmail,
  buildStudentId,
  decorateStudentDetailRecord,
  decorateStudentListRecord,
  getStudentIdStartSeed,
  getMongoDuplicateField,
  isMongoDuplicateKeyError,
  normalizeAcademicCode,
  resolveStudentPrefix,
  sanitizeName,
  sanitizeNicNumber,
  sanitizeOptionalEmail,
  sanitizePhone,
  sanitizeStudentStatus,
  sanitizeStudentStream,
  sanitizeSubgroup,
  validateStudentRelations,
  type EnrollmentPersistedRecord,
  type EnrollmentWriteInput,
  type StudentPersistedRecord,
  type StudentProfileWriteInput,
  type StudentSort,
  type StudentStream,
  type StudentStatus,
} from "@/models/student-registration";
import { CounterModel } from "@/models/Counter";
import { EnrollmentModel } from "@/models/Enrollment";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";

function parsePageParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parsePageSizeParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const nextValue = Math.floor(parsed);
  if (![10, 25, 50, 100].includes(nextValue)) {
    return fallback;
  }

  return nextValue;
}

function sanitizeSort(value: string | null): StudentSort {
  if (value === "az" || value === "za" || value === "created") {
    return value;
  }

  return "updated";
}

function sanitizeStatus(value: string | null): "" | StudentStatus {
  if (value === "ACTIVE" || value === "INACTIVE") {
    return value;
  }

  return "";
}

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

function toEnrollmentInput(
  body: Partial<Record<string, unknown>>
): EnrollmentWriteInput | null {
  const facultyId = normalizeAcademicCode(body.facultyId);
  const degreeProgramId = normalizeAcademicCode(body.degreeProgramId);
  const intakeId = String(body.intakeId ?? "").trim();
  const stream = sanitizeStudentStream(body.stream);
  const subgroup = sanitizeSubgroup(body.subgroup);
  const status = sanitizeStudentStatus(body.enrollmentStatus ?? "ACTIVE");

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

async function reserveNextStudentIdentityInDb(intakeId: string) {
  const { prefixKey } = resolveStudentPrefix(intakeId);
  const seed = getStudentIdStartSeed();

  const counter = (await CounterModel.findOneAndUpdate(
    { key: prefixKey },
    [
      {
        $set: {
          key: prefixKey,
          seq: {
            $add: [
              {
                $max: [
                  { $ifNull: ["$seq", seed - 1] },
                  seed - 1,
                ],
              },
              1,
            ],
          },
        },
      },
    ],
    {
      upsert: true,
      new: true,
    }
  )
    .lean()
    .exec()) as unknown;
  const counterRow = asObject(counter);
  const nextSeq = Math.max(seed, Math.floor(Number(counterRow?.seq) || seed));
  const studentId = buildStudentId(prefixKey, nextSeq);

  return {
    studentId,
    email: buildStudentEmail(studentId),
  };
}

function groupEnrollmentsByStudent(
  rows: EnrollmentPersistedRecord[]
): Map<string, EnrollmentPersistedRecord[]> {
  const grouped = new Map<string, EnrollmentPersistedRecord[]>();

  rows.forEach((row) => {
    const bucket = grouped.get(row.studentId) ?? [];
    bucket.push(row);
    grouped.set(row.studentId, bucket);
  });

  return grouped;
}

async function isSelectableSubgroupInDb(input: {
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
  stream: StudentStream;
  subgroup: string | null;
}) {
  const subgroup = sanitizeSubgroup(input.subgroup);
  if (!subgroup) {
    return true;
  }

  const exists = await EnrollmentModel.exists({
    facultyId: input.facultyId,
    degreeProgramId: input.degreeProgramId,
    intakeId: input.intakeId,
    stream: input.stream,
    status: "ACTIVE",
    subgroup,
  }).catch(() => null);

  return Boolean(exists);
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = String(searchParams.get("search") ?? "").trim();
  const status = sanitizeStatus(searchParams.get("status"));
  const sort = sanitizeSort(searchParams.get("sort"));
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);
  const page = parsePageParam(searchParams.get("page"), 1);

  const query: Record<string, unknown> = {};
  if (status) {
    query.status = status;
  }

  if (search) {
    const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [
      { studentId: searchRegex },
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { optionalEmail: searchRegex },
      { nicNumber: searchRegex },
    ];
  }

  const total = await StudentModel.countDocuments(query).catch(() => 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const skip = (safePage - 1) * pageSize;
  const sortQuery: Record<string, 1 | -1> =
    sort === "az"
      ? { studentId: 1 }
      : sort === "za"
        ? { studentId: -1 }
        : sort === "created"
          ? { createdAt: -1 }
          : { updatedAt: -1 };

  const studentRows = (await StudentModel.find(query)
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const students = studentRows
    .map((row) => toStudentRecordFromUnknown(row))
    .filter((row): row is StudentPersistedRecord => Boolean(row));

  const studentObjectIds = students
    .map((row) => {
      try {
        return new mongoose.Types.ObjectId(row.id);
      } catch {
        return null;
      }
    })
    .filter((row): row is mongoose.Types.ObjectId => Boolean(row));

  const enrollmentRows =
    studentObjectIds.length > 0
      ? ((await EnrollmentModel.find({ studentId: { $in: studentObjectIds } })
          .sort({ updatedAt: -1 })
          .lean()
          .exec()
          .catch(() => [])) as unknown[])
      : [];

  const enrollments = enrollmentRows
    .map((row) => toEnrollmentRecordFromUnknown(row))
    .filter((row): row is EnrollmentPersistedRecord => Boolean(row));
  const groupedEnrollments = groupEnrollmentsByStudent(enrollments);

  const items = students.map((student) =>
    decorateStudentListRecord(student, groupedEnrollments.get(student.id) ?? [])
  );

  return NextResponse.json({
    items,
    total,
    page: safePage,
    pageSize,
  });
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
        if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};
    const profile = toStudentProfileInput(body);
    const enrollment = toEnrollmentInput(body);

    if (!profile || !enrollment) {
      return NextResponse.json(
        {
          message:
            "First name, last name, NIC number, faculty, degree, intake, and stream are required",
        },
        { status: 400 }
      );
    }

    try {
      validateStudentRelations(enrollment);
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Invalid student data" },
        { status: 400 }
      );
    }

    if (
      !(await isSelectableSubgroupInDb({
        facultyId: enrollment.facultyId,
        degreeProgramId: enrollment.degreeProgramId,
        intakeId: enrollment.intakeId,
        stream: enrollment.stream,
        subgroup: enrollment.subgroup ?? null,
      }))
    ) {
      return NextResponse.json(
        { message: "Select subgroup from the available list" },
        { status: 400 }
      );
    }

    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const reservedIdentity = await reserveNextStudentIdentityInDb(enrollment.intakeId);
      const passwordHash = await bcrypt.hash(profile.nicNumber, 10);

      let createdStudentRecordId = "";
      let createdEnrollmentRecordId = "";
      try {
        const createdStudent = await StudentModel.create({
          studentId: reservedIdentity.studentId,
          email: reservedIdentity.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          nicNumber: profile.nicNumber,
          phone: profile.phone,
          optionalEmail: profile.optionalEmail,
          status: profile.status,
        });
        createdStudentRecordId = String(createdStudent._id);

        await UserModel.create({
          username: reservedIdentity.studentId,
          email: reservedIdentity.email,
          role: "STUDENT",
          passwordHash,
          mustChangePassword: true,
          status: "ACTIVE",
          studentRef: createdStudent._id,
        });

        const createdEnrollment = await EnrollmentModel.create({
          studentId: createdStudent._id,
          facultyId: enrollment.facultyId,
          degreeProgramId: enrollment.degreeProgramId,
          intakeId: enrollment.intakeId,
          stream: enrollment.stream,
          subgroup: enrollment.subgroup ?? null,
          status: enrollment.status,
        });
        createdEnrollmentRecordId = String(createdEnrollment._id);

        const studentRecord = toStudentRecordFromUnknown(createdStudent.toObject());
        const enrollmentRecord = toEnrollmentRecordFromUnknown(
          createdEnrollment.toObject()
        );

        if (!studentRecord || !enrollmentRecord) {
          throw new Error("Failed to map created student");
        }

        return NextResponse.json(
          decorateStudentDetailRecord(studentRecord, [enrollmentRecord]),
          { status: 201 }
        );
      } catch (error) {
        if (createdEnrollmentRecordId) {
          await EnrollmentModel.deleteOne({ _id: createdEnrollmentRecordId }).catch(
            () => null
          );
        }

        if (createdStudentRecordId) {
          await StudentModel.deleteOne({ _id: createdStudentRecordId }).catch(() => null);
          await UserModel.deleteOne({ studentRef: createdStudentRecordId }).catch(
            () => null
          );
        }

        const duplicateField = getMongoDuplicateField(error);
        if (duplicateField === "nicNumber") {
          return NextResponse.json(
            { message: "NIC number already exists" },
            { status: 409 }
          );
        }

        if (isMongoDuplicateKeyError(error) && attempt < maxAttempts - 1) {
          continue;
        }

        if (isMongoDuplicateKeyError(error)) {
          return NextResponse.json(
            {
              message:
                "A student account with generated credentials already exists. Please retry.",
            },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    return NextResponse.json(
      {
        message: "Failed to allocate student ID. Please retry.",
      },
      { status: 409 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to register student",
      },
      { status: 500 }
    );
  }
}

