import { NextResponse } from "next/server";
import "@/models/PortalData";
import { connectMongoose } from "@/models/mongoose";
import { PortalDataModel } from "@/models/PortalData";

function sanitizeKey(value: string) {
  return decodeURIComponent(String(value ?? "")).trim();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const { key: rawKey } = await params;
  const key = sanitizeKey(rawKey);
  if (!key) {
    return NextResponse.json({ message: "Key is required" }, { status: 400 });
  }

  const row = await PortalDataModel.findOne({ key }).lean().exec().catch(() => null);
  const rowValue = asObject(row)?.value ?? null;
  return NextResponse.json({ key, value: rowValue });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const { key: rawKey } = await params;
  const key = sanitizeKey(rawKey);
  if (!key) {
    return NextResponse.json({ message: "Key is required" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { value?: unknown }
    | null;

  if (!payload || !("value" in payload)) {
    return NextResponse.json({ message: "Value is required" }, { status: 400 });
  }

  const value = payload.value;

  const row = await PortalDataModel.findOneAndUpdate(
    { key },
    {
      $set: {
        key,
        value,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
    .lean()
    .exec()
    .catch(() => null);

  if (!row) {
    return NextResponse.json({ message: "Failed to save data" }, { status: 500 });
  }

  const rowValue = asObject(row)?.value ?? null;
  return NextResponse.json({ key, value: rowValue });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const { key: rawKey } = await params;
  const key = sanitizeKey(rawKey);
  if (!key) {
    return NextResponse.json({ message: "Key is required" }, { status: 400 });
  }

  await PortalDataModel.deleteOne({ key }).catch(() => null);

  return NextResponse.json({ key, ok: true });
}
