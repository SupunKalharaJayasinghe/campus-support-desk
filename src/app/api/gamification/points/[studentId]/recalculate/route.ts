import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/GamificationPoints";
import "@/models/Grade";
import "@/models/Student";
import {
  buildDemoGamificationResyncResult,
  buildDemoGamificationSnapshot,
  hasDemoStudent,
} from "@/lib/demo-student-analytics";
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
    // SECURITY: This is a destructive admin-only action.
    // TODO: Enforce proper RBAC middleware once auth layer is implemented.
    // For now, the endpoint is accessible but should only be called from admin UI.
    const mongooseConnection = await connectMongoose().catch(() => null);
    const studentId = collapseSpaces(params.studentId);
    if (mongooseConnection && !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      if (!hasDemoStudent(studentId)) {
        return NextResponse.json(
          { success: false, error: "Student not found" },
          { status: 404 }
        );
      }

      await request.json().catch(() => null);

      return NextResponse.json({
        success: true,
        data: buildDemoGamificationResyncResult(
          studentId,
          buildDemoGamificationSnapshot(studentId),
          buildDemoGamificationSnapshot(studentId)
        ),
      });
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
