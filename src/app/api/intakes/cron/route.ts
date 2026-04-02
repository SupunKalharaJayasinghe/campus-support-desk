import { NextResponse } from "next/server";
import { persistIntakeRecords } from "@/models/intake-record-persistence";
import { connectMongoose } from "@/models/mongoose";
import { runIntakeDailyAutomation, snapshotIntakes } from "@/models/intake-store";

export async function POST() {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "MongoDB connection is required" },
        { status: 503 }
      );
    }
    const summary = runIntakeDailyAutomation();
    await persistIntakeRecords(snapshotIntakes({ includeDeleted: true }));
    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to run intake daily automation." },
      { status: 500 }
    );
  }
}

