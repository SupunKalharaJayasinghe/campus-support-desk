import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/GamificationPoints";
import "@/models/Grade";
import "@/models/Student";
import { recalculateStudentPoints } from "@/lib/points-engine";
import { connectMongoose } from "@/lib/mongoose";
import { StudentModel } from "@/models/Student";

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export async function POST(
  request: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const studentId = collapseSpaces(params.studentId);
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    const studentExists = Boolean(
      await StudentModel.exists({ _id: studentId }).catch(() => null)
    );
    if (!studentExists) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    await request.json().catch(() => null);
    // TODO: Enforce admin-only RBAC before exposing this route beyond internal tools.
    const result = await recalculateStudentPoints(studentId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to recalculate student points",
      },
      { status: 500 }
    );
  }
}
