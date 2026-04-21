import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ConsultationAvailabilitySlot";
import "@/models/Lecturer";
import {
  type ConsultationSlotMode,
  type ConsultationSlotStatus,
} from "@/models/consultation-availability";
import { ConsultationAvailabilitySlotModel } from "@/models/ConsultationAvailabilitySlot";
import { LecturerModel } from "@/models/Lecturer";
import { connectMongoose } from "@/models/mongoose";
import {
  createConsultationAvailabilitySlotInMemory,
  findOverlappingConsultationAvailabilitySlotInMemory,
  hasConsultationSlotEnded,
  isConsultationSlotTimeRangeValid,
  listConsultationAvailabilitySlotsInMemory,
  sanitizeConsultationLocation,
  sanitizeConsultationMeetingLink,
  sanitizeConsultationSessionType,
  sanitizeConsultationSlotDate,
  sanitizeConsultationSlotMode,
  sanitizeConsultationSlotStatus,
  sanitizeConsultationSlotTime,
  toConsultationAvailabilitySlotPersistedRecordFromUnknown,
  type ConsultationAvailabilitySlotPersistedRecord,
  type ConsultationAvailabilitySlotWriteInput,
} from "@/models/consultation-availability-store";
import { findLecturerInMemoryById } from "@/models/lecturer-store";
import { resolveCurrentLecturerId } from "@/app/api/consultation-bookings/shared";

type LecturerMeta = {
  id: string;
  fullName: string;
  email: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readId(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const row = value as {
      _id?: unknown;
      id?: unknown;
      toString?: () => string;
    };
    const nestedId = String(row._id ?? row.id ?? "").trim();
    if (nestedId) {
      return nestedId;
    }

    const rendered = typeof row.toString === "function" ? row.toString() : "";
    return rendered === "[object Object]" ? "" : rendered.trim();
  }

  return "";
}

function toLecturerMeta(value: unknown): LecturerMeta | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = readId(row._id ?? row.id);
  const fullName = String(row.fullName ?? "").trim();
  const email = String(row.email ?? "").trim().toLowerCase();
  if (!id || !fullName) {
    return null;
  }

  return { id, fullName, email };
}

function parseBooleanFlag(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function sanitizeModeFilter(value: string | null): "" | ConsultationSlotMode {
  if (value === "ONLINE" || value === "HYBRID" || value === "IN_PERSON") {
    return value;
  }

  return "";
}

function sanitizeStatusFilter(value: string | null): "" | ConsultationSlotStatus {
  if (value === "AVAILABLE" || value === "BOOKED" || value === "CANCELLED") {
    return value;
  }

  return "";
}

function toWriteInput(
  body: Partial<Record<string, unknown>>
): ConsultationAvailabilitySlotWriteInput | null {
  const lecturerId = String(body.lecturerId ?? "").trim();
  const date = sanitizeConsultationSlotDate(body.date);
  const startTime = sanitizeConsultationSlotTime(body.startTime);
  const endTime = sanitizeConsultationSlotTime(body.endTime);
  const sessionType = sanitizeConsultationSessionType(body.sessionType);
  const mode = sanitizeConsultationSlotMode(body.mode);
  const location = sanitizeConsultationLocation(body.location);
  const meetingLink = sanitizeConsultationMeetingLink(body.meetingLink);
  const status = sanitizeConsultationSlotStatus(body.status);

  if (!date || !startTime || !endTime || !sessionType) {
    return null;
  }

  return {
    lecturerId,
    date,
    startTime,
    endTime,
    sessionType,
    mode,
    location,
    meetingLink,
    status,
    bookingId: null,
  };
}

function toApiSlot(
  row: ConsultationAvailabilitySlotPersistedRecord,
  lecturer: LecturerMeta | null
) {
  return {
    id: row.id,
    lecturerId: row.lecturerId,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    sessionType: row.sessionType,
    mode: row.mode,
    location: row.location,
    meetingLink: row.meetingLink,
    status: row.status,
    bookingId: row.bookingId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lecturer,
  };
}

async function findLecturerMetaById(
  lecturerId: string,
  mongooseConnection: mongoose.Mongoose | null
) {
  const targetId = String(lecturerId ?? "").trim();
  if (!targetId) {
    return null;
  }

  if (!mongooseConnection) {
    const row = findLecturerInMemoryById(targetId);
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
    } satisfies LecturerMeta;
  }

  const row = await LecturerModel.findById(targetId)
    .select({ fullName: 1, email: 1 })
    .lean()
    .exec()
    .catch(() => null);

  return toLecturerMeta(row);
}

