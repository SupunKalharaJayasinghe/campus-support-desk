import { NextResponse } from "next/server";
import "@/models/DegreeProgram";
import { DegreeProgramModel } from "@/models/DegreeProgram";
import { syncAcademicReferenceCaches } from "@/models/academic-reference-cache";
import { findFaculty } from "@/models/faculty-store";
import { connectMongoose } from "@/models/mongoose";
import {
  findDegreeProgram,
  sanitizeCredits,
  sanitizeDegreeProgramCode,
  sanitizeDegreeProgramStatus,
  sanitizeDurationYears,
  type DegreeProgramStatus,
} from "@/models/degree-program-store";

export async function PUT(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "MongoDB connection is required" },
        { status: 503 }
      );
    }

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

    const updated = await DegreeProgramModel.findOneAndUpdate(
      { code: targetCode, isDeleted: { $ne: true } },
      {
        $set: {
          name,
          facultyCode,
          award,
          credits,
          durationYears,
          status,
        },
      },
      { new: true }
    )
      .lean()
      .exec()
      .catch(() => null);

    if (!updated) {
      return NextResponse.json(
        { message: "Program not found" },
        { status: 404 }
      );
    }

    await syncAcademicReferenceCaches({ force: true }).catch(() => null);
    return NextResponse.json(findDegreeProgram(targetCode));
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
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "MongoDB connection is required" },
        { status: 503 }
      );
    }

    const targetCode = sanitizeDegreeProgramCode(params.code);
    const deleted = await DegreeProgramModel.findOneAndUpdate(
      { code: targetCode, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
        },
      },
      { new: true }
    )
      .lean()
      .exec()
      .catch(() => null);

    if (!deleted) {
      return NextResponse.json(
        { message: "Program not found" },
        { status: 404 }
      );
    }

    await syncAcademicReferenceCaches({ force: true }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Failed to delete degree program." },
      { status: 500 }
    );
  }
}
