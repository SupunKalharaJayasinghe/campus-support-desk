import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import "@/models/User";
import { resolveCurrentLecturerId } from "@/app/api/consultation-bookings/shared";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import {
  hasAnyWeekContent,
  isLecturerAssignedToOffering,
  mergeCourseWeeks,
  normalizeCourseOffering,
  normalizeWeekContents,
  resolveIntakeTermWeekContext,
  sanitizeWeekContentInput,
} from "@/models/course-week-utils";

interface MutableOfferingDocument {
  weekContents?: unknown;
  outlineWeeks?: unknown;
  hasContent?: boolean;
  save: () => Promise<unknown>;
  toObject: () => unknown;
}

function sanitizeOutlineRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{
      weekNo: number;
      title: string;
      plannedStartDate: unknown;
      plannedEndDate: unknown;
      manuallyEdited: boolean;
      type: string;
    }>;
  }

  const byWeek = new Map<
    number,
    {
      weekNo: number;
      title: string;
      plannedStartDate: unknown;
      plannedEndDate: unknown;
      manuallyEdited: boolean;
      type: string;
    }
  >();

  value.forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }
    const row = item as Record<string, unknown>;
    const weekNo = Math.max(1, Math.min(60, Math.floor(Number(row.weekNo) || 1)));
    const title = String(row.title ?? "").replace(/\s+/g, " ").trim();
    if (!title) {
      return;
    }
    byWeek.set(weekNo, {
      weekNo,
      title,
      plannedStartDate:
        row.plannedStartDate === undefined ? null : row.plannedStartDate,
      plannedEndDate: row.plannedEndDate === undefined ? null : row.plannedEndDate,
      manuallyEdited: row.manuallyEdited === true,
      type: String(row.type ?? "").trim(),
    });
  });

  return Array.from(byWeek.values()).sort((left, right) => left.weekNo - right.weekNo);
}

export async function PATCH(
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

  const payload = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const nextWeekContent = sanitizeWeekContentInput(payload ?? {});

  if (!Number.isFinite(nextWeekContent.weekNo) || nextWeekContent.weekNo < 1) {
    return NextResponse.json({ message: "Valid week number is required" }, { status: 400 });
  }

  const offeringDoc = (await ModuleOfferingModel.findById(offeringId)
    .exec()
    .catch(() => null)) as MutableOfferingDocument | null;
  if (!offeringDoc) {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  const currentOffering = normalizeCourseOffering(offeringDoc.toObject());
  if (!currentOffering || currentOffering.status !== "ACTIVE") {
    return NextResponse.json({ message: "Module offering not found" }, { status: 404 });
  }

  if (!isLecturerAssignedToOffering(currentOffering, lecturerId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const weekContentMap = new Map(
    normalizeWeekContents(offeringDoc.weekContents).map((item) => [item.weekNo, item] as const)
  );
  weekContentMap.set(nextWeekContent.weekNo, nextWeekContent);
  const weekContents = Array.from(weekContentMap.values()).sort(
    (left, right) => left.weekNo - right.weekNo
  );

  offeringDoc.weekContents = weekContents;
  offeringDoc.hasContent = hasAnyWeekContent(weekContents);

  if (nextWeekContent.outline) {
    const outlineRows = sanitizeOutlineRows(offeringDoc.outlineWeeks);
    const existing = outlineRows.find((item) => item.weekNo === nextWeekContent.weekNo);
    if (existing) {
      existing.title = nextWeekContent.outline;
    } else {
      outlineRows.push({
        weekNo: nextWeekContent.weekNo,
        title: nextWeekContent.outline,
        plannedStartDate: null,
        plannedEndDate: null,
        manuallyEdited: false,
        type: "",
      });
    }
    outlineRows.sort((left, right) => left.weekNo - right.weekNo);
    offeringDoc.outlineWeeks = outlineRows;
  }

  await offeringDoc.save();

  const savedOffering = normalizeCourseOffering(offeringDoc.toObject());
  if (!savedOffering) {
    return NextResponse.json(
      { message: "Failed to map saved module offering" },
      { status: 500 }
    );
  }

  const weekContext = resolveIntakeTermWeekContext({
    intakeId: savedOffering.intakeId,
    termCode: savedOffering.termCode,
  });
  const weeks = mergeCourseWeeks({
    weekRanges: weekContext?.weekRanges ?? [],
    outlineByWeek: savedOffering.outlineByWeek,
    weekContentsByWeek: savedOffering.weekContentsByWeek,
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
      id: savedOffering.id,
      moduleId: savedOffering.moduleId,
      moduleCode: savedOffering.moduleCode,
      moduleName: savedOffering.moduleName,
      intakeId: savedOffering.intakeId,
      intakeName: weekContext?.intake.name ?? savedOffering.intakeName,
      termCode: savedOffering.termCode,
      currentWeekNo: weekContext?.currentWeekNo ?? null,
    },
    updatedWeek: weeks.find((week) => week.weekNo === nextWeekContent.weekNo) ?? null,
    weeks,
  });
}
