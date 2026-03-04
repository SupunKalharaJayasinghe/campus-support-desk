import { NextResponse } from "next/server";
import {
  createFaculty,
  listFaculties,
  sanitizeFacultyCode,
  sanitizeFacultyStatus,
  type FacultyStatus,
  findFaculty,
} from "@/lib/faculty-store";

export async function GET() {
  return NextResponse.json(listFaculties());
}

export async function POST(request: Request) {
  try {
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

    return NextResponse.json(
      createFaculty({
        code,
        name,
        status,
      }),
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { message: "Failed to create faculty." },
      { status: 500 }
    );
  }
}
