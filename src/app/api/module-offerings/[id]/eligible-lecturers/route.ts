import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Lecturer";
import "@/models/ModuleOffering";
import { findIntakeById } from "@/models/intake-store";
import {
  listLecturersInMemory,
  toLecturerPersistedRecordFromUnknown,
  type LecturerPersistedRecord,
} from "@/models/lecturer-store";
import { connectMongoose } from "@/models/mongoose";
import { findModuleOfferingById } from "@/models/module-offering-store";
import {
  isStaffEligibleForOffering,
  normalizeAcademicCode,
  sanitizeId,
  staffEligibilityMongoFilter,
  type OfferingEligibilityScope,
} from "@/models/staff-eligibility";
import { findModuleByCode, findModuleById } from "@/models/module-store";
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
  const moduleCode = normalizeModuleCode(row.moduleCode);
  const moduleRecord = findModuleByCode(moduleCode) ?? findModuleById(moduleId);
  const resolvedModuleId = moduleRecord?.id ?? moduleId;
  const resolvedModuleCode = moduleRecord?.code ?? moduleCode;
  if (!intakeId || (!resolvedModuleId && !resolvedModuleCode)) {
    return null;
  }
  const intake = findIntakeById(intakeId);

  const facultyCode = normalizeAcademicCode(
    row.facultyCode ?? row.facultyId ?? intake?.facultyCode
  );
  const degreeCode = normalizeAcademicCode(
    row.degreeCode ?? row.degreeProgramId ?? intake?.degreeCode
  );

  if (!facultyCode || !degreeCode) {
    return null;
  }

  return {
    facultyCode,
    degreeCode,
    moduleCode: resolvedModuleCode,
    moduleId: resolvedModuleId,
  };
}

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
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
        facultyCode: 1,
        facultyId: 1,
        degreeCode: 1,
        degreeProgramId: 1,
        intakeId: 1,
        moduleCode: 1,
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
        facultyCode: offering.facultyCode ?? offering.facultyId,
        degreeCode: offering.degreeCode ?? offering.degreeProgramId,
        moduleCode: offering.moduleCode,
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
