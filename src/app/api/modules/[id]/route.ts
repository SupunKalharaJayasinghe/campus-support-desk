import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Module";
import "@/models/ModuleOffering";
import "@/models/Faculty";
import "@/models/DegreeProgram";
import { connectMongoose } from "@/models/mongoose";
import { DegreeProgramModel } from "@/models/DegreeProgram";
import { FacultyModel } from "@/models/Faculty";
import { ModuleModel } from "@/models/Module";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import {
  sanitizeApplicableDegrees,
  sanitizeApplicableTerms,
  sanitizeDefaultSyllabusVersion,
  sanitizeOutlineTemplate,
  type ApplicableTermCode,
  type ModuleOutlineTemplateItem,
  type SyllabusVersion,
} from "@/models/module-store";

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
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

function toModuleRecordFromUnknown(value: unknown) {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  const code = normalizeModuleCode(row.code);
  const name = String(row.name ?? "").trim();
  const credits = Math.max(0, Number(row.credits) || 0);
  const facultyCode = normalizeAcademicCode(row.facultyCode);

  if (!id || !code || !name || !facultyCode || credits <= 0) {
    return null;
  }

  return {
    id,
    code,
    name,
    credits,
    facultyCode,
    applicableTerms: sanitizeApplicableTerms(row.applicableTerms),
    applicableDegrees: sanitizeApplicableDegrees(row.applicableDegrees),
    defaultSyllabusVersion: sanitizeDefaultSyllabusVersion(row.defaultSyllabusVersion),
    outlineTemplate: sanitizeOutlineTemplate(row.outlineTemplate),
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

function hasSameItems(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);
  return right.every((item) => leftSet.has(item));
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

async function countModuleDependencies(module: { id: string; code: string }) {
  return ModuleOfferingModel.countDocuments({
    $or: [{ moduleId: module.id }, { moduleCode: module.code }],
  }).catch(() => 0);
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

  const moduleId = String(params.id ?? "").trim();
  const row = await findModuleDocument(moduleId);
  const moduleRecord = toModuleRecordFromUnknown(row);
  if (!moduleRecord) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }

  return NextResponse.json(moduleRecord);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const moduleParam = String(params.id ?? "").trim();
    const currentRow = await findModuleDocument(moduleParam);
    const currentModule = toModuleRecordFromUnknown(currentRow);
    if (!currentModule) {
      return NextResponse.json({ message: "Module not found" }, { status: 404 });
    }

    const body = (await request.json()) as Partial<{
      name: string;
      credits: number;
      facultyCode: string;
      applicableTerms: ApplicableTermCode[];
      applicableDegrees: string[];
      defaultSyllabusVersion: SyllabusVersion;
      outlineTemplate: ModuleOutlineTemplateItem[];
    }>;

    const name = String(body.name ?? "").trim();
    const credits = Number(body.credits);
    const facultyCode = normalizeAcademicCode(body.facultyCode);
    const applicableTerms = sanitizeApplicableTerms(body.applicableTerms);
    const applicableDegrees = sanitizeApplicableDegrees(body.applicableDegrees);
    const hasExplicitSyllabusValue =
      body.defaultSyllabusVersion === "OLD" || body.defaultSyllabusVersion === "NEW";
    const defaultSyllabusVersion = sanitizeDefaultSyllabusVersion(
      body.defaultSyllabusVersion
    );
    const outlineTemplate = sanitizeOutlineTemplate(body.outlineTemplate);

    if (!name) {
      return NextResponse.json({ message: "Module name is required" }, { status: 400 });
    }

    if (!Number.isFinite(credits) || credits <= 0) {
      return NextResponse.json({ message: "Credits must be greater than 0" }, { status: 400 });
    }

    const facultyExists = await FacultyModel.exists({
      code: facultyCode,
      isDeleted: { $ne: true },
    }).catch(() => null);

    if (!facultyCode || !facultyExists) {
      return NextResponse.json(
        { message: "Select a valid faculty" },
        { status: 400 }
      );
    }

    if (applicableTerms.length === 0) {
      return NextResponse.json(
        { message: "Select at least one applicable term" },
        { status: 400 }
      );
    }

    if (applicableDegrees.length === 0) {
      return NextResponse.json(
        { message: "Select at least one applicable degree" },
        { status: 400 }
      );
    }

    const validDegreeRows = (await DegreeProgramModel.find(
      {
        code: { $in: applicableDegrees },
        facultyCode,
        isDeleted: { $ne: true },
      },
      { code: 1 }
    )
      .lean()
      .exec()
      .catch(() => [])) as Array<{ code?: string }>;

    const validDegreeSet = new Set(
      validDegreeRows
        .map((item) => normalizeAcademicCode(item.code))
        .filter(Boolean)
    );

    const invalidDegree = applicableDegrees.find((degreeCode) => !validDegreeSet.has(degreeCode));
    if (invalidDegree) {
      return NextResponse.json(
        { message: `Invalid degree mapping for ${invalidDegree}` },
        { status: 400 }
      );
    }

    if (!hasExplicitSyllabusValue) {
      return NextResponse.json(
        { message: "Default syllabus version is required" },
        { status: 400 }
      );
    }

    const dependencyCount = await countModuleDependencies({
      id: currentModule.id,
      code: currentModule.code,
    });
    if (dependencyCount > 0) {
      const isFacultyChanged = currentModule.facultyCode !== facultyCode;
      const isTermsChanged = !hasSameItems(
        currentModule.applicableTerms,
        applicableTerms
      );
      const isDegreesChanged = !hasSameItems(
        currentModule.applicableDegrees,
        applicableDegrees
      );

      if (isFacultyChanged || isTermsChanged || isDegreesChanged) {
        return NextResponse.json(
          {
            message:
              "This module is assigned. Faculty, applicable degrees, and applicable terms are locked.",
          },
          { status: 409 }
        );
      }
    }

    const updatedRow = await ModuleModel.findByIdAndUpdate(
      currentModule.id,
      {
        $set: {
          name,
          credits: Math.floor(credits),
          facultyCode,
          applicableTerms,
          applicableDegrees,
          defaultSyllabusVersion,
          outlineTemplate,
        },
      },
      { new: true }
    )
      .lean()
      .exec()
      .catch(() => null);

    const updated = toModuleRecordFromUnknown(updatedRow);
    if (!updated) {
      return NextResponse.json({ message: "Module not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ message: "Failed to update module" }, { status: 500 });
  }
}

export async function DELETE(
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
  const row = await findModuleDocument(moduleParam);
  const moduleRecord = toModuleRecordFromUnknown(row);
  if (!moduleRecord) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }

  const dependencyCount = await countModuleDependencies({
    id: moduleRecord.id,
    code: moduleRecord.code,
  });
  if (dependencyCount > 0) {
    return NextResponse.json({ message: "Module is assigned" }, { status: 409 });
  }

  await ModuleModel.deleteOne({ _id: moduleRecord.id }).catch(() => null);

  return NextResponse.json({ ok: true });
}
