import { NextResponse } from "next/server";
import { connectMongoose } from "@/lib/mongoose";
import {
  buildLeaderboardData,
  type LeaderboardScope,
  parseScopeOptions,
  validateScopeOptions,
} from "../route";

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
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

    const limitValue = Number(searchParams.get("limit"));
    const limit =
      Number.isFinite(limitValue) && limitValue > 0
        ? Math.min(50, Math.floor(limitValue))
        : 10;

    const leaderboard = await buildLeaderboardData({
      scope: scopeOptions.scope as LeaderboardScope,
      facultyId: scopeOptions.facultyId,
      degreeProgramId: scopeOptions.degreeProgramId,
      intakeId: scopeOptions.intakeId,
      moduleOfferingId: scopeOptions.moduleOfferingId,
    });

    return NextResponse.json({
      success: true,
      data: {
        scope: leaderboard.scope,
        topStudents: leaderboard.entries.slice(0, limit).map((entry) => ({
          rank: entry.rank,
          student: {
            id: entry.student.id,
            name: entry.student.name,
            registrationNumber: entry.student.registrationNumber,
          },
          totalXP: entry.totalXP,
          level: {
            number: entry.level.number,
            name: entry.level.name,
            icon: entry.level.icon,
            color: entry.level.color,
          },
          topTrophy: entry.topTrophy
            ? {
                name: entry.topTrophy.name,
                icon: entry.topTrophy.icon,
                tier: entry.topTrophy.tier,
              }
            : null,
        })),
        totalStudents: leaderboard.totalStudents,
        activeParticipants: leaderboard.activeParticipants,
        lastUpdated: new Date().toISOString(),
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
