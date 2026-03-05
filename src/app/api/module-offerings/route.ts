import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/lib/mongoose";
import {
  createModuleOffering,
  listModuleOfferings,
  type SyllabusVersion,
} from "@/lib/module-offering-store";
import type { TermCode } from "@/lib/intake-store";

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

export async function GET(request: Request) {
  await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);
  const intakeId = String(searchParams.get("intakeId") ?? "").trim();
  const termCode = String(searchParams.get("termCode") ?? "").trim() as TermCode;
  const search = String(searchParams.get("search") ?? "").trim();
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 25);
  const allItems = listModuleOfferings({ intakeId, termCode, search });

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
      intakeId: string;
      termCode: TermCode;
      moduleId: string;
      syllabusVersion: SyllabusVersion;
      assignedLecturers: string[];
    }>;

    if (!body.moduleId) {
      return NextResponse.json({ message: "Module is required" }, { status: 400 });
    }

    if (!body.syllabusVersion) {
      return NextResponse.json(
        { message: "Syllabus Version is required" },
        { status: 400 }
      );
    }

    const created = createModuleOffering({
      intakeId: String(body.intakeId ?? ""),
      termCode: String(body.termCode ?? "") as TermCode,
      moduleId: String(body.moduleId ?? ""),
      syllabusVersion: body.syllabusVersion,
      assignedLecturers: body.assignedLecturers ?? [],
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to assign module",
      },
      { status: 400 }
    );
  }
}
