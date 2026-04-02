import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import { connectMongoose } from "@/models/mongoose";
import { LabAssistantModel } from "@/models/LabAssistant";
import {
  listLabAssistantsInMemory,
  normalizeAcademicCode,
  toLabAssistantPersistedRecordFromUnknown,
  type LabAssistantPersistedRecord,
} from "@/models/lab-assistant-store";
import {
  isStaffEligibleForOffering,
  staffEligibilityMongoFilter,
} from "@/models/staff-eligibility";

function toApiItem(row: LabAssistantPersistedRecord) {
  return {
    _id: row.id,
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    status: row.status,
  };
}

function isEligible(
  row: Pick<LabAssistantPersistedRecord, "facultyIds" | "degreeProgramIds" | "moduleIds">,
  input: { facultyId: string; degreeId: string; moduleId: string }
) {
  if (!input.facultyId || !input.degreeId || !input.moduleId) {
    return false;
  }

  return isStaffEligibleForOffering(row, {
    facultyId: input.facultyId,
    degreeProgramId: input.degreeId,
    moduleId: input.moduleId,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const facultyId = normalizeAcademicCode(searchParams.get("facultyId"));
  const degreeId = normalizeAcademicCode(
    searchParams.get("degreeId") ?? searchParams.get("degreeProgramId")
  );
  const moduleId = String(searchParams.get("moduleId") ?? "").trim();
  if (!facultyId || !degreeId || !moduleId) {
    return NextResponse.json({ items: [], total: 0 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);

    if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const query = staffEligibilityMongoFilter({
    facultyId,
    degreeProgramId: degreeId,
    moduleId,
  });

  const rows = (await LabAssistantModel.find(query)
    .sort({ fullName: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toLabAssistantPersistedRecordFromUnknown(row))
    .filter((row): row is LabAssistantPersistedRecord => Boolean(row))
    .filter((row) => isEligible(row, { facultyId, degreeId, moduleId }))
    .map((row) => toApiItem(row));

  return NextResponse.json({
    items,
    total: items.length,
  });
}

