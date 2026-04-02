import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Student";
import "@/models/Trophy";
import {
  buildDemoTrophyCheckResult,
  hasDemoStudent,
} from "@/lib/demo-student-analytics";
import { checkAllMilestones } from "@/lib/milestone-checker";
import { connectMongoose } from "@/lib/mongoose";
import { StudentModel } from "@/models/Student";

export async function POST(
  _request: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    const studentId = String(params.studentId ?? "").trim();
    if (mongooseConnection && !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      const demoResult = buildDemoTrophyCheckResult(studentId);
      if (!demoResult || !hasDemoStudent(studentId)) {
        return NextResponse.json(
          { success: false, error: "Student not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: demoResult,
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

    const result = await checkAllMilestones(studentId);

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
            : "Failed to check student trophies",
      },
      { status: 500 }
    );
  }
}
