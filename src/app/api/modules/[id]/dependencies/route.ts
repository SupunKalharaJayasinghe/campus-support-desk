import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Intake";
import "@/models/ModuleOffering";
import { findDegreeProgram } from "@/models/degree-program-store";
import { findFaculty } from "@/models/faculty-store";
import { findIntakeById } from "@/models/intake-store";
import {
  listModuleOfferings,
  type ModuleOfferingRecord,
} from "@/models/module-offering-store";
import { connectMongoose } from "@/models/mongoose";
import { IntakeModel } from "@/models/Intake";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { findModuleByCode, findModuleById } from "@/models/module-store";

interface ModuleDependencyItem {
  offeringId: string;
  facultyCode: string;
  facultyName: string;
  degreeId: string;
  degreeCode: string;
  intakeId: string;
  intakeName: string;
  termCode: string;
  syllabusVersion: string;
  lecturerCount: number;
  updatedAt: string;
}

interface IntakeLookup {
  intakeId: string;
  intakeName: string;
  facultyCode: string;
  degreeCode: string;
}

interface NormalizedDbOffering {
  offeringId: string;
  intakeId: string;
  intakeName: string;
  facultyCode: string;
  degreeCode: string;
  termCode: string;
  syllabusVersion: string;
  moduleId: string;
  moduleCode: string;
  assignedLecturerIds: string[];
  updatedAt: string;
}

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

function normalizeSyllabusVersion(value: unknown) {
  return value === "OLD" ? "OLD" : "NEW";
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

function toIntakeLookupFromStore(intakeId: string): IntakeLookup | null {
  const intake = findIntakeById(intakeId);
  if (!intake) {
    return null;
  }

  return {
    intakeId: intake.id,
    intakeName: intake.name,
    facultyCode: normalizeAcademicCode(intake.facultyCode),
    degreeCode: normalizeAcademicCode(intake.degreeCode),
  };
}

function toDependencyItem(
  input: {
    offeringId: string;
    intakeId: string;
    intakeName: string;
    facultyCode: string;
    degreeCode: string;
    termCode: string;
    syllabusVersion: string;
    assignedLecturerIds: string[];
    updatedAt: string;
  }
): ModuleDependencyItem {
  const normalizedFacultyCode = normalizeAcademicCode(input.facultyCode);
  const normalizedDegreeCode = normalizeAcademicCode(input.degreeCode);
  const facultyName = normalizedFacultyCode
    ? (findFaculty(normalizedFacultyCode)?.name ?? "")
    : "";
  const degreeRecord = normalizedDegreeCode
    ? findDegreeProgram(normalizedDegreeCode)
    : null;
  const lecturerCount = Array.isArray(input.assignedLecturerIds)
    ? input.assignedLecturerIds.filter((item) => Boolean(String(item ?? "").trim())).length
    : 0;

  return {
    offeringId: String(input.offeringId ?? ""),
    facultyCode: normalizedFacultyCode,
    facultyName,
    degreeId: normalizedDegreeCode,
    degreeCode: degreeRecord?.code ?? normalizedDegreeCode,
    intakeId: String(input.intakeId ?? ""),
    intakeName: String(input.intakeName ?? ""),
    termCode: String(input.termCode ?? ""),
    syllabusVersion: normalizeSyllabusVersion(input.syllabusVersion),
    lecturerCount,
    updatedAt: toIsoDate(input.updatedAt) || new Date().toISOString(),
  };
}

function normalizeDbOfferings(value: unknown): NormalizedDbOffering[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => {
      const normalizedRow = asObject(row);
      if (!normalizedRow) {
        return null;
      }

      const offeringId = String(
        normalizedRow._id ?? normalizedRow.id ?? ""
      ).trim();
      const intakeId = String(normalizedRow.intakeId ?? "").trim();
      const intakeName = String(normalizedRow.intakeName ?? "").trim();
      if (!offeringId || (!intakeId && !intakeName)) {
        return null;
      }

      const lecturerSource =
        normalizedRow.assignedLecturerIds ?? normalizedRow.assignedLecturers;
      const assignedLecturerIds = Array.isArray(lecturerSource)
        ? lecturerSource.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [];

      return {
        offeringId,
        intakeId,
        intakeName,
        facultyCode: normalizeAcademicCode(normalizedRow.facultyCode ?? normalizedRow.facultyId),
        degreeCode: normalizeAcademicCode(
          normalizedRow.degreeCode ?? normalizedRow.degreeProgramId
        ),
        termCode: String(normalizedRow.termCode ?? "").trim(),
        syllabusVersion: String(normalizedRow.syllabusVersion ?? "NEW"),
        moduleId: String(normalizedRow.moduleId ?? "").trim(),
        moduleCode: String(normalizedRow.moduleCode ?? "").trim().toUpperCase(),
        assignedLecturerIds,
        updatedAt: toIsoDate(normalizedRow.updatedAt),
      } satisfies NormalizedDbOffering;
    })
    .filter((row): row is NormalizedDbOffering => Boolean(row));
}

