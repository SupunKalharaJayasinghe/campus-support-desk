import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import { findDegreeProgram } from "@/models/degree-program-store";
import { findFaculty } from "@/models/faculty-store";
import { findIntakeById, listIntakes } from "@/models/intake-store";
import { connectMongoose } from "@/models/mongoose";
import {
  listModuleOfferingsByLabAssistantId,
  type ModuleOfferingRecord,
} from "@/models/module-offering-store";
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
  };
}

function toApiFromMemory(item: ModuleOfferingRecord) {
  return toApiOffering({
    id: item.id,
    facultyId: item.facultyId,
    degreeProgramId: item.degreeProgramId,
    intakeId: item.intakeId,
    intakeName: item.intakeName,
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
  const labAssistantId = String(params.id ?? "").trim();
  if (!labAssistantId) {
    return NextResponse.json({ message: "Lab assistant id is required" }, { status: 400 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    const items = listModuleOfferingsByLabAssistantId(labAssistantId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((item) => toApiFromMemory(item));

    return NextResponse.json({
      items,
      total: items.length,
    });
  }

  const rows = (await ModuleOfferingModel.find({
    assignedLabAssistantIds: labAssistantId,
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
    .map((row) => toApiOffering(row));

  return NextResponse.json({
    items,
    total: items.length,
  });
}
