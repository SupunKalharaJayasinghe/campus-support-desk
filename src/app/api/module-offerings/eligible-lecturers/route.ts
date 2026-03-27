import { NextResponse } from "next/server";
import "@/models/Lecturer";
import { connectMongoose } from "@/models/mongoose";
import {
  listLecturersInMemory,
  toLecturerPersistedRecordFromUnknown,
  type LecturerPersistedRecord,
} from "@/models/lecturer-store";
import { LecturerModel } from "@/models/Lecturer";

function toApiItem(
  row: Pick<LecturerPersistedRecord, "id" | "fullName" | "email" | "status">
) {
  return {
    _id: row.id,
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    status: row.status,
  };
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesSearch(
  row: Pick<LecturerPersistedRecord, "fullName" | "email">,
  search: string
) {
  if (!search) {
    return true;
  }

  return `${row.fullName} ${row.email}`.toLowerCase().includes(search);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = normalizeSearch(searchParams.get("search"));
  const mongooseConnection = await connectMongoose().catch(() => null);

  if (!mongooseConnection) {
    const items = listLecturersInMemory({ status: "ACTIVE", sort: "az" })
      .filter((row) => matchesSearch(row, search))
      .map((row) => toApiItem(row));

    return NextResponse.json({
      items,
      total: items.length,
    });
  }

  const query: Record<string, unknown> = { status: "ACTIVE" };
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    query.$or = [{ fullName: regex }, { email: regex }];
  }

  const rows = (await LecturerModel.find(query)
    .sort({ fullName: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toLecturerPersistedRecordFromUnknown(row))
    .filter((row): row is LecturerPersistedRecord => Boolean(row))
    .filter((row) => matchesSearch(row, search))
    .map((row) => toApiItem(row));

  return NextResponse.json({
    items,
    total: items.length,
  });
}
