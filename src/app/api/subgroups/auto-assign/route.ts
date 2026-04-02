import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/Student";
import { EnrollmentModel } from "@/models/Enrollment";
import { StudentModel } from "@/models/Student";
import { connectMongoose } from "@/models/mongoose";
import { findIntakeById, type TermCode } from "@/models/intake-store";
import {
  sanitizeSubgroup,
} from "@/models/student-registration";

type AllocationMode = "GROUP_COUNT" | "STUDENTS_PER_SUBGROUP";

interface EnrollmentCandidate {
  enrollmentId: string;
  studentRecordId: string;
  studentId: string;
  currentSubgroup: string | null;
}

interface PlannedAssignment extends EnrollmentCandidate {
  nextSubgroup: string;
}

interface DistributionItem {
  code: string;
  count: number;
  firstStudentId: string;
  lastStudentId: string;
}

const TERM_CODES: TermCode[] = [
  "Y1S1",
  "Y1S2",
  "Y2S1",
  "Y2S2",
  "Y3S1",
  "Y3S2",
  "Y4S1",
  "Y4S2",
];

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const whole = Math.floor(parsed);
  if (whole < 1) {
    return null;
  }

  return whole;
}

function sanitizeMode(value: unknown): AllocationMode | null {
  if (value === "GROUP_COUNT" || value === "STUDENTS_PER_SUBGROUP") {
    return value;
  }

  return null;
}

function sanitizeTermCode(value: unknown): TermCode | null {
  const termCode = String(value ?? "").trim().toUpperCase();
  return TERM_CODES.find((item) => item === termCode) ?? null;
}

function subgroupCodeByIndex(index: number) {
  const major = Math.floor(index / 2) + 1;
  const minor = (index % 2) + 1;
  return `${major}.${minor}`;
}

