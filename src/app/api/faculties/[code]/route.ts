import { NextResponse } from "next/server";
import "@/models/Faculty";
import { FacultyModel } from "@/models/Faculty";
import { syncAcademicReferenceCaches } from "@/models/academic-reference-cache";
import { connectMongoose } from "@/models/mongoose";
import {
  findFaculty,
  sanitizeFacultyCode,
  sanitizeFacultyStatus,
  type FacultyStatus,
} from "@/models/faculty-store";

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

    const updated = await FacultyModel.findOneAndUpdate(
      { code: targetCode, isDeleted: { $ne: true } },
      {
        $set: {
          name,
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
        { message: "Faculty not found" },
        { status: 404 }
      );
    }

    await syncAcademicReferenceCaches({ force: true }).catch(() => null);
    return NextResponse.json(findFaculty(targetCode));
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
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "MongoDB connection is required" },
        { status: 503 }
      );
    }

    const targetCode = sanitizeFacultyCode(params.code);
    const deleted = await FacultyModel.findOneAndUpdate(
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
        { message: "Faculty not found" },
        { status: 404 }
      );
    }

    await syncAcademicReferenceCaches({ force: true }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Failed to delete faculty." },
      { status: 500 }
    );
  }
}
