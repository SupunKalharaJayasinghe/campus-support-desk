import { NextResponse } from "next/server";
import "@/models/Module";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import { findDegreeProgram } from "@/models/degree-program-store";
import { findFaculty } from "@/models/faculty-store";
import { listModuleOfferingsByModuleId } from "@/models/module-offering-store";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import {
  deleteModule,
  findModuleById,
  sanitizeApplicableDegrees,
  sanitizeApplicableTerms,
  sanitizeDefaultSyllabusVersion,
  sanitizeOutlineTemplate,
  updateModule,
  type ApplicableTermCode,
  type ModuleOutlineTemplateItem,
  type SyllabusVersion,
} from "@/models/module-store";

function hasSameItems(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);
  return right.every((item) => leftSet.has(item));
}

async function countModuleDependencies(moduleId: string, useMongoose: boolean) {
  const storeCount = listModuleOfferingsByModuleId(moduleId).length;

  if (!useMongoose) {
    return storeCount;
  }

  const dbCount = await ModuleOfferingModel.countDocuments({ moduleId }).catch(() => 0);

  return dbCount > 0 ? dbCount : storeCount;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await connectMongoose().catch(() => null);
  const moduleId = String(params.id ?? "").trim();
  const moduleRecord = findModuleById(moduleId);
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
    const moduleId = String(params.id ?? "").trim();
    const currentModule = findModuleById(moduleId);
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
    const facultyCode = String(body.facultyCode ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 6);
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

    if (!facultyCode || !findFaculty(facultyCode)) {
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

    const invalidDegree = applicableDegrees.find((degreeCode) => {
      const degree = findDegreeProgram(degreeCode);
      return !degree || degree.facultyCode !== facultyCode;
    });
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

    const dependencyCount = await countModuleDependencies(
      moduleId,
      Boolean(mongooseConnection)
    );
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

    const updated = updateModule(moduleId, {
      name,
      credits,
      facultyCode,
      applicableTerms,
      applicableDegrees,
      defaultSyllabusVersion,
      outlineTemplate,
    });
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
  const moduleId = String(params.id ?? "").trim();
  const moduleRecord = findModuleById(moduleId);
  if (!moduleRecord) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }

  const dependencyCount = await countModuleDependencies(
    moduleId,
    Boolean(mongooseConnection)
  );
  if (dependencyCount > 0) {
    return NextResponse.json({ message: "Module is assigned" }, { status: 409 });
  }

  const deleted = deleteModule(moduleId);
  if (!deleted) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