async function findOverlappingSlotForLecturer(input: {
  lecturerId: string;
  date: string;
  startTime: string;
  endTime: string;
  mongooseConnection: mongoose.Mongoose | null;
  excludeId?: string;
}) {
  if (!input.mongooseConnection) {
    return findOverlappingConsultationAvailabilitySlotInMemory(input);
  }

  const query: Record<string, unknown> = {
    lecturerId: input.lecturerId,
    date: input.date,
    isDeleted: false,
    status: { $in: ["AVAILABLE", "BOOKED"] },
    startTime: { $lt: input.endTime },
    endTime: { $gt: input.startTime },
  };

  const excludeId = String(input.excludeId ?? "").trim();
  if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  }

  const row = await ConsultationAvailabilitySlotModel.findOne(query)
    .select({ _id: 1 })
    .lean()
    .exec()
    .catch(() => null);

  return row;
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }
  const { searchParams } = new URL(request.url);
  const scope = String(searchParams.get("scope") ?? "").trim().toLowerCase();
  const lecturerIdFilter = String(searchParams.get("lecturerId") ?? "").trim();
  const from = sanitizeConsultationSlotDate(searchParams.get("from"));
  const to = sanitizeConsultationSlotDate(searchParams.get("to"));
  const includePast = parseBooleanFlag(searchParams.get("includePast"));
  const includeBooked = parseBooleanFlag(searchParams.get("includeBooked"));
  const status = sanitizeStatusFilter(searchParams.get("status"));
  const mode = sanitizeModeFilter(searchParams.get("mode"));

  if (scope === "mine") {
    const lecturerId = await resolveCurrentLecturerId(
      request,
      mongooseConnection,
      lecturerIdFilter
    );
    if (!lecturerId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!mongooseConnection) {
      const lecturer = await findLecturerMetaById(lecturerId, mongooseConnection);
      const items = listConsultationAvailabilitySlotsInMemory({
        lecturerId,
        status,
        mode,
        from,
        to,
        includePast,
      }).map((row) => toApiSlot(row, lecturer));

      return NextResponse.json({ items, total: items.length });
    }

    const query: Record<string, unknown> = {
      lecturerId,
      isDeleted: false,
    };
    if (status) {
      query.status = status;
    }
    if (mode) {
      query.mode = mode;
    }
    if (from || to) {
      query.date = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }

    const rows = (await ConsultationAvailabilitySlotModel.find(query)
      .populate({ path: "lecturerId", select: "fullName email" })
      .sort({ date: 1, startTime: 1 })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const items = rows
      .map((row) => {
        const parsed = toConsultationAvailabilitySlotPersistedRecordFromUnknown(row);
        if (!parsed) {
          return null;
        }

        if (!includePast && hasConsultationSlotEnded(parsed)) {
          return null;
        }

        return toApiSlot(parsed, toLecturerMeta(asObject(row)?.lecturerId));
      })
      .filter(Boolean);

    return NextResponse.json({ items, total: items.length });
  }

  const activeFrom = from || (includePast ? "" : new Date().toISOString().slice(0, 10));

  if (!mongooseConnection) {
    const items = listConsultationAvailabilitySlotsInMemory({
      lecturerId: lecturerIdFilter,
      status: includeBooked ? status : status || "AVAILABLE",
      mode,
      from: activeFrom,
      to,
      includePast,
      availableOnly: !includeBooked && !status,
    }).map((row) =>
      toApiSlot(row, findLecturerInMemoryById(row.lecturerId)
        ? {
            id: row.lecturerId,
            fullName: findLecturerInMemoryById(row.lecturerId)?.fullName ?? "",
            email: findLecturerInMemoryById(row.lecturerId)?.email ?? "",
          }
        : null)
    );

    return NextResponse.json({ items, total: items.length });
  }

  const query: Record<string, unknown> = {
    isDeleted: false,
  };
  if (lecturerIdFilter) {
    query.lecturerId = lecturerIdFilter;
  }
  if (mode) {
    query.mode = mode;
  }
  if (includeBooked) {
    if (status) {
      query.status = status;
    }
  } else {
    query.status = status || "AVAILABLE";
  }
  if (activeFrom || to) {
    query.date = {
      ...(activeFrom ? { $gte: activeFrom } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const rows = (await ConsultationAvailabilitySlotModel.find(query)
    .populate({ path: "lecturerId", select: "fullName email status" })
    .sort({ date: 1, startTime: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => {
      const parsed = toConsultationAvailabilitySlotPersistedRecordFromUnknown(row);
      if (!parsed) {
        return null;
      }

      if (!includePast && hasConsultationSlotEnded(parsed)) {
        return null;
      }

      return toApiSlot(parsed, toLecturerMeta(asObject(row)?.lecturerId));
    })
    .filter(Boolean);

  return NextResponse.json({ items, total: items.length });
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }
    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};
    const input = toWriteInput(body);

    if (!input) {
      return NextResponse.json(
        { message: "Date, start time, end time, and session type are required" },
        { status: 400 }
      );
    }

    if (!isConsultationSlotTimeRangeValid(input.startTime, input.endTime)) {
      return NextResponse.json(
        { message: "End time must be later than start time" },
        { status: 400 }
      );
    }

    if ((input.mode === "IN_PERSON" || input.mode === "HYBRID") && !input.location) {
      return NextResponse.json(
        { message: "Location is required for in-person and hybrid slots" },
        { status: 400 }
      );
    }

    if ((input.mode === "ONLINE" || input.mode === "HYBRID") && !input.meetingLink) {
      return NextResponse.json(
        { message: "Meeting link is required for online and hybrid slots" },
        { status: 400 }
      );
    }

    const lecturerId = await resolveCurrentLecturerId(
      request,
      mongooseConnection,
      input.lecturerId
    );
    if (!lecturerId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    input.lecturerId = lecturerId;
    const lecturer = await findLecturerMetaById(lecturerId, mongooseConnection);
    if (!lecturer) {
      return NextResponse.json({ message: "Lecturer not found" }, { status: 400 });
    }

    const overlappingSlot = await findOverlappingSlotForLecturer({
      lecturerId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      mongooseConnection,
    });
    if (overlappingSlot) {
      return NextResponse.json(
        { message: "This slot overlaps an existing availability window" },
        { status: 409 }
      );
    }

    if (!mongooseConnection) {
      const created = createConsultationAvailabilitySlotInMemory(input);
      return NextResponse.json(toApiSlot(created, lecturer), { status: 201 });
    }

    const reopenedSlotRow = await ConsultationAvailabilitySlotModel.findOneAndUpdate(
      {
        lecturerId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        isDeleted: false,
        status: "CANCELLED",
      },
      {
        $set: {
          sessionType: input.sessionType,
          mode: input.mode,
          location: input.location,
          meetingLink: input.meetingLink,
          status: input.status,
          bookingId: null,
        },
      },
      { new: true }
    )
      .lean()
      .exec()
      .catch(() => null);

    const reopenedSlot =
      toConsultationAvailabilitySlotPersistedRecordFromUnknown(reopenedSlotRow);
    if (reopenedSlot) {
      return NextResponse.json(toApiSlot(reopenedSlot, lecturer), { status: 201 });
    }

    const created = await ConsultationAvailabilitySlotModel.create({
      lecturerId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      sessionType: input.sessionType,
      mode: input.mode,
      location: input.location,
      meetingLink: input.meetingLink,
      status: input.status,
      bookingId: null,
      isDeleted: false,
    });

    const parsed = toConsultationAvailabilitySlotPersistedRecordFromUnknown(
      created.toObject()
    );
    if (!parsed) {
      throw new Error("Failed to map created consultation slot");
    }

    return NextResponse.json(toApiSlot(parsed, lecturer), { status: 201 });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      Number((error as { code?: unknown }).code) === 11000
    ) {
      return NextResponse.json(
        { message: "An identical slot already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to create consultation slot",
      },
      { status: 500 }
    );
  }
}
