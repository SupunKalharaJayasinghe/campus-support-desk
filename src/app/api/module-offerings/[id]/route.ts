import { NextResponse } from "next/server";
import mongoose from "mongoose";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/lib/mongoose";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import {
  deleteModuleOffering,
  findModuleOfferingById,
  hasModuleOfferingProgress,
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
  const mongooseConnection = await connectMongoose().catch(() => null);
  const offeringId = String(params.id ?? "").trim();

  if (mongooseConnection && mongoose.Types.ObjectId.isValid(offeringId)) {
    const dbOffering = (await ModuleOfferingModel.findById(offeringId)
      .select("_id hasGrades hasAttendance hasContent")
      .lean()
      .exec()
      .catch(() => null)) as Record<string, unknown> | null;

    if (dbOffering) {
      if (
        hasModuleOfferingProgress({
          hasGrades: dbOffering.hasGrades === true,
          hasAttendance: dbOffering.hasAttendance === true,
          hasContent: dbOffering.hasContent === true,
        })
      ) {
        return NextResponse.json(
          { message: "Offering has grades, attendance, or content data" },
          { status: 409 }
        );
      }

      await ModuleOfferingModel.deleteOne({ _id: offeringId }).catch(() => null);
      return NextResponse.json({ ok: true });
    }
  }

  const offering = findModuleOfferingById(offeringId);
  if (!offering) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  if (hasModuleOfferingProgress(offering)) {
    return NextResponse.json(
      { message: "Offering has grades, attendance, or content data" },
      { status: 409 }
    );
  }

  const deleted = deleteModuleOffering(offeringId);
  if (!deleted) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
