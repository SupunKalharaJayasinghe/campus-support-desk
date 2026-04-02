import { NextResponse } from "next/server";
import "@/models/Module";
import { connectMongoose } from "@/models/mongoose";
import { ModuleModel } from "@/models/Module";
import {
  sanitizeApplicableDegrees,
  sanitizeApplicableTerms,
  sanitizeDefaultSyllabusVersion,
  sanitizeOutlineTemplate,
} from "@/models/module-store";

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
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

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);

  const facultyCode = String(searchParams.get("facultyCode") ?? "")
    .trim()
    .toUpperCase();
  const degreeId = String(searchParams.get("degreeId") ?? "")
    .trim()
    .toUpperCase();
  const termCode = String(searchParams.get("term") ?? "")
    .trim()
    .toUpperCase();

  if (!facultyCode) {
    return NextResponse.json(
      { message: "facultyCode is required" },
      { status: 400 }
    );
  }

  if (!degreeId) {
    return NextResponse.json(
      { message: "degreeId is required" },
      { status: 400 }
    );
  }

  if (!termCode) {
    return NextResponse.json(
      { message: "term is required" },
      { status: 400 }
    );
  }

  const rows = (await ModuleModel.find(
    {
      facultyCode,
      applicableDegrees: degreeId,
      applicableTerms: termCode,
    },
    {
      code: 1,
      name: 1,
      credits: 1,
      facultyCode: 1,
      applicableTerms: 1,
      applicableDegrees: 1,
      defaultSyllabusVersion: 1,
      outlineTemplate: 1,
      createdAt: 1,
      updatedAt: 1,
    }
  )
    .sort({ code: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toModuleRecordFromUnknown(row))
    .filter((row): row is NonNullable<ReturnType<typeof toModuleRecordFromUnknown>> =>
      Boolean(row)
    );

  return NextResponse.json({ items });
}