async function loadIntakesFromMongoose(
  intakeIds: string[]
): Promise<Map<string, IntakeLookup>> {
  const map = new Map<string, IntakeLookup>();
  const validObjectIds = intakeIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (validObjectIds.length === 0) {
    return map;
  }

  const objectIds = validObjectIds.map((id) => new mongoose.Types.ObjectId(id));
  const intakeRows = (await IntakeModel.find({
    _id: { $in: objectIds },
  })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  intakeRows.forEach((row) => {
    const normalizedRow = asObject(row);
    if (!normalizedRow) {
      return;
    }

    const intakeId = String(normalizedRow._id ?? "").trim();
    if (!intakeId) {
      return;
    }

    const intakeName = String(normalizedRow.name ?? "").trim();
    const facultyCode = normalizeAcademicCode(
      normalizedRow.facultyCode ?? normalizedRow.facultyId
    );
    const degreeCode = normalizeAcademicCode(
      normalizedRow.degreeCode ?? normalizedRow.degreeId
    );

    map.set(intakeId, {
      intakeId,
      intakeName,
      facultyCode,
      degreeCode,
    });
  });

  return map;
}

function buildStoreDependencies(offerings: ModuleOfferingRecord[]): ModuleDependencyItem[] {
  return offerings.map((offering) => {
    const intakeLookup = toIntakeLookupFromStore(offering.intakeId);

    return toDependencyItem({
      offeringId: offering.id,
      intakeId: offering.intakeId,
      intakeName: intakeLookup?.intakeName ?? offering.intakeName ?? "",
      facultyCode: intakeLookup?.facultyCode ?? offering.facultyCode ?? offering.facultyId,
      degreeCode:
        intakeLookup?.degreeCode ?? offering.degreeCode ?? offering.degreeProgramId,
      termCode: offering.termCode,
      syllabusVersion: offering.syllabusVersion,
      assignedLecturerIds:
        Array.isArray(offering.assignedLecturerIds) &&
        offering.assignedLecturerIds.length > 0
          ? offering.assignedLecturerIds
          : offering.assignedLecturers,
      updatedAt: offering.updatedAt,
    });
  });
}

async function buildMongooseDependencies(
  module: { id: string; code: string }
): Promise<ModuleDependencyItem[]> {
  const rows = (await ModuleOfferingModel.find({
    $or: [{ moduleId: module.id }, { moduleCode: module.code }],
  })
    .sort({ updatedAt: -1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const offerings = normalizeDbOfferings(rows);
  if (offerings.length === 0) {
    return [];
  }

  const intakeIds = Array.from(new Set(offerings.map((offering) => offering.intakeId)));
  const intakeLookupMap = await loadIntakesFromMongoose(intakeIds);

  return offerings.map((offering) => {
    const storeIntake = toIntakeLookupFromStore(offering.intakeId);
    const dbIntake = intakeLookupMap.get(offering.intakeId) ?? null;
    const intakeLookup = storeIntake ?? dbIntake;

    return toDependencyItem({
      offeringId: offering.offeringId,
      intakeId: offering.intakeId,
      intakeName: intakeLookup?.intakeName ?? offering.intakeName,
      facultyCode: intakeLookup?.facultyCode ?? offering.facultyCode,
      degreeCode: intakeLookup?.degreeCode ?? offering.degreeCode,
      termCode: offering.termCode,
      syllabusVersion: offering.syllabusVersion,
      assignedLecturerIds: offering.assignedLecturerIds,
      updatedAt: offering.updatedAt,
    });
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const moduleParam = String(params.id ?? "").trim();
  if (!moduleParam) {
    return NextResponse.json({ message: "Module id is required" }, { status: 400 });
  }
  const moduleRecord = findModuleById(moduleParam) ?? findModuleByCode(moduleParam);
  if (!moduleRecord) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }

  const storeRows = listModuleOfferings().filter(
    (offering) =>
      !offering.isDeleted &&
      (offering.moduleId === moduleRecord.id || offering.moduleCode === moduleRecord.code)
  );

  const mongooseDependencies = mongooseConnection
    ? await buildMongooseDependencies({
        id: moduleRecord.id,
        code: moduleRecord.code,
      })
    : [];
  const items =
    mongooseDependencies.length > 0
      ? mongooseDependencies
      : buildStoreDependencies(storeRows);

  return NextResponse.json({
    moduleId: moduleRecord.id,
    totalOfferings: items.length,
    items,
  });
}
