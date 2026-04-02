import { NextResponse } from "next/server";
import "@/models/Announcement";
import { connectMongoose } from "@/models/mongoose";
import { AnnouncementModel } from "@/models/Announcement";

interface AnnouncementApiRecord {
  id: string;
  title: string;
  message: string;
  targetLabel: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }
  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

function toIsoDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toApiRecord(value: unknown): AnnouncementApiRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = collapseSpaces(row._id ?? row.id);
  const title = collapseSpaces(row.title).slice(0, 180);
  const message = collapseSpaces(row.message).slice(0, 3000);
  const targetLabel = collapseSpaces(row.targetLabel || "All users").slice(0, 140) || "All users";
  const createdBy = collapseSpaces(row.createdBy || "Admin").slice(0, 120) || "Admin";
  const createdAt = toIsoDate(row.createdAt);
  const updatedAt = toIsoDate(row.updatedAt);
  if (!id || !title || !message || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    title,
    message,
    targetLabel,
    createdBy,
    createdAt,
    updatedAt,
  };
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));

  const rows = (await AnnouncementModel.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toApiRecord(row))
    .filter((row): row is AnnouncementApiRecord => Boolean(row));

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
        if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const title = collapseSpaces(body.title).slice(0, 180);
    const message = collapseSpaces(body.message).slice(0, 3000);
    const targetLabel = collapseSpaces(body.targetLabel || "All users").slice(0, 140) || "All users";
    const createdBy = collapseSpaces(body.createdBy || "Admin").slice(0, 120) || "Admin";
    if (!title || !message) {
      return NextResponse.json(
        { message: "Title and message are required" },
        { status: 400 }
      );
    }

    const created = await AnnouncementModel.create({
      title,
      message,
      targetLabel,
      createdBy,
    });

    const record = toApiRecord(created.toObject());
    if (!record) {
      return NextResponse.json(
        { message: "Failed to map announcement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to publish announcement",
      },
      { status: 500 }
    );
  }
}
