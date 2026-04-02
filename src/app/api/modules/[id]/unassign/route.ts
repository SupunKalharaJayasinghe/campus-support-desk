import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Module";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import { ModuleModel } from "@/models/Module";
import { ModuleOfferingModel } from "@/models/ModuleOffering";

interface UnassignRequestBody {
  offeringIds?: string[];
  unassignAll?: boolean;
}

interface BlockedOfferingItem {
  offeringId: string;
  message: string;
}

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function extractOfferingIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isLocked(row: {
  hasGrades?: unknown;
  hasAttendance?: unknown;
  hasContent?: unknown;
}) {
  return Boolean(row.hasGrades || row.hasAttendance || row.hasContent);
}

function toModuleLookup(value: unknown) {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  const code = normalizeModuleCode(row.code);
  if (!id || !code) {
    return null;
  }

  return { id, code };
}

async function findModuleDocument(moduleParam: string) {
  if (!moduleParam) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(moduleParam)) {
    const byId = await ModuleModel.findById(moduleParam).lean().exec().catch(() => null);
    if (byId) {
      return byId;
    }
  }

  const code = normalizeModuleCode(moduleParam);
  if (!code) {
    return null;
  }

  return ModuleModel.findOne({ code }).lean().exec().catch(() => null);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const moduleParam = String(params.id ?? "").trim();
  if (!moduleParam) {
    return NextResponse.json({ message: "Module id is required" }, { status: 400 });
  }

  const moduleLookup = toModuleLookup(await findModuleDocument(moduleParam));
  if (!moduleLookup) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as UnassignRequestBody;
  const offeringIds = extractOfferingIds(body.offeringIds);
  const unassignAll = body.unassignAll === true;

  if (!unassignAll && offeringIds.length === 0) {
    return NextResponse.json(
      { message: "Select at least one offering to unassign" },
      { status: 400 }
    );
  }

  const blocked: BlockedOfferingItem[] = [];
  const removedOfferingIds: string[] = [];
  const requestedCount = unassignAll ? undefined : offeringIds.length;

  const mongooseCandidates = offeringIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const dbRows = (await ModuleOfferingModel.find(
    unassignAll
      ? { $or: [{ moduleId: moduleLookup.id }, { moduleCode: moduleLookup.code }] }
      : {
          $or: [{ moduleId: moduleLookup.id }, { moduleCode: moduleLookup.code }],
          _id: { $in: mongooseCandidates },
        }
  )
    .select("_id hasGrades hasAttendance hasContent")
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const deletableObjectIds: mongoose.Types.ObjectId[] = [];

  dbRows.forEach((row) => {
    const normalizedRow = asObject(row);
    if (!normalizedRow) {
      return;
    }

    const offeringId = String(normalizedRow._id ?? "").trim();
    if (!offeringId) {
      return;
    }

    if (isLocked(normalizedRow)) {
      blocked.push({
        offeringId,
        message: "Offering has grades, attendance, or content data",
      });
      return;
    }

    if (mongoose.Types.ObjectId.isValid(offeringId)) {
      deletableObjectIds.push(new mongoose.Types.ObjectId(offeringId));
      removedOfferingIds.push(offeringId);
    }
  });

  if (deletableObjectIds.length > 0) {
    await ModuleOfferingModel.deleteMany({
      _id: { $in: deletableObjectIds },
    }).catch(() => null);
  }

  return NextResponse.json(
    {
      moduleId: moduleLookup.id,
      removedCount: removedOfferingIds.length,
      removedOfferingIds,
      blocked,
      requestedCount: requestedCount ?? dbRows.length,
    },
    {
      status: blocked.length > 0 ? 409 : 200,
    }
  );
}
