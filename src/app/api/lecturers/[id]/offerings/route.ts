import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import { findDegreeProgram } from "@/models/degree-program-store";
import { findFaculty } from "@/models/faculty-store";
import { findIntakeById, listIntakes } from "@/models/intake-store";
import { deriveAcademicPeriodFromOffering } from "@/lib/academic-period";
import { connectMongoose } from "@/models/mongoose";
import { findModuleByCode, findModuleById } from "@/models/module-store";
import { ModuleOfferingModel } from "@/models/ModuleOffering";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
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

function toApiOffering(item: {
  id: string;
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
  intakeName: string;
  termCode: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  syllabusVersion: string;
  status: string;
  updatedAt: string;
}) {
  const faculty = findFaculty(item.facultyId);
  const degree = findDegreeProgram(item.degreeProgramId);
  const intake = findIntakeById(item.intakeId);
  const moduleRecord = findModuleById(item.moduleId) ?? findModuleByCode(item.moduleCode);
  const academicPeriod = deriveAcademicPeriodFromOffering({
    intakeName: item.intakeName || intake?.name || "",
    termCode: item.termCode,
  });

  return {
    id: item.id,
    facultyId: item.facultyId,
    facultyName: faculty?.name ?? "",
    degreeProgramId: item.degreeProgramId,
    degreeProgramName: degree?.name ?? "",
    intakeId: item.intakeId,
    intakeName: item.intakeName || intake?.name || "",
    termCode: item.termCode,
    moduleId: item.moduleId,
    moduleCode: item.moduleCode || moduleRecord?.code || "",
    moduleName: item.moduleName || moduleRecord?.name || "",
    syllabusVersion: item.syllabusVersion,
    status: item.status,
    currentTerm: intake?.currentTerm ?? "",
    academicYear: academicPeriod.academicYear,
    semester: academicPeriod.semester,
    updatedAt: item.updatedAt,
  };
}

function normalizeDbOffering(value: unknown) {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  if (!id) {
    return null;
  }

  const intakeId = String(row.intakeId ?? "").trim();
  const intakeNameFromRow = String(row.intakeName ?? "").trim();
  const intakeById = intakeId ? findIntakeById(intakeId) : null;
  const intakeByName =
    !intakeById && intakeNameFromRow
      ? listIntakes().find(
          (item) => item.name.toLowerCase() === intakeNameFromRow.toLowerCase()
        ) ?? null
      : null;
  const intake = intakeById ?? intakeByName;

  const moduleId = String(row.moduleId ?? "").trim();
  const moduleCodeFromRow = String(row.moduleCode ?? "").trim().toUpperCase();
  const moduleById = moduleId ? findModuleById(moduleId) : null;
  const moduleByCode = !moduleById && moduleCodeFromRow ? findModuleByCode(moduleCodeFromRow) : null;
  const moduleRecord = moduleById ?? moduleByCode;
  const resolvedModuleCode = moduleCodeFromRow || moduleRecord?.code || moduleId.toUpperCase();

  if (!resolvedModuleCode) {
    return null;
  }

  const resolvedModuleId = moduleId || moduleRecord?.id || resolvedModuleCode;
  const resolvedIntakeId = intakeId || intake?.id || intakeNameFromRow;
  const resolvedIntakeName = intakeNameFromRow || intake?.name || resolvedIntakeId;

  return {
    id,
    facultyId: normalizeAcademicCode(row.facultyId ?? intake?.facultyCode),
    degreeProgramId: normalizeAcademicCode(row.degreeProgramId ?? intake?.degreeCode),
    intakeId: resolvedIntakeId,
    intakeName: resolvedIntakeName,
    termCode: String(row.termCode ?? "").trim().toUpperCase(),
    moduleId: resolvedModuleId,
    moduleCode: resolvedModuleCode,
    moduleName: String(row.moduleName ?? moduleRecord?.name ?? "").trim(),
    syllabusVersion: String(row.syllabusVersion ?? "NEW").trim().toUpperCase(),
    status: String(row.status ?? "ACTIVE").trim().toUpperCase(),
    updatedAt: toIsoDate(row.updatedAt),
    assignedLecturerIds: mergeSanitizedIdLists(
      row.assignedLecturerIds,
      row.assignedLecturers
    ),
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
    .filter(
      (row): row is NonNullable<ReturnType<typeof normalizeDbOffering>> => Boolean(row)
    )
    .map((row) =>
      toApiOffering({
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
      })
    );

  return NextResponse.json({
    items,
    total: items.length,
  });
}
