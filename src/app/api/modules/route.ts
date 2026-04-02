import { NextResponse } from "next/server";
import "@/models/Module";
import "@/models/Faculty";
import "@/models/DegreeProgram";
import { connectMongoose } from "@/models/mongoose";
import { DegreeProgramModel } from "@/models/DegreeProgram";
import { FacultyModel } from "@/models/Faculty";
import { ModuleModel } from "@/models/Module";
import {
  sanitizeApplicableDegrees,
  sanitizeApplicableTerms,
  sanitizeDefaultSyllabusVersion,
  sanitizeOutlineTemplate,
  type ApplicableTermCode,
  type ModuleOutlineTemplateItem,
  type ModuleSort,
  type SyllabusVersion,
} from "@/models/module-store";

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

  const applicableTerms = sanitizeApplicableTerms(row.applicableTerms);
  const applicableDegrees = sanitizeApplicableDegrees(row.applicableDegrees);

  return {
    id,
    code,
    name,
    credits,
    facultyCode,
    applicableTerms,
    applicableDegrees,
    defaultSyllabusVersion: sanitizeDefaultSyllabusVersion(row.defaultSyllabusVersion),
    outlineTemplate: sanitizeOutlineTemplate(row.outlineTemplate),
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = String(searchParams.get("search") ?? "").trim();
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
  const page = parsePageParam(searchParams.get("page"), 1);

  const query: Record<string, unknown> = {};

  const effectiveFacultyCodes = facultyIds.length > 0 ? facultyIds : facultyCode ? [facultyCode] : [];
  if (effectiveFacultyCodes.length === 1) {
    query.facultyCode = effectiveFacultyCodes[0];
  } else if (effectiveFacultyCodes.length > 1) {
    query.facultyCode = { $in: effectiveFacultyCodes };
  }

  const effectiveDegreeCodes = degreeIds.length > 0 ? degreeIds : degreeId ? [degreeId] : [];
  if (effectiveDegreeCodes.length === 1) {
    query.applicableDegrees = effectiveDegreeCodes[0];
  } else if (effectiveDegreeCodes.length > 1) {
    query.applicableDegrees = { $in: effectiveDegreeCodes };
  }

  if (termCode) {
    query.applicableTerms = termCode;
  }

  if (search) {
    const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ code: searchRegex }, { name: searchRegex }];
  }

  const sortQuery: Record<string, 1 | -1> =
    sort === "az"
      ? { code: 1 }
      : sort === "za"
        ? { code: -1 }
        : sort === "created"
          ? { createdAt: -1 }
          : { updatedAt: -1 };

  const total = await ModuleModel.countDocuments(query).catch(() => 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const skip = (safePage - 1) * pageSize;

  const rows = (await ModuleModel.find(query)
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toModuleRecordFromUnknown(row))
    .filter((row): row is NonNullable<ReturnType<typeof toModuleRecordFromUnknown>> =>
      Boolean(row)
    );

  return NextResponse.json({
    items,
    page: safePage,
    pageSize,
    total,
  });
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

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

    const code = normalizeModuleCode(body.code);
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

    if (!code) {
      return NextResponse.json({ message: "Module code is required" }, { status: 400 });
    }

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

    const existing = await ModuleModel.exists({ code }).catch(() => null);
    if (existing) {
      return NextResponse.json({ message: "Module code already exists" }, { status: 409 });
    }

    const created = await ModuleModel.create({
      code,
      name,
      credits: Math.floor(credits),
      facultyCode,
      applicableTerms,
      applicableDegrees,
      defaultSyllabusVersion,
      outlineTemplate,
    });

    const record = toModuleRecordFromUnknown(created.toObject());
    if (!record) {
      throw new Error("Failed to map created module");
    }

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return NextResponse.json({ message: "Module code already exists" }, { status: 409 });
    }

    return NextResponse.json({ message: "Failed to create module" }, { status: 500 });
  }
}
