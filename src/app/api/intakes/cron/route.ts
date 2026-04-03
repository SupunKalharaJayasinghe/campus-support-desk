import { NextResponse } from "next/server";
import { persistIntakeRecords } from "@/models/intake-record-persistence";
import { connectMongoose } from "@/models/mongoose";
import { runCourseWeekNotificationJob } from "@/models/course-week-notifications";
import { runIntakeDailyAutomation, snapshotIntakes } from "@/models/intake-store";

export async function POST() {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
        if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }
    const summary = runIntakeDailyAutomation();
    const weekNotificationSummary = await runCourseWeekNotificationJob();
    await persistIntakeRecords(snapshotIntakes({ includeDeleted: true }));
    return NextResponse.json({
      ok: true,
      summary,
      weekNotificationSummary,
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to run intake daily automation." },
      { status: 500 }
    );
  }
}

