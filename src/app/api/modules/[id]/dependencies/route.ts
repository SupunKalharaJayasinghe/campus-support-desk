import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Module";
import "@/models/ModuleOffering";
import "@/models/Faculty";
import { connectMongoose } from "@/models/mongoose";
import { FacultyModel } from "@/models/Faculty";
import { ModuleModel } from "@/models/Module";
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

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toModuleLookup(value: unknown) {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  const code = normalizeModuleCode(row.code);
  if (!id || !code) {
    return null;
  }

  return { id, code };
}

async function findModuleDocument(moduleParam: string) {
  if (!moduleParam) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(moduleParam)) {
    const byId = await ModuleModel.findById(moduleParam).lean().exec().catch(() => null);
    if (byId) {
      return byId;
    }
  }

  const code = normalizeModuleCode(moduleParam);
  if (!code) {
    return null;
  }

  return ModuleModel.findOne({ code }).lean().exec().catch(() => null);
}

function lecturerCountFromOffering(row: Record<string, unknown>) {
  if (Array.isArray(row.assignedLecturerIds)) {
    return row.assignedLecturerIds
      .map((item) => String(item ?? "").trim())
      .filter(Boolean).length;
  }

  if (Array.isArray(row.assignedLecturers)) {
    return row.assignedLecturers
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }
        const one = item as Record<string, unknown>;
        return String(one.lecturerId ?? one.id ?? one._id ?? "").trim();
      })
      .filter(Boolean).length;
  }

  return 0;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const moduleParam = String(params.id ?? "").trim();
  if (!moduleParam) {
    return NextResponse.json({ message: "Module id is required" }, { status: 400 });
  }

  const moduleLookup = toModuleLookup(await findModuleDocument(moduleParam));
  if (!moduleLookup) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }

  const offeringRows = (await ModuleOfferingModel.find({
    $or: [{ moduleId: moduleLookup.id }, { moduleCode: moduleLookup.code }],
  })
    .sort({ updatedAt: -1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const offerings = offeringRows
    .map((row) => asObject(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  const facultyCodes = Array.from(
    new Set(
      offerings
        .map((row) => normalizeAcademicCode(row.facultyCode ?? row.facultyId))
        .filter(Boolean)
    )
  );

  const facultyRows = (await FacultyModel.find(
    { code: { $in: facultyCodes }, isDeleted: { $ne: true } },
    { code: 1, name: 1 }
  )
    .lean()
    .exec()
    .catch(() => [])) as Array<{ code?: string; name?: string }>;
  const facultyNameByCode = new Map(
    facultyRows
      .map((row) => [normalizeAcademicCode(row.code), String(row.name ?? "").trim()] as const)
      .filter(([code]) => Boolean(code))
  );

  const items: ModuleDependencyItem[] = offerings.map((row) => {
    const offeringId = String(row._id ?? row.id ?? "").trim();
    const facultyCode = normalizeAcademicCode(row.facultyCode ?? row.facultyId);
    const degreeCode = normalizeAcademicCode(row.degreeCode ?? row.degreeProgramId);
    const intakeId = String(row.intakeId ?? "").trim();
    const intakeName = String(row.intakeName ?? "").trim() || intakeId;

    return {
      offeringId,
      facultyCode,
      facultyName: facultyNameByCode.get(facultyCode) ?? "",
      degreeId: degreeCode,
      degreeCode,
      intakeId,
      intakeName,
      termCode: String(row.termCode ?? "").trim(),
      syllabusVersion: String(row.syllabusVersion ?? "NEW").trim() || "NEW",
      lecturerCount: lecturerCountFromOffering(row),
      updatedAt: toIsoDate(row.updatedAt) || new Date().toISOString(),
    };
  });

  return NextResponse.json({
    moduleId: moduleLookup.id,
    totalOfferings: items.length,
    items,
  });
}
