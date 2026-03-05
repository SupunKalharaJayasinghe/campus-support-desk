import { NextResponse } from "next/server";
import "@/models/Module";
import { connectMongoose } from "@/lib/mongoose";
import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
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
} from "@/lib/module-store";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await connectMongoose().catch(() => null);
  const moduleRecord = findModuleById(params.id);
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
    await connectMongoose().catch(() => null);
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

    const updated = updateModule(params.id, {
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
  await connectMongoose().catch(() => null);
  const deleted = deleteModule(params.id);
  if (!deleted) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
