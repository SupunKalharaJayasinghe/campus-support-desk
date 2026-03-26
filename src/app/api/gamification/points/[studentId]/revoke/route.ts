import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/GamificationPoints";
import {
  revokePoints,
} from "@/lib/points-engine";
import { connectMongoose } from "@/lib/mongoose";
import { GamificationPointsModel } from "@/models/GamificationPoints";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function readId(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const row = value as {
      _id?: unknown;
      id?: unknown;
      toString?: () => string;
    };
    const nestedId = String(row._id ?? row.id ?? "").trim();
    if (nestedId) {
      return nestedId;
    }

    const rendered = typeof row.toString === "function" ? row.toString() : "";
    return rendered === "[object Object]" ? "" : rendered.trim();
  }

  return "";
}

export async function POST(
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

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const ledgerEntryId = collapseSpaces(body.ledgerEntryId);
    const reason = collapseSpaces(body.reason);

    if (!ledgerEntryId) {
      return NextResponse.json(
        { success: false, error: "ledgerEntryId is required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(ledgerEntryId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ledger entry ID format" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { success: false, error: "reason is required" },
        { status: 400 }
      );
    }

    const ledgerEntry = await GamificationPointsModel.findById(ledgerEntryId)
      .select("studentId isRevoked")
      .lean()
      .exec()
      .catch(() => null);
    if (!ledgerEntry) {
      return NextResponse.json(
        { success: false, error: "Points entry not found" },
        { status: 404 }
      );
    }

    const ledgerRow = asObject(ledgerEntry);
    const wasAlreadyRevoked = Boolean(ledgerRow?.isRevoked);
    if (readId(ledgerRow?.studentId) !== studentId) {
      return NextResponse.json(
        { success: false, error: "Points entry not found" },
        { status: 404 }
      );
    }

    const revokeResult = await revokePoints(ledgerEntryId, reason);
    if (!revokeResult.success) {
      return NextResponse.json(
        { success: false, error: revokeResult.message },
        { status: wasAlreadyRevoked ? 400 : 500 }
      );
    }

    const newTotalXP = await GamificationPointsModel.getStudentTotalXP(
      new mongoose.Types.ObjectId(studentId)
    ).catch(() => 0);

    return NextResponse.json({
      success: true,
      data: {
        message: revokeResult.message,
        newTotalXP,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to revoke points entry",
      },
      { status: 500 }
    );
  }
}
