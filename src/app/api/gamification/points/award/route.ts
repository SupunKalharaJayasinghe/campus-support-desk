import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Grade";
import "@/models/Student";
import {
  awardPointsForGrade,
  awardPointsForSemester,
} from "@/lib/points-engine";
import { connectMongoose } from "@/lib/mongoose";
import { GradeModel } from "@/models/Grade";
import { StudentModel } from "@/models/Student";

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeSemester(value: unknown): 1 | 2 | null {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2) {
    return parsed;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        {
          success: false,
          error: "Manual points awards are unavailable in demo mode",
        },
        { status: 501 }
      );
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const type = collapseSpaces(body.type).toLowerCase();
    if (!type) {
      return NextResponse.json(
        { success: false, error: "type is required" },
        { status: 400 }
      );
    }

    if (type !== "grade" && type !== "semester") {
      return NextResponse.json(
        { success: false, error: "type must be grade or semester" },
        { status: 400 }
      );
    }

    if (type === "grade") {
      const gradeId = collapseSpaces(body.gradeId);
      if (!gradeId) {
        return NextResponse.json(
          { success: false, error: "gradeId is required for grade awards" },
          { status: 400 }
        );
      }

      if (!mongoose.Types.ObjectId.isValid(gradeId)) {
        return NextResponse.json(
          { success: false, error: "Invalid grade ID format" },
          { status: 400 }
        );
      }

      const gradeExists = Boolean(
        await GradeModel.exists({ _id: gradeId }).catch(() => null)
      );
      if (!gradeExists) {
        return NextResponse.json(
          { success: false, error: "Grade not found" },
          { status: 404 }
        );
      }

      const awardResult = await awardPointsForGrade(gradeId);
      return NextResponse.json({
        success: true,
        data: awardResult,
      });
    }

    const studentId = collapseSpaces(body.studentId);
    const academicYear = collapseSpaces(body.academicYear);
    const semester = sanitizeSemester(body.semester);

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "studentId is required for semester awards" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    if (!academicYear) {
      return NextResponse.json(
        { success: false, error: "academicYear is required for semester awards" },
        { status: 400 }
      );
    }

    if (semester === null) {
      return NextResponse.json(
        { success: false, error: "semester must be 1 or 2" },
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

    const awardResult = await awardPointsForSemester(studentId, academicYear, semester);
    return NextResponse.json({
      success: true,
      data: awardResult,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to trigger points award",
      },
      { status: 500 }
    );
  }
}
