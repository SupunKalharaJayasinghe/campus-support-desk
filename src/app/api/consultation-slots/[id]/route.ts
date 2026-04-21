import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ConsultationAvailabilitySlot";
import "@/models/Lecturer";
import { ConsultationAvailabilitySlotModel } from "@/models/ConsultationAvailabilitySlot";
import { LecturerModel } from "@/models/Lecturer";
import { connectMongoose } from "@/models/mongoose";
import {
  deleteConsultationAvailabilitySlotInMemory,
  findConsultationAvailabilitySlotInMemoryById,
  findOverlappingConsultationAvailabilitySlotInMemory,
  isConsultationSlotTimeRangeValid,
  sanitizeConsultationLocation,
  sanitizeConsultationMeetingLink,
  sanitizeConsultationSessionType,
  sanitizeConsultationSlotDate,
  sanitizeConsultationSlotMode,
  sanitizeConsultationSlotStatus,
  sanitizeConsultationSlotTime,
  toConsultationAvailabilitySlotPersistedRecordFromUnknown,
  updateConsultationAvailabilitySlotInMemory,
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

function mergeWriteInput(
  current: ConsultationAvailabilitySlotPersistedRecord,
  body: Partial<Record<string, unknown>>
): ConsultationAvailabilitySlotWriteInput {
  return {
    lecturerId: current.lecturerId,
    date:
      body.date === undefined
        ? current.date
        : sanitizeConsultationSlotDate(body.date),
    startTime:
      body.startTime === undefined
        ? current.startTime
        : sanitizeConsultationSlotTime(body.startTime),
    endTime:
      body.endTime === undefined
        ? current.endTime
        : sanitizeConsultationSlotTime(body.endTime),
    sessionType:
      body.sessionType === undefined
        ? current.sessionType
        : sanitizeConsultationSessionType(body.sessionType),
    mode:
      body.mode === undefined
        ? current.mode
        : sanitizeConsultationSlotMode(body.mode),
    location:
      body.location === undefined
        ? current.location
        : sanitizeConsultationLocation(body.location),
    meetingLink:
      body.meetingLink === undefined
        ? current.meetingLink
        : sanitizeConsultationMeetingLink(body.meetingLink),
    status:
      body.status === undefined
        ? current.status
        : sanitizeConsultationSlotStatus(body.status),
    bookingId:
      body.bookingId === undefined ? current.bookingId : readId(body.bookingId) || null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const slotId = String(params.id ?? "").trim();
  if (!slotId) {
    return NextResponse.json({ message: "Slot id is required" }, { status: 400 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  if (!mongooseConnection) {
    const row = findConsultationAvailabilitySlotInMemoryById(slotId);
    if (!row) {
      return NextResponse.json({ message: "Slot not found" }, { status: 404 });
    }

    const lecturer = await findLecturerMetaById(row.lecturerId, mongooseConnection);
    return NextResponse.json(toApiSlot(row, lecturer));
  }

  const row = await ConsultationAvailabilitySlotModel.findById(slotId)
    .populate({ path: "lecturerId", select: "fullName email" })
    .lean()
    .exec()
    .catch(() => null);
  if (!row) {
    return NextResponse.json({ message: "Slot not found" }, { status: 404 });
  }

  const parsed = toConsultationAvailabilitySlotPersistedRecordFromUnknown(row);
  if (!parsed || parsed.isDeleted) {
    return NextResponse.json({ message: "Slot not found" }, { status: 404 });
  }

  return NextResponse.json(toApiSlot(parsed, toLecturerMeta(asObject(row)?.lecturerId)));
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const slotId = String(params.id ?? "").trim();
    if (!slotId) {
      return NextResponse.json({ message: "Slot id is required" }, { status: 400 });
    }

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

    if (!mongooseConnection) {
      const current = findConsultationAvailabilitySlotInMemoryById(slotId);
      if (!current) {
        return NextResponse.json({ message: "Slot not found" }, { status: 404 });
      }

      const lecturerId = await resolveCurrentLecturerId(
        request,
        mongooseConnection,
        String(body.lecturerId ?? current.lecturerId).trim()
      );
      if (!lecturerId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      if (lecturerId !== current.lecturerId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      if (current.bookingId || current.status === "BOOKED") {
        return NextResponse.json(
          { message: "Booked slots cannot be edited" },
          { status: 409 }
        );
      }

      const input = mergeWriteInput(current, body);
      if (!input.date || !input.startTime || !input.endTime || !input.sessionType) {
        return NextResponse.json(
          { message: "Date, time, and session type are required" },
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

      const overlappingSlot = await findOverlappingSlotForLecturer({
        lecturerId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        mongooseConnection,
        excludeId: slotId,
      });
      if (overlappingSlot) {
        return NextResponse.json(
          { message: "This slot overlaps an existing availability window" },
          { status: 409 }
        );
      }

      const updated = updateConsultationAvailabilitySlotInMemory(slotId, input);
      if (!updated) {
        return NextResponse.json({ message: "Slot not found" }, { status: 404 });
      }

      const lecturer = await findLecturerMetaById(updated.lecturerId, mongooseConnection);
      return NextResponse.json(toApiSlot(updated, lecturer));
    }

    const row = await ConsultationAvailabilitySlotModel.findById(slotId).exec();
    if (!row || row.isDeleted) {
      return NextResponse.json({ message: "Slot not found" }, { status: 404 });
    }

    const lecturerId = await resolveCurrentLecturerId(request, mongooseConnection);
    if (!lecturerId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (String(row.lecturerId ?? "").trim() !== lecturerId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (row.bookingId || row.status === "BOOKED") {
      return NextResponse.json(
        { message: "Booked slots cannot be edited" },
        { status: 409 }
      );
    }

    const current = toConsultationAvailabilitySlotPersistedRecordFromUnknown(row.toObject());
    if (!current) {
      return NextResponse.json({ message: "Failed to map slot" }, { status: 500 });
    }

    const input = mergeWriteInput(current, body);
    if (!input.date || !input.startTime || !input.endTime || !input.sessionType) {
      return NextResponse.json(
        { message: "Date, time, and session type are required" },
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

    const overlappingSlot = await findOverlappingSlotForLecturer({
      lecturerId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      mongooseConnection,
      excludeId: slotId,
    });
    if (overlappingSlot) {
      return NextResponse.json(
        { message: "This slot overlaps an existing availability window" },
        { status: 409 }
      );
    }

    row.date = input.date;
    row.startTime = input.startTime;
    row.endTime = input.endTime;
    row.sessionType = input.sessionType;
    row.mode = input.mode;
    row.location = input.location;
    row.meetingLink = input.meetingLink;
    row.status = input.status;
    row.bookingId =
      input.bookingId && mongoose.Types.ObjectId.isValid(input.bookingId)
        ? new mongoose.Types.ObjectId(input.bookingId)
        : null;

    await row.save();

    const lecturer = await findLecturerMetaById(lecturerId, mongooseConnection);
    const parsed = toConsultationAvailabilitySlotPersistedRecordFromUnknown(row.toObject());
    if (!parsed) {
      return NextResponse.json({ message: "Failed to map slot" }, { status: 500 });
    }

    return NextResponse.json(toApiSlot(parsed, lecturer));
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
            : "Failed to update consultation slot",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const slotId = String(params.id ?? "").trim();
    if (!slotId) {
      return NextResponse.json({ message: "Slot id is required" }, { status: 400 });
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(request.url);
    const fallbackLecturerId = String(searchParams.get("lecturerId") ?? "").trim();

    if (!mongooseConnection) {
      const current = findConsultationAvailabilitySlotInMemoryById(slotId);
      if (!current) {
        return NextResponse.json({ message: "Slot not found" }, { status: 404 });
      }

      const lecturerId = await resolveCurrentLecturerId(
        request,
        mongooseConnection,
        fallbackLecturerId || current.lecturerId
      );
      if (!lecturerId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      if (lecturerId !== current.lecturerId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      if (current.bookingId || current.status === "BOOKED") {
        return NextResponse.json(
          { message: "Booked slots cannot be deleted" },
          { status: 409 }
        );
      }

      deleteConsultationAvailabilitySlotInMemory(slotId);
      return NextResponse.json({ ok: true });
    }

    const row = await ConsultationAvailabilitySlotModel.findById(slotId).exec();
    if (!row || row.isDeleted) {
      return NextResponse.json({ message: "Slot not found" }, { status: 404 });
    }

    const lecturerId = await resolveCurrentLecturerId(request, mongooseConnection);
    if (!lecturerId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (String(row.lecturerId ?? "").trim() !== lecturerId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (row.bookingId || row.status === "BOOKED") {
      return NextResponse.json(
        { message: "Booked slots cannot be deleted" },
        { status: 409 }
      );
    }

    row.status = "CANCELLED";
    row.isDeleted = true;
    await row.save();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete consultation slot",
      },
      { status: 500 }
    );
  }
}
