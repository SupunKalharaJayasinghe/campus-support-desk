import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { UserModel } from "@/models/User";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function sanitizeId(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const row = value as {
      _id?: unknown;
      id?: unknown;
      toString?: () => string;
    };
    const nestedId = String(row._id ?? row.id ?? "").trim();
    if (nestedId) {
      return nestedId;
    }
    const rendered = typeof row.toString === "function" ? row.toString() : "";
    return rendered === "[object Object]" ? "" : rendered.trim();
  }

  return "";
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function sanitizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => {
          if (typeof item === "string") {
            return String(item).trim();
          }
          if (!item || typeof item !== "object") {
            return "";
          }
          const row = item as Record<string, unknown>;
          return String(row.id ?? row._id ?? row.lecturerId ?? "").trim();
        })
        .filter(Boolean)
    )
  );
}

function mergeSanitizedIdLists(...values: unknown[]) {
  return sanitizeIdList(values.flatMap((value) => (Array.isArray(value) ? value : [])));
}

function normalizeDbOffering(value: unknown) {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = sanitizeId(row._id ?? row.id);
  if (!id) {
    return null;
  }

  const intakeId = sanitizeId(row.intakeId);
  const intakeName = normalizeText(row.intakeName) || intakeId;
  const moduleCode = normalizeModuleCode(row.moduleCode ?? row.moduleId);
  const moduleId = sanitizeId(row.moduleId) || moduleCode;
  if (!moduleCode || !moduleId) {
    return null;
  }

  return {
    id,
    facultyId: normalizeAcademicCode(row.facultyId ?? row.facultyCode),
    degreeProgramId: normalizeAcademicCode(row.degreeProgramId ?? row.degreeCode),
    intakeId: intakeId || intakeName,
    intakeName,
    termCode: String(row.termCode ?? "").trim().toUpperCase(),
    moduleId,
    moduleCode,
    moduleName: normalizeText(row.moduleName) || moduleCode,
    syllabusVersion: String(row.syllabusVersion ?? "NEW").trim().toUpperCase(),
    status: String(row.status ?? "ACTIVE").trim().toUpperCase(),
    updatedAt: toIsoDate(row.updatedAt),
    assignedLecturerIds: mergeSanitizedIdLists(
      row.assignedLecturerIds,
      row.assignedLecturers
    ),
  };
}

async function resolveCurrentLecturerId(
  request: Request,
  mongooseConnection: mongoose.Mongoose | null
) {
  if (!mongooseConnection) {
    return "";
  }

  const userId = String(request.headers.get("x-user-id") ?? "").trim();
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return "";
  }

  const user = await UserModel.findById(userId)
    .select({ role: 1, status: 1, lecturerRef: 1 })
    .lean()
    .exec()
    .catch(() => null);

  const row = asObject(user);
  const role = String(row?.role ?? "").trim().toUpperCase();
  const status = String(row?.status ?? "").trim().toUpperCase();
  const lecturerId = sanitizeId(row?.lecturerRef);
  if (role !== "LECTURER" || status !== "ACTIVE" || !lecturerId) {
    return "";
  }

  return lecturerId;
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const lecturerId = await resolveCurrentLecturerId(request, mongooseConnection);
  if (!lecturerId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rows = (await ModuleOfferingModel.find({
    $or: [
      { assignedLecturerIds: lecturerId },
      { assignedLecturers: lecturerId },
      { "assignedLecturers.lecturerId": lecturerId },
      { "assignedLecturers.id": lecturerId },
      { "assignedLecturers._id": lecturerId },
    ],
  })
    .sort({ updatedAt: -1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => normalizeDbOffering(row))
    .filter((row): row is NonNullable<ReturnType<typeof normalizeDbOffering>> =>
      Boolean(row)
    )
    .map((row) => ({
      id: row.id,
      facultyId: row.facultyId,
      degreeProgramId: row.degreeProgramId,
      intakeId: row.intakeId,
      intakeName: row.intakeName,
      termCode: row.termCode,
      moduleId: row.moduleId,
      moduleCode: row.moduleCode,
      moduleName: row.moduleName,
      syllabusVersion: row.syllabusVersion,
      status: row.status,
      updatedAt: row.updatedAt,
    }));

  return NextResponse.json({
    items,
    total: items.length,
  });
}
