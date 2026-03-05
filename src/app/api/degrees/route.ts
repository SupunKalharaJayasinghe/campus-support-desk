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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const facultyCode = normalizeCode(
    searchParams.get("facultyId") ??
      searchParams.get("facultyCode") ??
      searchParams.get("faculty")
  );
  const status = String(searchParams.get("status") ?? "").trim().toUpperCase();
  const degreeStatus: "" | DegreeProgramStatus =
    status === "ACTIVE" || status === "INACTIVE" || status === "DRAFT"
      ? (status as DegreeProgramStatus)
      : "";

  const items = listDegreePrograms({
    faculty: facultyCode,
    status: degreeStatus,
    sort: "az",
  }).map((item) => ({
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
