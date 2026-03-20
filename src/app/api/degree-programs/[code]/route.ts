import { NextResponse } from "next/server";
import {
  deleteDegreeProgram,
  isValidFacultyCode,
  sanitizeCredits,
  sanitizeDegreeProgramCode,
  sanitizeDegreeProgramStatus,
  sanitizeDurationYears,
  type DegreeProgramStatus,
  updateDegreeProgram,
} from "@/lib/degree-program-store";

export async function PUT(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const targetCode = sanitizeDegreeProgramCode(params.code);
    const body = (await request.json()) as Partial<{
      name: string;
      facultyCode: string;
      award: string;
      credits: number;
      durationYears: number;
      status: DegreeProgramStatus;
    }>;

    const name = String(body.name ?? "").trim();
    const facultyCode = String(body.facultyCode ?? "").trim().toUpperCase();
    const award = String(body.award ?? "").trim();
    const credits = sanitizeCredits(body.credits);
    const durationYears = sanitizeDurationYears(body.durationYears);
    const status = sanitizeDegreeProgramStatus(body.status);

    if (!targetCode) {
      return NextResponse.json(
        { message: "Program code is required" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { message: "Program name is required" },
        { status: 400 }
      );
    }

    if (!facultyCode || !isValidFacultyCode(facultyCode)) {
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

    const program = updateDegreeProgram(targetCode, {
      award,
      credits,
      durationYears,
      facultyCode,
      name,
      status,
    });

    if (!program) {
      return NextResponse.json(
        { message: "Program not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(program);
  } catch {
    return NextResponse.json(
      { message: "Failed to update degree program." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const targetCode = sanitizeDegreeProgramCode(params.code);
    const deleted = deleteDegreeProgram(targetCode);

    if (!deleted) {
      return NextResponse.json(
        { message: "Program not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Failed to delete degree program." },
      { status: 500 }
    );
  }
}
