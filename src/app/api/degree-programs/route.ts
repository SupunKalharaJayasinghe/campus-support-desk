import { NextResponse } from "next/server";
import "@/models/DegreeProgram";
import { DegreeProgramModel } from "@/models/DegreeProgram";
import { syncAcademicReferenceCaches } from "@/models/academic-reference-cache";
import { findFaculty } from "@/models/faculty-store";
import { connectMongoose } from "@/models/mongoose";
import {
  findDegreeProgram,
  listDegreePrograms,
  sanitizeCredits,
  sanitizeDegreeProgramCode,
  sanitizeDegreeProgramStatus,
  sanitizeDurationYears,
  type DegreeProgramRecord,
  type DegreeProgramSort,
  type DegreeProgramStatus,
} from "@/models/degree-program-store";

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

function sanitizeSort(value: string | null): DegreeProgramSort {
  if (value === "az" || value === "za" || value === "created") {
    return value;
  }

  return "updated";
}

function sanitizeStatus(value: string | null): "" | DegreeProgramStatus {
  if (value === "ACTIVE" || value === "INACTIVE" || value === "DRAFT") {
    return value;
  }

  return "";
}

function sanitizePositiveNumber(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.floor(parsed);
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
  const search = searchParams.get("search") ?? "";
  const faculty = String(searchParams.get("faculty") ?? "")
    .trim()
    .toUpperCase();
  const code = sanitizeDegreeProgramCode(searchParams.get("code"));
  const award = String(searchParams.get("award") ?? "").trim();
  const creditsMin = sanitizePositiveNumber(searchParams.get("creditsMin"));
  const creditsMax = sanitizePositiveNumber(searchParams.get("creditsMax"));
  const durationYears = sanitizePositiveNumber(searchParams.get("durationYears"));
  const status = sanitizeStatus(searchParams.get("status"));
  const sort = sanitizeSort(searchParams.get("sort"));
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);

  const allItems = listDegreePrograms({
    award,
    code,
    creditsMax,
    creditsMin,
    durationYears,
    faculty,
    search,
    sort,
    status,
  });

  const totalCount = allItems.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(parsePageParam(searchParams.get("page"), 1), pageCount);
  const start = (page - 1) * pageSize;

  return NextResponse.json({
    items: allItems.slice(start, start + pageSize),
    page,
    pageSize,
    totalCount,
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
      facultyCode: string;
      award: string;
      credits: number;
      durationYears: number;
      status: DegreeProgramStatus;
    }>;

    const code = sanitizeDegreeProgramCode(body.code);
    const name = String(body.name ?? "").trim();
    const facultyCode = String(body.facultyCode ?? "").trim().toUpperCase();
    const award = String(body.award ?? "").trim();
    const credits = sanitizeCredits(body.credits);
    const durationYears = sanitizeDurationYears(body.durationYears);
    const status = sanitizeDegreeProgramStatus(body.status);

    if (!/^[A-Z]{2,6}$/.test(code)) {
      return NextResponse.json(
        { message: "Use 2–6 uppercase letters" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { message: "Program name is required" },
        { status: 400 }
      );
    }

    if (!facultyCode || !findFaculty(facultyCode)) {
      return NextResponse.json(
        { message: "Select a valid faculty" },
        { status: 400 }
      );
    }

    if (!award) {
      return NextResponse.json(
        { message: "Award is required" },
        { status: 400 }
      );
    }

    if (credits <= 0) {
      return NextResponse.json(
        { message: "Credits must be greater than 0" },
        { status: 400 }
      );
    }

    if (durationYears <= 0) {
      return NextResponse.json(
        { message: "Select a valid duration" },
        { status: 400 }
      );
    }

    if (findDegreeProgram(code)) {
      return NextResponse.json(
        { message: "Program code already exists" },
        { status: 409 }
      );
    }

    try {
      await DegreeProgramModel.create({
        code,
        name,
        facultyCode,
        award,
        credits,
        durationYears,
        status,
        isDeleted: false,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        Number((error as { code?: unknown }).code) === 11000
      ) {
        return NextResponse.json(
          { message: "Program code already exists" },
          { status: 409 }
        );
      }

      throw error;
    }

    await syncAcademicReferenceCaches({ force: true }).catch(() => null);
    const created = findDegreeProgram(code) as DegreeProgramRecord | null;
    if (!created) {
      return NextResponse.json(
        { message: "Failed to create degree program." },
        { status: 500 }
      );
    }

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Failed to create degree program." },
      { status: 500 }
    );
  }
}

