import { NextResponse } from "next/server";
import "@/models/Lecturer";
import { connectMongoose } from "@/lib/mongoose";
import {
  listLecturersInMemory,
  normalizeAcademicCode,
  toLecturerPersistedRecordFromUnknown,
  type LecturerPersistedRecord,
} from "@/lib/lecturer-store";
import { LecturerModel } from "@/models/Lecturer";

function toApiItem(row: LecturerPersistedRecord) {
  return {
    _id: row.id,
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    status: row.status,
  };
}

function isEligible(
  row: Pick<LecturerPersistedRecord, "facultyIds" | "degreeProgramIds" | "moduleIds">,
  input: { facultyId: string; degreeId: string; moduleId: string }
) {
  const checks: boolean[] = [];
  if (input.moduleId) {
    checks.push(row.moduleIds.includes(input.moduleId));
  }
  if (input.degreeId) {
    checks.push(row.degreeProgramIds.includes(input.degreeId));
  }
  if (input.facultyId) {
    checks.push(row.facultyIds.includes(input.facultyId));
  }

  if (checks.length === 0) {
    return true;
  }

  return checks.some(Boolean);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const facultyId = normalizeAcademicCode(searchParams.get("facultyId"));
  const degreeId = normalizeAcademicCode(
    searchParams.get("degreeId") ?? searchParams.get("degreeProgramId")
  );
  const moduleId = String(searchParams.get("moduleId") ?? "").trim();

  const mongooseConnection = await connectMongoose().catch(() => null);

  if (!mongooseConnection) {
    const items = listLecturersInMemory({ status: "ACTIVE" })
      .filter((row) => isEligible(row, { facultyId, degreeId, moduleId }))
      .map((row) => toApiItem(row));

    return NextResponse.json({
      items,
      total: items.length,
    });
  }

  const query: Record<string, unknown> = { status: "ACTIVE" };
  const orFilters: Record<string, unknown>[] = [];
  if (moduleId) {
    orFilters.push({ moduleIds: moduleId });
  }
  if (degreeId) {
    orFilters.push({ degreeProgramIds: degreeId });
  }
  if (facultyId) {
    orFilters.push({ facultyIds: facultyId });
  }
  if (orFilters.length > 0) {
    query.$or = orFilters;
  }

  const rows = (await LecturerModel.find(query)
    .sort({ fullName: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toLecturerPersistedRecordFromUnknown(row))
    .filter((row): row is LecturerPersistedRecord => Boolean(row))
    .filter((row) => isEligible(row, { facultyId, degreeId, moduleId }))
    .map((row) => toApiItem(row));

  return NextResponse.json({
    items,
    total: items.length,
  });
}
