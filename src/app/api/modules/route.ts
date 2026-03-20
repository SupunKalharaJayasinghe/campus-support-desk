import { NextResponse } from "next/server";
import "@/models/Module";
import { connectMongoose } from "@/lib/mongoose";
import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import {
  createModule,
  findModuleByCode,
  listModules,
  sanitizeApplicableDegrees,
  sanitizeApplicableTerms,
  sanitizeDefaultSyllabusVersion,
  sanitizeOutlineTemplate,
  type ApplicableTermCode,
  type ModuleOutlineTemplateItem,
  type ModuleSort,
  type SyllabusVersion,
} from "@/lib/module-store";

function parsePageParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parsePageSizeParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const nextValue = Math.floor(parsed);
  if (![10, 25, 50, 100].includes(nextValue)) {
    return fallback;
  }

  return nextValue;
}

function sanitizeSort(value: string | null): ModuleSort {
  if (value === "az" || value === "za" || value === "created") {
    return value;
  }

  return "updated";
}

function sanitizeCodeList(value: string | null) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((item) =>
          String(item ?? "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .slice(0, 6)
        )
        .filter(Boolean)
    )
  );
}

export async function GET(request: Request) {
  await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const facultyCode = String(searchParams.get("facultyCode") ?? "")
    .trim()
    .toUpperCase();
  const degreeId = String(searchParams.get("degreeId") ?? "")
    .trim()
    .toUpperCase();
  const facultyIds = sanitizeCodeList(searchParams.get("facultyIds"));
  const degreeIds = sanitizeCodeList(searchParams.get("degreeIds"));
  const termCode = String(searchParams.get("term") ?? "")
    .trim()
    .toUpperCase() as ApplicableTermCode;
  const sort = sanitizeSort(searchParams.get("sort"));
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 25);
  const allItems = listModules({
    search,
    sort,
    facultyCode: facultyIds.length === 1 ? facultyIds[0] : facultyCode,
    degreeId: degreeIds.length === 1 ? degreeIds[0] : degreeId,
    termCode,
  }).filter((item) => {
    if (facultyIds.length > 0 && !facultyIds.includes(item.facultyCode)) {
      return false;
    }

    if (
      degreeIds.length > 0 &&
      !degreeIds.some((degreeItem) => item.applicableDegrees.includes(degreeItem))
    ) {
      return false;
    }

    return true;
  });

  const total = allItems.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(parsePageParam(searchParams.get("page"), 1), pageCount);
  const start = (page - 1) * pageSize;

  return NextResponse.json({
    items: allItems.slice(start, start + pageSize),
    page,
    pageSize,
    total,
  });
}

export async function POST(request: Request) {
  try {
    await connectMongoose().catch(() => null);
    const body = (await request.json()) as Partial<{
      code: string;
      name: string;
      credits: number;
      facultyCode: string;
      applicableTerms: ApplicableTermCode[];
      applicableDegrees: string[];
      defaultSyllabusVersion: SyllabusVersion;
      outlineTemplate: ModuleOutlineTemplateItem[];
    }>;

    const code = String(body.code ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10);
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

    if (!code) {
      return NextResponse.json({ message: "Module code is required" }, { status: 400 });
    }

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

    if (findModuleByCode(code)) {
      return NextResponse.json({ message: "Module code already exists" }, { status: 409 });
    }

    return NextResponse.json(
      createModule({
        code,
        name,
        credits,
        facultyCode,
        applicableTerms,
        applicableDegrees,
        defaultSyllabusVersion,
        outlineTemplate,
      }),
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ message: "Failed to create module" }, { status: 500 });
  }
}
