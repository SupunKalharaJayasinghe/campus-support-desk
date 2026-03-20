import { NextResponse } from "next/server";
import {
  deleteFaculty,
  sanitizeFacultyCode,
  sanitizeFacultyStatus,
  type FacultyStatus,
  updateFaculty,
} from "@/lib/faculty-store";

export async function PUT(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const targetCode = sanitizeFacultyCode(params.code);
    const body = (await request.json()) as Partial<{
      name: string;
      status: FacultyStatus;
    }>;
    const name = String(body.name ?? "").trim();
    const status = sanitizeFacultyStatus(body.status);

    if (!targetCode) {
      return NextResponse.json(
        { message: "Faculty code is required" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { message: "Faculty name is required" },
        { status: 400 }
      );
    }

    const faculty = updateFaculty(targetCode, {
      name,
      status,
    });

    if (!faculty) {
      return NextResponse.json(
        { message: "Faculty not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(faculty);
  } catch {
    return NextResponse.json(
      { message: "Failed to update faculty." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const targetCode = sanitizeFacultyCode(params.code);
    const deleted = deleteFaculty(targetCode);

    if (!deleted) {
      return NextResponse.json(
        { message: "Faculty not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Failed to delete faculty." },
      { status: 500 }
    );
  }
}
