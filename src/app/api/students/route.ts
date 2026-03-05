import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import "@/models/Counter";
import "@/models/Student";
import "@/models/User";
import { connectMongoose } from "@/lib/mongoose";
import {
  buildStudentEmail,
  buildStudentId,
  createStudentAndUserInMemory,
  decorateStudentRecord,
  getStudentIdStartSeed,
  isMongoDuplicateKeyError,
  listStudentsInMemory,
  normalizeAcademicCode,
  resolveStudentPrefix,
  sanitizeName,
  sanitizePhone,
  sanitizeStudentStatus,
  sanitizeStudentStream,
  sanitizeSubgroup,
  validateStudentRelations,
  type StudentSort,
  type StudentStatus,
  type StudentWriteInput,
} from "@/lib/student-registration";
import { CounterModel } from "@/models/Counter";
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

async function reserveNextStudentIdentityInDb(intakeId: string) {
  const { prefixKey } = resolveStudentPrefix(intakeId);
  const seed = getStudentIdStartSeed();

  const counter = (await CounterModel.findOneAndUpdate(
    { key: prefixKey },
    {
      $setOnInsert: { key: prefixKey, seq: seed - 1 },
      $inc: { seq: 1 },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
    .lean()
    .exec()) as unknown;
  const counterRow = asObject(counter);
  const nextSeq = Math.max(seed, Math.floor(Number(counterRow?.seq) || seed));
  const studentId = buildStudentId(prefixKey, nextSeq);

  return {
    prefixKey,
    sequence: nextSeq,
    studentId,
    email: buildStudentEmail(studentId),
  };
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);
  const search = String(searchParams.get("search") ?? "").trim();
  const status = sanitizeStatus(searchParams.get("status"));
  const sort = sanitizeSort(searchParams.get("sort"));
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);
  const page = parsePageParam(searchParams.get("page"), 1);

  if (!mongooseConnection) {
    const allItems = listStudentsInMemory({ search, sort, status }).map((item) =>
      decorateStudentRecord(item)
    );
    const total = allItems.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;

    return NextResponse.json({
      items: allItems.slice(start, start + pageSize),
      total,
      page: safePage,
      pageSize,
    });
  }

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

  const rows = (await StudentModel.find(query)
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toApiStudentRecordFromUnknown(row))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

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
      const created = await createStudentAndUserInMemory(input);
      return NextResponse.json(decorateStudentRecord(created), { status: 201 });
    }

    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const reservedIdentity = await reserveNextStudentIdentityInDb(input.intakeId);
      const passwordHash = await bcrypt.hash(reservedIdentity.studentId, 10);

      let createdStudentId = "";
      try {
        const createdStudent = await StudentModel.create({
          studentId: reservedIdentity.studentId,
          email: reservedIdentity.email,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          facultyId: input.facultyId,
          degreeProgramId: input.degreeProgramId,
          intakeId: input.intakeId,
          stream: input.stream,
          subgroup: input.subgroup ?? null,
          status: input.status,
        });
        createdStudentId = String(createdStudent._id);

        await UserModel.create({
          username: reservedIdentity.studentId,
          email: reservedIdentity.email,
          role: "STUDENT",
          passwordHash,
          mustChangePassword: true,
          status: "ACTIVE",
          studentRef: createdStudent._id,
        });

        const item = toApiStudentRecordFromUnknown(createdStudent.toObject());
        if (!item) {
          throw new Error("Failed to map created student");
        }

        return NextResponse.json(item, { status: 201 });
      } catch (error) {
        if (createdStudentId) {
          await StudentModel.deleteOne({ _id: createdStudentId }).catch(() => null);
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
