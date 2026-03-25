import { NextResponse } from "next/server";
import "@/models/Lecturer";
import { connectMongoose } from "@/lib/mongoose";
import {
  listLecturersInMemory,
  toLecturerPersistedRecordFromUnknown,
  type LecturerPersistedRecord,
} from "@/lib/lecturer-store";
import { LecturerModel } from "@/models/Lecturer";
import {
  isStaffEligibleForOffering,
  staffEligibilityMongoFilter,
} from "@/lib/staff-eligibility";
import { normalizeAcademicCode, sanitizeId } from "@/lib/module-offering-api";

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
  const facultyId = normalizeAcademicCode(searchParams.get("facultyId"));
  const degreeProgramId = normalizeAcademicCode(
    searchParams.get("degreeProgramId") ?? searchParams.get("degreeId")
  );
  const moduleId = sanitizeId(searchParams.get("moduleId"));
  const search = normalizeSearch(searchParams.get("search"));

  if (!facultyId || !degreeProgramId || !moduleId) {
    return NextResponse.json({ items: [], total: 0 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);

  if (!mongooseConnection) {
    const items = listLecturersInMemory({ status: "ACTIVE", sort: "az" })
      .filter((row) =>
        isStaffEligibleForOffering(
          {
            facultyIds: row.facultyIds,
            degreeProgramIds: row.degreeProgramIds,
            moduleIds: row.moduleIds,
          },
          { facultyId, degreeProgramId, moduleId }
        )
      )
      .filter((row) => matchesSearch(row, search))
      .map((row) => toApiItem(row));

    return NextResponse.json({
      items,
      total: items.length,
    });
  }

  const query: Record<string, unknown> = staffEligibilityMongoFilter({
    facultyId,
    degreeProgramId,
    moduleId,
  });

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
