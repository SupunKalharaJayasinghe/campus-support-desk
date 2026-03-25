import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import {
  deleteModuleOffering,
  hasModuleOfferingProgress,
  listModuleOfferingsByModuleId,
} from "@/models/module-offering-store";
import { findModuleById } from "@/models/module-store";

interface UnassignRequestBody {
  offeringIds?: string[];
  unassignAll?: boolean;
}

interface BlockedOfferingItem {
  offeringId: string;
  message: string;
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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const moduleId = String(params.id ?? "").trim();
  if (!moduleId) {
    return NextResponse.json({ message: "Module id is required" }, { status: 400 });
  }

  const moduleRecord = findModuleById(moduleId);
  if (!moduleRecord) {
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

  const mongooseCandidates = unassignAll
    ? null
    : offeringIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

  const dbRows = mongooseConnection
    ? ((await ModuleOfferingModel.find(
        unassignAll
          ? { moduleId }
          : {
              moduleId,
              _id: { $in: mongooseCandidates ?? [] },
            }
      )
        .select("_id hasGrades hasAttendance hasContent")
        .lean()
        .exec()
        .catch(() => [])) as unknown[])
    : [];

  if (dbRows.length > 0) {
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
        moduleId,
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

  const storeOfferings = listModuleOfferingsByModuleId(moduleId);
  const selectedSet = new Set(offeringIds);
  const targets = unassignAll
    ? storeOfferings
    : storeOfferings.filter((offering) => selectedSet.has(offering.id));

  targets.forEach((offering) => {
    if (hasModuleOfferingProgress(offering)) {
      blocked.push({
        offeringId: offering.id,
        message: "Offering has grades, attendance, or content data",
      });
      return;
    }

    if (deleteModuleOffering(offering.id)) {
      removedOfferingIds.push(offering.id);
    }
  });

  return NextResponse.json(
    {
      moduleId,
      removedCount: removedOfferingIds.length,
      removedOfferingIds,
      blocked,
      requestedCount: requestedCount ?? targets.length,
    },
    {
      status: blocked.length > 0 ? 409 : 200,
    }
  );
}
