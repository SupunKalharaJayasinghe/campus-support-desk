import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/GamificationPoints";
import "@/models/Student";
import "@/models/Trophy";
import {
  buildDemoTrophiesPayload,
  hasDemoStudent,
} from "@/lib/demo-student-analytics";
import {
  getCurrentLevel,
  getLevelBadge,
  getLevelComparison,
  getLevelProgress,
  getNextLevel,
} from "@/lib/level-utils";
import { getAvailableTrophies } from "@/lib/milestone-checker";
import { connectMongoose } from "@/lib/mongoose";
import { GamificationPointsModel } from "@/models/GamificationPoints";
import { StudentModel } from "@/models/Student";
import { TrophyModel } from "@/models/Trophy";

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
    const studentId = String(params.studentId ?? "").trim();
    if (mongooseConnection && !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      const demoPayload = buildDemoTrophiesPayload(studentId);
      if (!demoPayload || !hasDemoStudent(studentId)) {
        return NextResponse.json(
          { success: false, error: "Student not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: demoPayload,
      });
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

    const studentObjectId = new mongoose.Types.ObjectId(studentId);
    const [showcase, totalXP, recentlyEarned] = await Promise.all([
      getAvailableTrophies(studentId),
      GamificationPointsModel.getStudentTotalXP(studentObjectId).catch(() => 0),
      TrophyModel.getRecentTrophies(studentObjectId, 5).catch(() => []),
    ]);

    const studentRow = asObject(student);

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: studentId,
          name: buildStudentName(student),
          registrationNumber: collapseSpaces(studentRow?.studentId),
        },
        level: {
          current: getCurrentLevel(totalXP),
          next: getNextLevel(totalXP),
          progress: getLevelProgress(totalXP),
          badge: getLevelBadge(totalXP),
          comparison: getLevelComparison(totalXP),
          totalXP,
        },
        trophies: {
          totalAvailable: showcase.totalAvailable,
          totalEarned: showcase.totalEarned,
          earnedPercentage: showcase.earnedPercentage,
          items: showcase.trophies,
          byTier: showcase.byTier,
          byCategory: showcase.byCategory,
          recentlyEarned,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch student trophies",
      },
      { status: 500 }
    );
  }
}
