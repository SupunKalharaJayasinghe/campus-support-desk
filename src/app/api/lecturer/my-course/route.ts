import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import "@/models/User";
import { resolveCurrentLecturerId } from "@/app/api/consultation-bookings/shared";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import {
  mergeCourseWeeks,
  normalizeCourseOffering,
  resolveIntakeTermWeekContext,
} from "@/models/course-week-utils";

export async function GET(request: Request) {
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

  const rows = (await ModuleOfferingModel.find({
    status: "ACTIVE",
    $or: [
      { assignedLecturerIds: lecturerId },
      { assignedLecturers: lecturerId },
      { "assignedLecturers.lecturerId": lecturerId },
      { "assignedLecturers.id": lecturerId },
      { "assignedLecturers._id": lecturerId },
    ],
  })
    .sort({ moduleCode: 1, updatedAt: -1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => normalizeCourseOffering(row))
    .filter((row): row is NonNullable<ReturnType<typeof normalizeCourseOffering>> =>
      Boolean(row)
    )
    .map((offering) => {
      const weekContext = resolveIntakeTermWeekContext({
        intakeId: offering.intakeId,
        termCode: offering.termCode,
      });
      const weeks = mergeCourseWeeks({
        weekRanges: weekContext?.weekRanges ?? [],
        outlineByWeek: offering.outlineByWeek,
        weekContentsByWeek: offering.weekContentsByWeek,
      });

      return {
        id: offering.id,
        moduleId: offering.moduleId,
        moduleCode: offering.moduleCode,
        moduleName: offering.moduleName,
        intakeId: offering.intakeId,
        intakeName: offering.intakeName,
        termCode: offering.termCode,
        currentWeekNo: weekContext?.currentWeekNo ?? null,
        totalWeeks: weeks.length,
        assignedLecturer: true,
      };
    })
    .sort((left, right) => left.moduleCode.localeCompare(right.moduleCode));

  return NextResponse.json({
    items,
    total: items.length,
  });
}
