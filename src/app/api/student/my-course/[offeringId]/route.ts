import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/ModuleOffering";
import "@/models/User";
import { resolveCurrentStudentId } from "@/app/api/consultation-bookings/shared";
import { EnrollmentModel } from "@/models/Enrollment";
import { findIntakeById } from "@/models/intake-store";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import { normalizeAcademicCode } from "@/models/student-registration";
import {
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

export async function GET(
  request: Request,
  { params }: { params: { offeringId: string } }
) {
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
    return NextResponse.json(
      { message: "Active student enrollment not found" },
      { status: 404 }
    );
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

  const offeringId = String(params.offeringId ?? "").trim();
  if (!offeringId) {
    return NextResponse.json({ message: "Module offering id is required" }, { status: 400 });
  }

  const dbRow = await ModuleOfferingModel.findById(offeringId)
    .lean()
    .exec()
    .catch(() => null);
  const offering = normalizeCourseOffering(dbRow);
  if (!offering || offering.status !== "ACTIVE") {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  const belongsToStudentIntake =
    offering.intakeId === termWeekContext.intake.id ||
    offering.intakeName.toLowerCase() === termWeekContext.intake.name.toLowerCase();
  if (!belongsToStudentIntake || offering.termCode !== termCode) {
    return NextResponse.json(
      { message: "This module is not available for your intake and current semester" },
      { status: 403 }
    );
  }

  const weeks = mergeCourseWeeks({
    weekRanges: termWeekContext.weekRanges,
    outlineByWeek: offering.outlineByWeek,
    weekContentsByWeek: offering.weekContentsByWeek,
  }).map((week) => ({
    weekNo: week.weekNo,
    startDate: week.startDate,
    endDate: week.endDate,
    isCurrent: week.isCurrent,
    isPast: week.isPast,
    isFuture: week.isFuture,
    outline: week.outline,
    lectureSlides: week.lectureSlides,
    resources: week.resources,
    assignments: week.assignments,
    todoItems: week.todoItems,
    updatedAt: week.updatedAt,
  }));

  return NextResponse.json({
    offering: {
      id: offering.id,
      moduleId: offering.moduleId,
      moduleCode: offering.moduleCode,
      moduleName: offering.moduleName,
      intakeId: termWeekContext.intake.id,
      intakeName: termWeekContext.intake.name,
      termCode: offering.termCode,
      currentWeekNo: termWeekContext.currentWeekNo,
    },
    enrollment: {
      intakeId: enrollment.intakeId,
      facultyId: enrollment.facultyId,
      degreeProgramId: enrollment.degreeProgramId,
      stream: enrollment.stream,
      subgroup: enrollment.subgroup || null,
    },
    weeks,
  });
}
