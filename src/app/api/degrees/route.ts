import { NextResponse } from "next/server";
import {
  listDegreePrograms,
  type DegreeProgramStatus,
} from "@/lib/degree-program-store";

function normalizeCode(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function normalizeCodeList(value: string | null | undefined) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((item) => normalizeCode(item))
        .filter(Boolean)
    )
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const singleFacultyCode = normalizeCode(
    searchParams.get("facultyId") ??
      searchParams.get("facultyCode") ??
      searchParams.get("faculty")
  );
  const facultyCodeList = normalizeCodeList(searchParams.get("facultyIds"));
  const facultyFilters =
    facultyCodeList.length > 0
      ? facultyCodeList
      : singleFacultyCode
        ? [singleFacultyCode]
        : [];
  const status = String(searchParams.get("status") ?? "").trim().toUpperCase();
  const degreeStatus: "" | DegreeProgramStatus =
    status === "ACTIVE" || status === "INACTIVE" || status === "DRAFT"
      ? (status as DegreeProgramStatus)
      : "";

  const rows = listDegreePrograms({
    faculty: facultyFilters.length === 1 ? facultyFilters[0] : "",
    status: degreeStatus,
    sort: "az",
  });
  const filteredRows =
    facultyFilters.length <= 1
      ? rows
      : rows.filter((item) => facultyFilters.includes(item.facultyCode));
  const items = filteredRows.map((item) => ({
    id: item.code,
    code: item.code,
    name: item.name,
    facultyCode: item.facultyCode,
    status: item.status,
    updatedAt: item.updatedAt,
  }));

  return NextResponse.json({
    items,
    total: items.length,
  });
}
