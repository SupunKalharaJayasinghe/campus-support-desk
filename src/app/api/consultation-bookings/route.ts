import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ConsultationAvailabilitySlot";
import "@/models/ConsultationBooking";
import { ConsultationAvailabilitySlotModel } from "@/models/ConsultationAvailabilitySlot";
import { ConsultationBookingModel } from "@/models/ConsultationBooking";
import { connectMongoose } from "@/models/mongoose";
import {
  doConsultationSlotsOverlap,
  findConsultationAvailabilitySlotInMemoryById,
  hasConsultationSlotEnded,
  toConsultationAvailabilitySlotPersistedRecordFromUnknown,
  updateConsultationAvailabilitySlotInMemory,
} from "@/models/consultation-availability-store";
import {
  createConsultationBookingInMemory,
  listConsultationBookingsInMemory,
  sanitizeConsultationBookingPurpose,
  toConsultationBookingPersistedRecordFromUnknown,
} from "@/models/consultation-booking-store";
import {
  asObject,
  findLecturerMetaById,
  findStudentMetaById,
  resolveCurrentLecturerId,
  resolveCurrentStudentId,
  sanitizeConsultationBookingScope,
  sanitizeConsultationBookingStatusFilter,
  toApiBooking,
  toLecturerMeta,
  toStudentMeta,
} from "./shared";

function toSlotRecordFromRow(value: unknown) {
  const parsed = toConsultationAvailabilitySlotPersistedRecordFromUnknown(value);
  if (!parsed || parsed.isDeleted) {
    return null;
  }

  return parsed;
}

async function buildInMemoryBookingResponse(
  row: ReturnType<typeof toConsultationBookingPersistedRecordFromUnknown>,
  mongooseConnection: mongoose.Mongoose | null
) {
  if (!row) {
    return null;
  }

  const slot = findConsultationAvailabilitySlotInMemoryById(row.slotId);
  const lecturer = await findLecturerMetaById(row.lecturerId, mongooseConnection);
  const student = await findStudentMetaById(row.studentId, mongooseConnection);

  return toApiBooking(row, slot, lecturer, student);
}