function subgroupComparator(left: string, right: string) {
  const leftMatch = left.match(/^(\d+)\.(\d+)$/);
  const rightMatch = right.match(/^(\d+)\.(\d+)$/);

  if (leftMatch && rightMatch) {
    const leftMajor = Number(leftMatch[1]);
    const rightMajor = Number(rightMatch[1]);
    if (leftMajor !== rightMajor) {
      return leftMajor - rightMajor;
    }

    const leftMinor = Number(leftMatch[2]);
    const rightMinor = Number(rightMatch[2]);
    return leftMinor - rightMinor;
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function buildDistribution(
  candidates: EnrollmentCandidate[],
  mode: AllocationMode,
  subgroupCount: number,
  studentsPerSubgroup: number
) {
  const totalStudents = candidates.length;
  const targetSubgroupCount =
    mode === "GROUP_COUNT"
      ? subgroupCount
      : totalStudents > 0
        ? Math.ceil(totalStudents / studentsPerSubgroup)
        : 0;

  const assignments: PlannedAssignment[] = [];
  const distribution: DistributionItem[] = [];

  if (targetSubgroupCount < 1) {
    return {
      assignments,
      distribution,
      totalSubgroups: 0,
    };
  }

  let cursor = 0;
  for (let index = 0; index < targetSubgroupCount; index += 1) {
    const subgroupCode = subgroupCodeByIndex(index);
    const countForGroup =
      mode === "GROUP_COUNT"
        ? Math.floor(totalStudents / targetSubgroupCount) +
          (index < totalStudents % targetSubgroupCount ? 1 : 0)
        : Math.min(studentsPerSubgroup, Math.max(0, totalStudents - cursor));
    const startCursor = cursor;

    for (let slot = 0; slot < countForGroup && cursor < totalStudents; slot += 1) {
      assignments.push({
        ...candidates[cursor],
        nextSubgroup: subgroupCode,
      });
      cursor += 1;
    }

    const firstStudentId =
      cursor > startCursor ? candidates[startCursor]?.studentId ?? "" : "";
    const lastStudentId =
      cursor > startCursor ? candidates[cursor - 1]?.studentId ?? "" : "";

    distribution.push({
      code: subgroupCode,
      count: Math.max(0, cursor - startCursor),
      firstStudentId,
      lastStudentId,
    });
  }

  return {
    assignments,
    distribution,
    totalSubgroups: targetSubgroupCount,
  };
}

function summarizeCurrentDistribution(candidates: EnrollmentCandidate[]) {
  const counts = new Map<string, number>();

  candidates.forEach((candidate) => {
    const subgroup = sanitizeSubgroup(candidate.currentSubgroup);
    if (!subgroup) {
      return;
    }

    counts.set(subgroup, (counts.get(subgroup) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((left, right) => subgroupComparator(left[0], right[0]))
    .map(([code, count]) => ({ code, count }));
}

function countPlannedChanges(assignments: PlannedAssignment[]) {
  let changedCount = 0;
  let unchangedCount = 0;

  assignments.forEach((item) => {
    const current = sanitizeSubgroup(item.currentSubgroup);
    const next = sanitizeSubgroup(item.nextSubgroup);
    if (current === next) {
      unchangedCount += 1;
      return;
    }

    changedCount += 1;
  });

  return {
    changedCount,
    unchangedCount,
  };
}

async function listCandidatesFromDb(intakeId: string) {
  const enrollmentRows = (await EnrollmentModel.find({
    intakeId,
    status: "ACTIVE",
  })
    .select({ _id: 1, studentId: 1, subgroup: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const studentRecordIds = enrollmentRows
    .map((row) => String(asObject(row)?.studentId ?? "").trim())
    .filter((row): row is string => Boolean(row));
  const uniqueStudentRecordIds = Array.from(new Set(studentRecordIds));

  const studentRows =
    uniqueStudentRecordIds.length > 0
      ? ((await StudentModel.find({
          _id: { $in: uniqueStudentRecordIds },
          status: "ACTIVE",
        })
          .select({ _id: 1, studentId: 1 })
          .lean()
          .exec()
          .catch(() => [])) as unknown[])
      : [];

  const studentIdByRecordId = new Map<string, string>();
  studentRows.forEach((row) => {
    const item = asObject(row);
    const recordId = String(item?._id ?? "").trim();
    const studentId = String(item?.studentId ?? "").trim().toUpperCase();
    if (!recordId || !studentId) {
      return;
    }

    studentIdByRecordId.set(recordId, studentId);
  });

  const candidates = enrollmentRows
    .map((row) => {
      const item = asObject(row);
      if (!item) {
        return null;
      }

      const enrollmentId = String(item._id ?? "").trim();
      const studentRecordId = String(item.studentId ?? "").trim();
      const studentId = studentIdByRecordId.get(studentRecordId) ?? "";
      if (!enrollmentId || !studentRecordId || !studentId) {
        return null;
      }

      return {
        enrollmentId,
        studentRecordId,
        studentId,
        currentSubgroup: sanitizeSubgroup(item.subgroup),
      } satisfies EnrollmentCandidate;
    })
    .filter((item): item is EnrollmentCandidate => Boolean(item))
    .sort((left, right) => left.studentId.localeCompare(right.studentId));

  return candidates;
}

async function applyAssignmentsInDb(assignments: PlannedAssignment[]) {
  const changedRows = assignments.filter((item) => {
    const current = sanitizeSubgroup(item.currentSubgroup);
    const next = sanitizeSubgroup(item.nextSubgroup);
    return current !== next;
  });

  const unchangedCount = assignments.length - changedRows.length;
  if (changedRows.length === 0) {
    return {
      changedCount: 0,
      unchangedCount,
    };
  }

  const now = new Date();
  await EnrollmentModel.bulkWrite(
    changedRows.map((item) => ({
      updateOne: {
        filter: { _id: item.enrollmentId },
        update: {
          $set: {
            subgroup: item.nextSubgroup,
            updatedAt: now,
          },
        },
      },
    }))
  );

  const studentRecordIds = Array.from(
    new Set(changedRows.map((item) => item.studentRecordId))
  );
  if (studentRecordIds.length > 0) {
    await StudentModel.updateMany(
      { _id: { $in: studentRecordIds } },
      { $set: { updatedAt: now } }
    ).catch(() => null);
  }

  return {
    changedCount: changedRows.length,
    unchangedCount,
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const body = rawBody ?? {};
    const intakeId = String(body.intakeId ?? "").trim();
    const mode = sanitizeMode(body.mode);
    const termCode = sanitizeTermCode(body.termCode);
    const subgroupCount = toPositiveInteger(body.subgroupCount);
    const studentsPerSubgroup = toPositiveInteger(body.studentsPerSubgroup);
    const apply = body.apply === true;

    if (!intakeId) {
      return NextResponse.json(
        { message: "Intake is required" },
        { status: 400 }
      );
    }

    const intake = findIntakeById(intakeId);
    if (!intake) {
      return NextResponse.json(
        { message: "Selected intake was not found" },
        { status: 404 }
      );
    }

    if (!mode) {
      return NextResponse.json(
        { message: "Select a valid allocation mode" },
        { status: 400 }
      );
    }

    if (mode === "GROUP_COUNT" && !subgroupCount) {
      return NextResponse.json(
        { message: "Subgroup count must be greater than zero" },
        { status: 400 }
      );
    }

    if (mode === "STUDENTS_PER_SUBGROUP" && !studentsPerSubgroup) {
      return NextResponse.json(
        { message: "Students per subgroup must be greater than zero" },
        { status: 400 }
      );
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "MongoDB connection is required" },
        { status: 503 }
      );
    }
    const candidates = await listCandidatesFromDb(intakeId);

    const plan = buildDistribution(
      candidates,
      mode,
      subgroupCount ?? 1,
      studentsPerSubgroup ?? 1
    );
    const predicted = countPlannedChanges(plan.assignments);
    const currentDistribution = summarizeCurrentDistribution(candidates);
    const termMatchesCurrent = !termCode || termCode === intake.currentTerm;

    const writeResult =
      apply && plan.assignments.length > 0
        ? await applyAssignmentsInDb(plan.assignments)
        : predicted;

    return NextResponse.json({
      intake: {
        id: intake.id,
        name: intake.name,
        currentTerm: intake.currentTerm,
      },
      selectedTerm: termCode,
      termMatchesCurrent,
      mode,
      requestedSubgroupCount: mode === "GROUP_COUNT" ? subgroupCount : null,
      requestedStudentsPerSubgroup:
        mode === "STUDENTS_PER_SUBGROUP" ? studentsPerSubgroup : null,
      totalStudents: candidates.length,
      totalSubgroups: plan.totalSubgroups,
      currentDistribution,
      previewDistribution: plan.distribution,
      changedCount: writeResult.changedCount,
      unchangedCount: writeResult.unchangedCount,
      applied: apply,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to calculate subgroup allocation",
      },
      { status: 500 }
    );
  }
}
