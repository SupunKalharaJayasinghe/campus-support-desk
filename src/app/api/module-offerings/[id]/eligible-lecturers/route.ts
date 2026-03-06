import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Lecturer";
import "@/models/ModuleOffering";
import { findIntakeById } from "@/lib/intake-store";
import {
  listLecturersInMemory,
  toLecturerPersistedRecordFromUnknown,
  type LecturerPersistedRecord,
} from "@/lib/lecturer-store";
import { connectMongoose } from "@/lib/mongoose";
import { findModuleOfferingById } from "@/lib/module-offering-store";
import {
  isStaffEligibleForOffering,
  normalizeAcademicCode,
  sanitizeId,
  staffEligibilityMongoFilter,
  type OfferingEligibilityScope,
} from "@/lib/staff-eligibility";
import { LecturerModel } from "@/models/Lecturer";
import { ModuleOfferingModel } from "@/models/ModuleOffering";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toApiItem(row: Pick<LecturerPersistedRecord, "id" | "fullName" | "email" | "status">) {
  return {
    _id: row.id,
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    status: row.status,
  };
}

function getScopeFromDbRow(value: unknown): OfferingEligibilityScope | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const intakeId = sanitizeId(row.intakeId);
  const moduleId = sanitizeId(row.moduleId);
  if (!intakeId || !moduleId) {
    return null;
  }
  const intake = findIntakeById(intakeId);

  const facultyId = normalizeAcademicCode(row.facultyId ?? intake?.facultyCode);
  const degreeProgramId = normalizeAcademicCode(
    row.degreeProgramId ?? intake?.degreeCode
  );

  if (!facultyId || !degreeProgramId) {
    return null;
  }

  return {
    facultyId,
    degreeProgramId,
    moduleId,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const offeringId = String(params.id ?? "").trim();
  if (!offeringId) {
    return NextResponse.json({ message: "Module offering id is required" }, { status: 400 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);
  let scope: OfferingEligibilityScope | null = null;

  if (mongooseConnection && mongoose.Types.ObjectId.isValid(offeringId)) {
    const offeringRow = await ModuleOfferingModel.findById(offeringId)
      .select({
        facultyId: 1,
        degreeProgramId: 1,
        intakeId: 1,
        moduleId: 1,
      })
      .lean()
      .exec()
      .catch(() => null);
    scope = getScopeFromDbRow(offeringRow);
  }

  if (!scope) {
    const offering = findModuleOfferingById(offeringId);
    if (offering) {
      scope = {
        facultyId: offering.facultyId,
        degreeProgramId: offering.degreeProgramId,
        moduleId: offering.moduleId,
      };
    }
  }

  if (!scope) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  if (!mongooseConnection) {
    const items = listLecturersInMemory({ status: "ACTIVE", sort: "az" })
      .filter((row) =>
        isStaffEligibleForOffering(
          {
            facultyIds: row.facultyIds,
            degreeProgramIds: row.degreeProgramIds,
            moduleIds: row.moduleIds,
          },
          scope as OfferingEligibilityScope
        )
      )
      .map((row) => toApiItem(row));

    return NextResponse.json({
      items,
      total: items.length,
    });
  }

  const query = staffEligibilityMongoFilter(scope);

  const rows = (await LecturerModel.find(query)
    .sort({ fullName: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toLecturerPersistedRecordFromUnknown(row))
    .filter((row): row is LecturerPersistedRecord => Boolean(row))
    .map((row) => toApiItem(row));

  return NextResponse.json({
    items,
    total: items.length,
  });
}