async function findStudentBookingConflict(input: {
  studentId: string;
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  };
  mongooseConnection: mongoose.Mongoose | null;
}) {
  if (!input.mongooseConnection) {
    const activeBookings = listConsultationBookingsInMemory({
      studentId: input.studentId,
    }).filter(
      (row) => row.status === "PENDING" || row.status === "CONFIRMED"
    );

    return (
      activeBookings.find((booking) => {
        const existingSlot = findConsultationAvailabilitySlotInMemoryById(booking.slotId);
        if (!existingSlot) {
          return false;
        }

        return doConsultationSlotsOverlap(existingSlot, input.slot);
      }) ?? null
    );
  }

  const rows = (await ConsultationBookingModel.find({
    studentId: input.studentId,
    status: { $in: ["PENDING", "CONFIRMED"] },
  })
    .populate({
      path: "slotId",
      select: "date startTime endTime isDeleted",
    })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  return (
    rows.find((row) => {
      const existingSlot = toConsultationAvailabilitySlotPersistedRecordFromUnknown(
        asObject(row)?.slotId
      );
      if (!existingSlot || existingSlot.isDeleted) {
        return false;
      }

      return doConsultationSlotsOverlap(existingSlot, input.slot);
    }) ?? null
  );
}

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    const { searchParams } = new URL(request.url);
    const scope = sanitizeConsultationBookingScope(searchParams.get("scope"));
    const statusParam = searchParams.get("status");
    const status = sanitizeConsultationBookingStatusFilter(statusParam);
    const slotId = String(searchParams.get("slotId") ?? "").trim();
    const fallbackStudentId = String(searchParams.get("studentId") ?? "").trim();
    const fallbackLecturerId = String(searchParams.get("lecturerId") ?? "").trim();

    if (statusParam !== null && !status) {
      return NextResponse.json(
        { message: "Status must be PENDING, CONFIRMED, COMPLETED, or CANCELLED" },
        { status: 400 }
      );
    }

    if (mongooseConnection && slotId && !mongoose.Types.ObjectId.isValid(slotId)) {
      return NextResponse.json(
        { message: "Invalid consultation slot id" },
        { status: 400 }
      );
    }

    if (scope === "lecturer") {
      const lecturerId = await resolveCurrentLecturerId(
        request,
        mongooseConnection,
        fallbackLecturerId
      );
      if (!lecturerId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      if (!mongooseConnection) {
        const items = (
          await Promise.all(
            listConsultationBookingsInMemory({
              lecturerId,
              slotId,
              status,
            }).map((row) => buildInMemoryBookingResponse(row, mongooseConnection))
          )
        ).filter(
          (
            item
          ): item is Awaited<ReturnType<typeof buildInMemoryBookingResponse>> =>
            Boolean(item)
        );

        return NextResponse.json({ items, total: items.length });
      }

      const rows = (await ConsultationBookingModel.find({
        lecturerId,
        ...(slotId ? { slotId } : {}),
        ...(status ? { status } : {}),
      })
        .populate({
          path: "slotId",
          select:
            "date startTime endTime sessionType mode location status bookingId lecturerId isDeleted",
        })
        .populate({ path: "lecturerId", select: "fullName email" })
        .populate({
          path: "studentId",
          select: "studentId firstName lastName email status",
        })
        .sort({ createdAt: -1 })
        .lean()
        .exec()
        .catch(() => [])) as unknown[];

      const items = rows
        .map((row) => {
          const parsed = toConsultationBookingPersistedRecordFromUnknown(row);
          if (!parsed) {
            return null;
          }

          return toApiBooking(
            parsed,
            toSlotRecordFromRow(asObject(row)?.slotId),
            toLecturerMeta(asObject(row)?.lecturerId),
            toStudentMeta(asObject(row)?.studentId)
          );
        })
        .filter(Boolean);

      return NextResponse.json({ items, total: items.length });
    }

    const studentId = await resolveCurrentStudentId(
      request,
      mongooseConnection,
      fallbackStudentId
    );
    if (!studentId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!mongooseConnection) {
      const items = (
        await Promise.all(
          listConsultationBookingsInMemory({
            studentId,
            slotId,
            status,
          }).map((row) => buildInMemoryBookingResponse(row, mongooseConnection))
        )
      ).filter(
        (
          item
        ): item is Awaited<ReturnType<typeof buildInMemoryBookingResponse>> =>
          Boolean(item)
      );

      return NextResponse.json({ items, total: items.length });
    }

    const rows = (await ConsultationBookingModel.find({
      studentId,
      ...(slotId ? { slotId } : {}),
      ...(status ? { status } : {}),
    })
      .populate({
        path: "slotId",
        select:
          "date startTime endTime sessionType mode location status bookingId lecturerId isDeleted",
      })
      .populate({ path: "lecturerId", select: "fullName email" })
      .populate({
        path: "studentId",
        select: "studentId firstName lastName email status",
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const items = rows
      .map((row) => {
        const parsed = toConsultationBookingPersistedRecordFromUnknown(row);
        if (!parsed) {
          return null;
        }

        return toApiBooking(
          parsed,
          toSlotRecordFromRow(asObject(row)?.slotId),
          toLecturerMeta(asObject(row)?.lecturerId),
          toStudentMeta(asObject(row)?.studentId)
        );
      })
      .filter(Boolean);

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to load consultation bookings",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};
    const slotId = String(body.slotId ?? "").trim();
    const fallbackStudentId = String(body.studentId ?? "").trim();
    const purpose =
      sanitizeConsultationBookingPurpose(body.purpose) || "Consultation";

    if (!slotId) {
      return NextResponse.json(
        { message: "Consultation slot id is required" },
        { status: 400 }
      );
    }

    if (mongooseConnection && !mongoose.Types.ObjectId.isValid(slotId)) {
      return NextResponse.json(
        { message: "Invalid consultation slot id" },
        { status: 400 }
      );
    }

    const studentId = await resolveCurrentStudentId(
      request,
      mongooseConnection,
      fallbackStudentId
    );
    if (!studentId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const student = await findStudentMetaById(studentId, mongooseConnection);
    if (mongooseConnection && !student) {
      return NextResponse.json({ message: "Student not found" }, { status: 400 });
    }

    if (!mongooseConnection) {
      const slot = findConsultationAvailabilitySlotInMemoryById(slotId);
      if (!slot) {
        return NextResponse.json({ message: "Slot not found" }, { status: 404 });
      }

      if (hasConsultationSlotEnded(slot)) {
        return NextResponse.json(
          { message: "Past consultation slots cannot be booked" },
          { status: 400 }
        );
      }

      if (slot.status !== "AVAILABLE" || slot.bookingId) {
        return NextResponse.json(
          { message: "This consultation slot is no longer available" },
          { status: 409 }
        );
      }

      const studentConflict = await findStudentBookingConflict({
        studentId,
        slot,
        mongooseConnection,
      });
      if (studentConflict) {
        return NextResponse.json(
          { message: "You already have another active booking in this time window" },
          { status: 409 }
        );
      }

      const lecturer = await findLecturerMetaById(slot.lecturerId, mongooseConnection);
      const created = createConsultationBookingInMemory({
        slotId: slot.id,
        lecturerId: slot.lecturerId,
        studentId,
        purpose,
        status: "PENDING",
      });

      const reservedSlot = updateConsultationAvailabilitySlotInMemory(slot.id, {
        lecturerId: slot.lecturerId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        sessionType: slot.sessionType,
        mode: slot.mode,
        location: slot.location,
        status: "BOOKED",
        bookingId: created.id,
      });

      return NextResponse.json(
        toApiBooking(created, reservedSlot ?? slot, lecturer, student),
        { status: 201 }
      );
    }

    const slotRow = await ConsultationAvailabilitySlotModel.findById(slotId)
      .select({
        lecturerId: 1,
        date: 1,
        startTime: 1,
        endTime: 1,
        sessionType: 1,
        mode: 1,
        location: 1,
        status: 1,
        bookingId: 1,
        isDeleted: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .lean()
      .exec()
      .catch(() => null);

    const slot = toSlotRecordFromRow(slotRow);
    if (!slot) {
      return NextResponse.json({ message: "Slot not found" }, { status: 404 });
    }

    if (hasConsultationSlotEnded(slot)) {
      return NextResponse.json(
        { message: "Past consultation slots cannot be booked" },
        { status: 400 }
      );
    }

    if (slot.status !== "AVAILABLE" || slot.bookingId) {
      return NextResponse.json(
        { message: "This consultation slot is no longer available" },
        { status: 409 }
      );
    }

    const studentConflict = await findStudentBookingConflict({
      studentId,
      slot,
      mongooseConnection,
    });
    if (studentConflict) {
      return NextResponse.json(
        { message: "You already have another active booking in this time window" },
        { status: 409 }
      );
    }

    const lecturer = await findLecturerMetaById(slot.lecturerId, mongooseConnection);
    const created = await ConsultationBookingModel.create({
      slotId: slot.id,
      lecturerId: slot.lecturerId,
      studentId,
      purpose,
      status: "PENDING",
    });

    const reservedSlotRow = await ConsultationAvailabilitySlotModel.findOneAndUpdate(
      {
        _id: slot.id,
        isDeleted: false,
        status: "AVAILABLE",
        $or: [{ bookingId: null }, { bookingId: { $exists: false } }],
      },
      {
        $set: {
          status: "BOOKED",
          bookingId: created._id,
        },
      },
      { new: true }
    )
      .lean()
      .exec()
      .catch(() => null);

    const reservedSlot = toSlotRecordFromRow(reservedSlotRow);
    if (!reservedSlot) {
      await ConsultationBookingModel.findByIdAndDelete(created._id)
        .exec()
        .catch(() => null);

      return NextResponse.json(
        { message: "This consultation slot is no longer available" },
        { status: 409 }
      );
    }

    const booking =
      toConsultationBookingPersistedRecordFromUnknown(created.toObject()) ?? null;
    if (!booking) {
      throw new Error("Failed to map created consultation booking");
    }

    return NextResponse.json(
      toApiBooking(booking, reservedSlot, lecturer, student),
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to create consultation booking",
      },
      { status: 500 }
    );
  }
}
