import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import "@/models/User";
import { resolveCurrentLecturerId } from "@/app/api/consultation-bookings/shared";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import {
  isLecturerAssignedToOffering,
  mergeCourseWeeks,
  normalizeCourseOffering,
  resolveIntakeTermWeekContext,
} from "@/models/course-week-utils";

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

  const lecturerId = await resolveCurrentLecturerId(request, mongooseConnection);
  if (!lecturerId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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

  if (!isLecturerAssignedToOffering(offering, lecturerId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const weekContext = resolveIntakeTermWeekContext({
    intakeId: offering.intakeId,
    termCode: offering.termCode,
  });

  const weeks = mergeCourseWeeks({
    weekRanges: weekContext?.weekRanges ?? [],
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
      intakeId: offering.intakeId,
      intakeName: weekContext?.intake.name ?? offering.intakeName,
      termCode: offering.termCode,
      currentWeekNo: weekContext?.currentWeekNo ?? null,
    },
    weeks,
  });
}
