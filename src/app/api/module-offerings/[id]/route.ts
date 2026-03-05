import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/lib/mongoose";
import {
  deleteModuleOffering,
  findModuleOfferingById,
  updateModuleOffering,
  type SyllabusVersion,
} from "@/lib/module-offering-store";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await connectMongoose().catch(() => null);
  const offering = findModuleOfferingById(params.id);
  if (!offering) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  return NextResponse.json(offering);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongoose().catch(() => null);
    const body = (await request.json()) as Partial<{
      syllabusVersion: SyllabusVersion;
      assignedLecturers: string[];
    }>;

    const updated = updateModuleOffering(params.id, {
      syllabusVersion: body.syllabusVersion,
      assignedLecturers: body.assignedLecturers,
    });
    if (!updated) {
      return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { message: "Failed to update module offering" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await connectMongoose().catch(() => null);
  const deleted = deleteModuleOffering(params.id);
  if (!deleted) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
