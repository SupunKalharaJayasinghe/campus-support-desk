import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Student";
import {
  buildDemoLeaderboardData,
  hasDemoStudent,
} from "@/lib/demo-student-analytics";
import { connectMongoose } from "@/lib/mongoose";
import { StudentModel } from "@/models/Student";
import {
  buildLeaderboardData,
  buildStudentName,
  collapseSpaces,
  type LeaderboardScope,
  parseScopeOptions,
  validateScopeOptions,
} from "../route";

function roundToOne(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    const { searchParams } = new URL(request.url);
    const studentId = collapseSpaces(searchParams.get("studentId"));
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "studentId is required" },
        { status: 400 }
      );
    }

    if (mongooseConnection && !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    const student = mongooseConnection
      ? await StudentModel.findById(studentId)
          .select("studentId firstName lastName")
          .lean()
          .exec()
          .catch(() => null)
      : null;
    if ((mongooseConnection && !student) || (!mongooseConnection && !hasDemoStudent(studentId))) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const scopeOptions = parseScopeOptions(searchParams);
    const validationError = validateScopeOptions(scopeOptions, !mongooseConnection);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const leaderboard = mongooseConnection
      ? await buildLeaderboardData({
          scope: scopeOptions.scope as LeaderboardScope,
          facultyId: scopeOptions.facultyId,
          degreeProgramId: scopeOptions.degreeProgramId,
          intakeId: scopeOptions.intakeId,
          moduleOfferingId: scopeOptions.moduleOfferingId,
        })
      : buildDemoLeaderboardData({
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
    const totalStudents = leaderboard.totalStudents;
    const activeParticipants = leaderboard.activeParticipants;
    const higherEntries = leaderboard.entries.filter(
      (entry) => entry.totalXP > currentEntry.totalXP
    );
    const sameRankEntries = leaderboard.entries.filter(
      (entry) => entry.rank === currentEntry.rank
    );
    const nextHigherEntry = [...leaderboard.entries]
      .slice(0, currentIndex)
      .reverse()
      .find((entry) => entry.totalXP > currentEntry.totalXP);
    const nextLowerEntry = leaderboard.entries
      .slice(currentIndex + sameRankEntries.length)
      .find((entry) => entry.totalXP < currentEntry.totalXP);
    const percentile =
      totalStudents > 0
        ? roundToOne(((totalStudents - currentEntry.rank) / totalStudents) * 100)
        : 0;
    const xpToNextRank = nextHigherEntry
      ? Math.max(0, nextHigherEntry.totalXP - currentEntry.totalXP + 1)
      : 0;
    const xpFromPreviousRank = nextLowerEntry
      ? Math.max(0, currentEntry.totalXP - nextLowerEntry.totalXP)
      : 0;
    const topStudent = leaderboard.entries[0] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: studentId,
          name: student ? buildStudentName(student) : currentEntry.student.name,
          registrationNumber: student
            ? collapseSpaces((student as { studentId?: unknown }).studentId)
            : currentEntry.student.registrationNumber,
        },
        rank: currentEntry.rank,
        totalXP: currentEntry.totalXP,
        totalStudents,
        activeParticipants,
        percentile,
        xpToNextRank,
        xpFromPreviousRank,
        studentsAbove: higherEntries.length,
        studentsBelow:
          totalStudents - higherEntries.length - sameRankEntries.length,
        topStudent: topStudent
          ? {
              name: topStudent.student.name,
              totalXP: topStudent.totalXP,
              rank: topStudent.rank,
            }
          : null,
        message:
          activeParticipants > 0 && activeParticipants !== totalStudents
            ? `You are #${currentEntry.rank} out of ${totalStudents} students (${activeParticipants} active participants, top ${roundToOne(
                100 - percentile
              )}%)`
            : `You are #${currentEntry.rank} out of ${totalStudents} students (top ${roundToOne(
                100 - percentile
              )}%)`,
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
