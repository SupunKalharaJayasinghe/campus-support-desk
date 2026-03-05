import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";

export async function GET() {
  try {
    await connectDB();

    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json({ ok: false, error: "Database not available" }, { status: 500 });
    }

    const collections = await db.listCollections().toArray();

    return NextResponse.json({
      ok: true,
      db: db.databaseName,
      collections: collections.map((c) => c.name),
    });
  } catch (error) {
    console.error("health GET failed", error);
    return NextResponse.json({ ok: false, error: "Health check failed" }, { status: 500 });
  }
}