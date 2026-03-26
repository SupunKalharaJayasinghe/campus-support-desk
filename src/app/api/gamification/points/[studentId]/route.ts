import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/GamificationPoints";
import "@/models/Student";
import { getPointsSummary } from "@/lib/points-engine";
import { connectMongoose } from "@/lib/mongoose";
import { StudentModel } from "@/models/Student";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildStudentName(student: unknown) {
  const row = asObject(student);
  const firstName = collapseSpaces(row?.firstName);
  const lastName = collapseSpaces(row?.lastName);
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

export async function GET(
  _request: Request,
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

    const studentId = String(params.studentId ?? "").trim();
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    const student = await StudentModel.findById(studentId)
      .select("studentId firstName lastName")
      .lean()
      .exec()
      .catch(() => null);
    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const summary = await getPointsSummary(studentId);
    const studentRow = asObject(student);

    return NextResponse.json({
      success: true,
      data: {
        studentId,
        student: {
          name: buildStudentName(student),
          registrationNumber: collapseSpaces(studentRow?.studentId),
        },
        totalXP: summary.totalXP,
        categoryBreakdown: summary.categoryBreakdown,
        recentActivity: summary.recentActivity,
        activityCount: summary.activityCount,
        pointsThisMonth: summary.pointsThisMonth,
        pointsThisSemester: summary.pointsThisSemester,
        averagePointsPerModule: summary.averagePointsPerModule,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch student points summary",
      },
      { status: 500 }
    );
  }
}
