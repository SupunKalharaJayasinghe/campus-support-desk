import { NextResponse } from "next/server";
import "@/models/Enrollment";
import { connectMongoose } from "@/models/mongoose";
import { EnrollmentModel } from "@/models/Enrollment";
import {
  sanitizeStudentStream,
  sanitizeSubgroup,
} from "@/models/student-registration";

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

type QueryRecord = Record<string, unknown>;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const intakeId = String(params.id ?? "").trim();
  if (!intakeId) {
    return NextResponse.json({ message: "Intake id is required" }, { status: 400 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "MongoDB connection is required" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const facultyId = normalizeAcademicCode(searchParams.get("facultyId"));
  const degreeProgramId = normalizeAcademicCode(
    searchParams.get("degreeProgramId")
  );
  const streamInput = String(searchParams.get("stream") ?? "").trim().toUpperCase();
  const stream = streamInput ? sanitizeStudentStream(streamInput) : null;
  const status = String(searchParams.get("status") ?? "").trim().toUpperCase();

  const query: QueryRecord = {
    intakeId,
  };
  if (facultyId) {
    query.facultyId = facultyId;
  }
  if (degreeProgramId) {
    query.degreeProgramId = degreeProgramId;
  }
  if (streamInput && stream) {
    query.stream = stream;
  }
  if (status === "ACTIVE" || status === "INACTIVE") {
    query.status = status;
  }

  const rows = (await EnrollmentModel.find(query)
    .select({ subgroup: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const subgroupCounts = new Map<string, number>();
  rows.forEach((row) => {
    const doc = asObject(row);
    if (!doc) {
      return;
    }

    const subgroup = sanitizeSubgroup(doc.subgroup);
    if (!subgroup) {
      return;
    }

    subgroupCounts.set(subgroup, (subgroupCounts.get(subgroup) ?? 0) + 1);
  });

  const items = Array.from(subgroupCounts.entries())
    .sort((left, right) =>
      left[0].localeCompare(right[0], undefined, {
        numeric: true,
        sensitivity: "base",
      })
    )
    .map(([code, count]) => ({ code, count }));

  return NextResponse.json({
    intakeId,
    facultyId: facultyId || null,
    degreeProgramId: degreeProgramId || null,
    stream: streamInput && stream ? stream : null,
    total: items.length,
    items,
  });
}
