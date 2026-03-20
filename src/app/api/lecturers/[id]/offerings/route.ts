import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import { findIntakeById } from "@/lib/intake-store";
import { connectMongoose } from "@/lib/mongoose";
import { listModuleOfferingsByLecturerId, type ModuleOfferingRecord } from "@/lib/module-offering-store";
import { findModuleById } from "@/lib/module-store";
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
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );
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
  const moduleRecord = findModuleById(item.moduleId);

  return {
    id: item.id,
    facultyId: item.facultyId,
    facultyName: faculty?.name ?? "",
    degreeProgramId: item.degreeProgramId,
    degreeProgramName: degree?.name ?? "",
    intakeId: item.intakeId,
    intakeName: intake?.name ?? "",
    termCode: item.termCode,
    moduleId: item.moduleId,
    moduleCode: item.moduleCode || moduleRecord?.code || "",
    moduleName: item.moduleName || moduleRecord?.name || "",
    syllabusVersion: item.syllabusVersion,
    status: item.status,
    currentTerm: intake?.currentTerm ?? "",
    updatedAt: item.updatedAt,
  };
}

function normalizeDbOffering(value: unknown) {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  const intakeId = String(row.intakeId ?? "").trim();
  const moduleId = String(row.moduleId ?? "").trim();
  if (!id || !intakeId || !moduleId) {
    return null;
  }

  const intake = findIntakeById(intakeId);
  const moduleRecord = findModuleById(moduleId);

  return {
    id,
    facultyId: normalizeAcademicCode(row.facultyId ?? intake?.facultyCode),
    degreeProgramId: normalizeAcademicCode(row.degreeProgramId ?? intake?.degreeCode),
    intakeId,
    termCode: String(row.termCode ?? "").trim().toUpperCase(),
    moduleId,
    moduleCode: String(row.moduleCode ?? moduleRecord?.code ?? "").trim().toUpperCase(),
    moduleName: String(row.moduleName ?? moduleRecord?.name ?? "").trim(),
    syllabusVersion: String(row.syllabusVersion ?? "NEW").trim().toUpperCase(),
    status: String(row.status ?? "ACTIVE").trim().toUpperCase(),
    updatedAt: toIsoDate(row.updatedAt),
    assignedLecturerIds: sanitizeIdList(row.assignedLecturerIds ?? row.assignedLecturers),
  };
}

function toApiFromMemory(item: ModuleOfferingRecord) {
  return toApiOffering({
    id: item.id,
    facultyId: item.facultyId,
    degreeProgramId: item.degreeProgramId,
    intakeId: item.intakeId,
    termCode: item.termCode,
    moduleId: item.moduleId,
    moduleCode: item.moduleCode,
    moduleName: item.moduleName,
    syllabusVersion: item.syllabusVersion,
    status: item.status,
    updatedAt: item.updatedAt,
  });
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
    const items = listModuleOfferingsByLecturerId(lecturerId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((item) => toApiFromMemory(item));

    return NextResponse.json({
      items,
      total: items.length,
    });
  }

  const rows = (await ModuleOfferingModel.find({
    assignedLecturerIds: lecturerId,
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
