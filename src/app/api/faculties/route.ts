import { NextResponse } from "next/server";
import "@/models/Faculty";
import { FacultyModel } from "@/models/Faculty";
import { syncAcademicReferenceCaches } from "@/models/academic-reference-cache";
import { connectMongoose } from "@/models/mongoose";
import {
  findFaculty,
  listFaculties,
  sanitizeFacultyCode,
  sanitizeFacultyStatus,
  type FacultyStatus,
} from "@/models/faculty-store";

export async function GET() {
  const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  return NextResponse.json(listFaculties());
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
      status: FacultyStatus;
    }>;

    const code = sanitizeFacultyCode(body.code);
    const name = String(body.name ?? "").trim();
    const status = sanitizeFacultyStatus(body.status);

    if (!/^[A-Z]{2,6}$/.test(code)) {
      return NextResponse.json(
        { message: "Use 2–6 uppercase letters" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { message: "Faculty name is required" },
        { status: 400 }
      );
    }

    if (findFaculty(code)) {
      return NextResponse.json(
        { message: "Faculty code already exists" },
        { status: 409 }
      );
    }

    try {
      await FacultyModel.create({
        code,
        name,
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
          { message: "Faculty code already exists" },
          { status: 409 }
        );
      }

      throw error;
    }

    await syncAcademicReferenceCaches({ force: true }).catch(() => null);
    const created = findFaculty(code);
    if (!created) {
      return NextResponse.json(
        { message: "Failed to create faculty." },
        { status: 500 }
      );
    }

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Failed to create faculty." },
      { status: 500 }
    );
  }
}

