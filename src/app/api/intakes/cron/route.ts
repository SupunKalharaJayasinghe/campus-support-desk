import { NextResponse } from "next/server";
import { connectMongoose } from "@/models/mongoose";
import { runIntakeDailyAutomation } from "@/models/intake-store";

export async function POST() {
  try {
    await connectMongoose().catch(() => null);
    const summary = runIntakeDailyAutomation();
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

