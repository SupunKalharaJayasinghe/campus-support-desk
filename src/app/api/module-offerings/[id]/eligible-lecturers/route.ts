import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Lecturer";
import "@/models/ModuleOffering";
import {
  listLecturersInMemory,
  toLecturerPersistedRecordFromUnknown,
  type LecturerPersistedRecord,
} from "@/models/lecturer-store";
import { connectMongoose } from "@/models/mongoose";
import { findModuleOfferingById } from "@/models/module-offering-store";
import { LecturerModel } from "@/models/Lecturer";
import { ModuleOfferingModel } from "@/models/ModuleOffering";

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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const offeringId = String(params.id ?? "").trim();
  if (!offeringId) {
    return NextResponse.json(
      { message: "Module offering id is required" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = normalizeSearch(searchParams.get("search"));
  const mongooseConnection = await connectMongoose().catch(() => null);

  let offeringExists = false;
  if (mongooseConnection && mongoose.Types.ObjectId.isValid(offeringId)) {
    offeringExists = Boolean(
      await ModuleOfferingModel.exists({ _id: offeringId }).catch(() => null)
    );
  }
  if (!offeringExists) {
    offeringExists = Boolean(findModuleOfferingById(offeringId));
  }
  if (!offeringExists) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

    if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
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
