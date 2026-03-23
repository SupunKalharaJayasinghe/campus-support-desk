import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({
      ok: true,
      message: "MongoDB Connected",
      dbName: "UniHub",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "MongoDB connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
