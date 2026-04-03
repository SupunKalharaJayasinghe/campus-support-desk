import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/ModuleOffering";
import "@/models/User";
import { resolveCurrentStudentId } from "@/app/api/consultation-bookings/shared";
import { EnrollmentModel } from "@/models/Enrollment";
import { findIntakeById } from "@/models/intake-store";
import { connectMongoose } from "@/models/mongoose";
import { normalizeAcademicCode } from "@/models/student-registration";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import {
  hasWeekContentPayload,
  mergeCourseWeeks,
  normalizeCourseOffering,
  resolveIntakeTermWeekContext,
} from "@/models/course-week-utils";

function readId(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const row = value as { _id?: unknown; id?: unknown; toString?: () => string };
    const nested = String(row._id ?? row.id ?? "").trim();
    if (nested) {
      return nested;
    }
    const rendered = typeof row.toString === "function" ? row.toString() : "";
    return rendered === "[object Object]" ? "" : rendered.trim();
  }
  return "";
}

async function resolveLatestActiveEnrollment(studentId: string) {
  if (!studentId) {
    return null;
  }

  const row = (await EnrollmentModel.findOne({
    studentId,
    status: "ACTIVE",
  })
    .sort({ updatedAt: -1 })
    .select({
      studentId: 1,
      facultyId: 1,
      degreeProgramId: 1,
      intakeId: 1,
      stream: 1,
      subgroup: 1,
      status: 1,
    })
    .lean()
    .exec()
    .catch(() => null)) as Record<string, unknown> | null;

  if (!row) {
    return null;
  }

  return {
    studentId: readId(row.studentId),
    facultyId: normalizeAcademicCode(row.facultyId),
    degreeProgramId: normalizeAcademicCode(row.degreeProgramId),
    intakeId: String(row.intakeId ?? "").trim(),
    stream: String(row.stream ?? "").trim().toUpperCase(),
    subgroup: String(row.subgroup ?? "").trim(),
    status: String(row.status ?? "").trim().toUpperCase(),
  };
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const studentId = await resolveCurrentStudentId(request, mongooseConnection);
  if (!studentId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const enrollment = await resolveLatestActiveEnrollment(studentId);
  if (!enrollment) {
    return NextResponse.json({
      items: [],
      total: 0,
      enrollment: null,
    });
  }

  const intake = findIntakeById(enrollment.intakeId);
  if (!intake) {
    return NextResponse.json(
      { message: "Assigned intake not found" },
      { status: 404 }
    );
  }

  const termCode = intake.currentTerm;
  const termWeekContext = resolveIntakeTermWeekContext({
    intakeId: enrollment.intakeId,
    termCode,
  });
  if (!termWeekContext) {
    return NextResponse.json(
      { message: "Assigned intake term data not found" },
      { status: 404 }
    );
  }

  const rows = (await ModuleOfferingModel.find({
    status: "ACTIVE",
    termCode,
    $or: [
      { intakeId: termWeekContext.intake.id },
      { intakeName: termWeekContext.intake.name },
    ],
  })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => normalizeCourseOffering(row))
    .filter((row): row is NonNullable<ReturnType<typeof normalizeCourseOffering>> =>
      Boolean(row)
    )
    .filter((offering) => offering.status === "ACTIVE")
    .filter((offering) => offering.termCode === termCode)
    .filter((offering) =>
      offering.intakeId === termWeekContext.intake.id ||
      offering.intakeName.toLowerCase() === termWeekContext.intake.name.toLowerCase()
    )
    .map((offering) => {
      const weeks = mergeCourseWeeks({
        weekRanges: termWeekContext.weekRanges,
        outlineByWeek: offering.outlineByWeek,
        weekContentsByWeek: offering.weekContentsByWeek,
      });
      const currentWeek = termWeekContext.currentWeekNo
        ? weeks.find((week) => week.weekNo === termWeekContext.currentWeekNo) ?? null
        : null;

      return {
        id: offering.id,
        moduleId: offering.moduleId,
        moduleCode: offering.moduleCode,
        moduleName: offering.moduleName,
        termCode: offering.termCode,
        intakeId: offering.intakeId,
        intakeName: offering.intakeName,
        totalWeeks: weeks.length,
        currentWeekNo: termWeekContext.currentWeekNo,
        hasCurrentWeekContent: hasWeekContentPayload(
          currentWeek
            ? {
                weekNo: currentWeek.weekNo,
                outline: currentWeek.outline,
                lectureSlides: currentWeek.lectureSlides,
                resources: currentWeek.resources,
                assignments: currentWeek.assignments,
                todoItems: currentWeek.todoItems,
                updatedAt: currentWeek.updatedAt,
              }
            : null
        ),
        updatedAt:
          weeks.find((week) => Boolean(week.updatedAt))?.updatedAt ?? "",
      };
    })
    .sort((left, right) => left.moduleCode.localeCompare(right.moduleCode));

  return NextResponse.json({
    items,
    total: items.length,
    enrollment: {
      intakeId: enrollment.intakeId,
      facultyId: enrollment.facultyId,
      degreeProgramId: enrollment.degreeProgramId,
      stream: enrollment.stream,
      subgroup: enrollment.subgroup || null,
    },
    intake: {
      id: termWeekContext.intake.id,
      name: termWeekContext.intake.name,
      currentTerm: termCode,
    },
    currentWeekNo: termWeekContext.currentWeekNo,
  });
}
