import { NextResponse } from "next/server";
import "@/models/Lecturer";
import { connectMongoose } from "@/models/mongoose";
import {
  listLecturersInMemory,
  normalizeAcademicCode,
  toLecturerPersistedRecordFromUnknown,
  type LecturerPersistedRecord,
} from "@/models/lecturer-store";
import { LecturerModel } from "@/models/Lecturer";
import {
  isStaffEligibleForOffering,
  staffEligibilityMongoFilter,
} from "@/models/staff-eligibility";

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
    const items = listLecturersInMemory({ status: "ACTIVE" })
      .filter((row) => isEligible(row, { facultyId, degreeId, moduleId }))
      .map((row) => toApiItem(row));

    return NextResponse.json({
      items,
      total: items.length,
    });
  }

  const query = staffEligibilityMongoFilter({
    facultyId,
    degreeProgramId: degreeId,
    moduleId,
  });

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

