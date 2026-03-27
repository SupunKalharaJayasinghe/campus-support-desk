import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Student";
import { connectMongoose } from "@/lib/mongoose";
import { StudentModel } from "@/models/Student";
import {
  buildLeaderboardData,
  collapseSpaces,
  type LeaderboardScope,
  parseScopeOptions,
  validateScopeOptions,
} from "../../route";

export async function GET(
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

    const studentExists = await StudentModel.exists({ _id: studentId }).catch(() => null);
    if (!studentExists) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const scopeOptions = parseScopeOptions(searchParams);
    const validationError = validateScopeOptions(scopeOptions);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const rangeValue = Number(searchParams.get("range"));
    const range =
      Number.isFinite(rangeValue) && rangeValue > 0
        ? Math.min(20, Math.floor(rangeValue))
        : 5;

    const leaderboard = await buildLeaderboardData({
      scope: scopeOptions.scope as LeaderboardScope,
      facultyId: scopeOptions.facultyId,
      degreeProgramId: scopeOptions.degreeProgramId,
      intakeId: scopeOptions.intakeId,
      moduleOfferingId: scopeOptions.moduleOfferingId,
    });

    const currentIndex = leaderboard.entries.findIndex(
      (entry) => entry.student.id === studentId
    );

    if (currentIndex < 0) {
      return NextResponse.json(
        { success: false, error: "Student not found in this leaderboard scope" },
        { status: 404 }
      );
    }

    const currentEntry = leaderboard.entries[currentIndex];
    const aboveStart = Math.max(0, currentIndex - range);
    const above = leaderboard.entries.slice(aboveStart, currentIndex);
    const below = leaderboard.entries.slice(currentIndex + 1, currentIndex + 1 + range);

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: currentEntry.student.id,
          name: currentEntry.student.name,
          registrationNumber: currentEntry.student.registrationNumber,
          rank: currentEntry.rank,
          totalXP: currentEntry.totalXP,
          level: currentEntry.level,
        },
        above,
        below,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
