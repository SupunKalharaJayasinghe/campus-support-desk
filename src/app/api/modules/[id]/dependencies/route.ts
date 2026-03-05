import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Intake";
import "@/models/ModuleOffering";
import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import { findIntakeById } from "@/lib/intake-store";
import {
  listModuleOfferingsByModuleId,
  type ModuleOfferingRecord,
} from "@/lib/module-offering-store";
import { connectMongoose } from "@/lib/mongoose";
import { IntakeModel } from "@/models/Intake";
import { ModuleOfferingModel } from "@/models/ModuleOffering";

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
  termCode: string;
  syllabusVersion: string;
  assignedLecturers: string[];
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
    assignedLecturers: string[];
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
  const lecturerCount = Array.isArray(input.assignedLecturers)
    ? input.assignedLecturers.filter((item) => Boolean(String(item ?? "").trim())).length
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
      if (!offeringId || !intakeId) {
        return null;
      }

      const assignedLecturers = Array.isArray(normalizedRow.assignedLecturers)
        ? normalizedRow.assignedLecturers
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
        : [];

      return {
        offeringId,
        intakeId,
        termCode: String(normalizedRow.termCode ?? "").trim(),
        syllabusVersion: String(normalizedRow.syllabusVersion ?? "NEW"),
        assignedLecturers,
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
      intakeName: intakeLookup?.intakeName ?? "",
      facultyCode: intakeLookup?.facultyCode ?? "",
      degreeCode: intakeLookup?.degreeCode ?? "",
      termCode: offering.termCode,
      syllabusVersion: offering.syllabusVersion,
      assignedLecturers: offering.assignedLecturers,
      updatedAt: offering.updatedAt,
    });
  });
}

async function buildMongooseDependencies(
  moduleId: string
): Promise<ModuleDependencyItem[]> {
  const rows = (await ModuleOfferingModel.find({
    moduleId,
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
      intakeName: intakeLookup?.intakeName ?? "",
      facultyCode: intakeLookup?.facultyCode ?? "",
      degreeCode: intakeLookup?.degreeCode ?? "",
      termCode: offering.termCode,
      syllabusVersion: offering.syllabusVersion,
      assignedLecturers: offering.assignedLecturers,
      updatedAt: offering.updatedAt,
    });
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const moduleId = String(params.id ?? "").trim();
  if (!moduleId) {
    return NextResponse.json({ message: "Module id is required" }, { status: 400 });
  }

  const mongooseDependencies = mongooseConnection
    ? await buildMongooseDependencies(moduleId)
    : [];
  const items =
    mongooseDependencies.length > 0
      ? mongooseDependencies
      : buildStoreDependencies(listModuleOfferingsByModuleId(moduleId));

  return NextResponse.json({
    moduleId,
    totalOfferings: items.length,
    items,
  });
}
