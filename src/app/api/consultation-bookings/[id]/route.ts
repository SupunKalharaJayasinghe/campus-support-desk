import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ConsultationAvailabilitySlot";
import "@/models/ConsultationBooking";
import { ConsultationAvailabilitySlotModel } from "@/models/ConsultationAvailabilitySlot";
import { ConsultationBookingModel } from "@/models/ConsultationBooking";
import { connectMongoose } from "@/models/mongoose";
import {
  findConsultationAvailabilitySlotInMemoryById,
  toConsultationAvailabilitySlotPersistedRecordFromUnknown,
  updateConsultationAvailabilitySlotInMemory,
} from "@/models/consultation-availability-store";
import {
  findConsultationBookingInMemoryById,
  toConsultationBookingPersistedRecordFromUnknown,
  updateConsultationBookingInMemory,
} from "@/models/consultation-booking-store";
import {
  asObject,
  findLecturerMetaById,
  findStudentMetaById,
  resolveCurrentLecturerId,
  resolveCurrentStudentId,
  sanitizeConsultationBookingAction,
  toApiBooking,
  toLecturerMeta,
  toStudentMeta,
} from "../shared";

function toSlotRecordFromRow(value: unknown) {
  const parsed = toConsultationAvailabilitySlotPersistedRecordFromUnknown(value);
  if (!parsed || parsed.isDeleted) {
    return null;
  }

  return parsed;
}

async function resolveBookingAccess(
  request: Request,
  mongooseConnection: mongoose.Mongoose | null,
  booking: {
    lecturerId: string;
    studentId: string;
  }
) {
  const { searchParams } = new URL(request.url);
  const fallbackLecturerId = String(searchParams.get("lecturerId") ?? "").trim();
  const fallbackStudentId = String(searchParams.get("studentId") ?? "").trim();

  const [lecturerId, studentId] = await Promise.all([
    resolveCurrentLecturerId(request, mongooseConnection, fallbackLecturerId),
    resolveCurrentStudentId(request, mongooseConnection, fallbackStudentId),
  ]);

  const lecturerOwner = Boolean(lecturerId && lecturerId === booking.lecturerId);
  const studentOwner = Boolean(studentId && studentId === booking.studentId);

  return {
    lecturerId,
    studentId,
    lecturerOwner,
    studentOwner,
    allowed: lecturerOwner || studentOwner,
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = String(params.id ?? "").trim();
    if (!bookingId) {
      return NextResponse.json(
        { message: "Booking id is required" },
        { status: 400 }
      );
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    if (!mongooseConnection) {
      const booking = findConsultationBookingInMemoryById(bookingId);
      if (!booking) {
        return NextResponse.json({ message: "Booking not found" }, { status: 404 });
      }

      const access = await resolveBookingAccess(request, mongooseConnection, booking);
      if (!access.allowed) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      const [slot, lecturer, student] = await Promise.all([
        Promise.resolve(findConsultationAvailabilitySlotInMemoryById(booking.slotId)),
        findLecturerMetaById(booking.lecturerId, mongooseConnection),
        findStudentMetaById(booking.studentId, mongooseConnection),
      ]);

      return NextResponse.json(toApiBooking(booking, slot, lecturer, student));
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return NextResponse.json({ message: "Invalid booking id" }, { status: 400 });
    }

    const row = await ConsultationBookingModel.findById(bookingId)
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
      .lean()
      .exec()
      .catch(() => null);

    const booking = toConsultationBookingPersistedRecordFromUnknown(row);
    if (!booking) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }

    const access = await resolveBookingAccess(request, mongooseConnection, booking);
    if (!access.allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      toApiBooking(
        booking,
        toSlotRecordFromRow(asObject(row)?.slotId),
        toLecturerMeta(asObject(row)?.lecturerId),
        toStudentMeta(asObject(row)?.studentId)
      )
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to load consultation booking",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = String(params.id ?? "").trim();
    if (!bookingId) {
      return NextResponse.json(
        { message: "Booking id is required" },
        { status: 400 }
      );
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
    const action = sanitizeConsultationBookingAction(body.action ?? body.status);
    const cancelReason = String(body.reason ?? body.cancelledReason ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    const now = new Date().toISOString();

    if (!action) {
      return NextResponse.json(
        { message: "Action must be cancel, confirm, or complete" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      const booking = findConsultationBookingInMemoryById(bookingId);
      if (!booking) {
        return NextResponse.json({ message: "Booking not found" }, { status: 404 });
      }

      const access = await resolveBookingAccess(request, mongooseConnection, booking);
      if (!access.allowed) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      if (action === "confirm" && !access.lecturerOwner) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
      if (action === "complete" && !access.lecturerOwner) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      if (action === "cancel" && booking.status === "CANCELLED") {
        return NextResponse.json(
          { message: "Booking is already cancelled" },
          { status: 409 }
        );
      }

      if (action === "cancel" && booking.status === "COMPLETED") {
        return NextResponse.json(
          { message: "Completed bookings cannot be cancelled" },
          { status: 409 }
        );
      }

      if (action === "confirm" && booking.status !== "PENDING") {
        return NextResponse.json(
          { message: "Only pending bookings can be confirmed" },
          { status: 409 }
        );
      }

      if (action === "complete" && booking.status !== "CONFIRMED") {
        return NextResponse.json(
          { message: "Only confirmed bookings can be completed" },
          { status: 409 }
        );
      }

      const updated = updateConsultationBookingInMemory(booking.id, {
        slotId: booking.slotId,
        lecturerId: booking.lecturerId,
        studentId: booking.studentId,
        purpose: booking.purpose,
        status:
          action === "cancel"
            ? "CANCELLED"
            : action === "confirm"
              ? "CONFIRMED"
              : "COMPLETED",
        confirmedAt:
          action === "confirm"
            ? booking.confirmedAt || now
            : booking.confirmedAt,
        completedAt:
          action === "complete"
            ? now
            : booking.completedAt,
        cancelledAt:
          action === "cancel"
            ? now
            : booking.cancelledAt,
        cancelledByRole:
          action === "cancel"
            ? access.studentOwner
              ? "STUDENT"
              : "LECTURER"
            : booking.cancelledByRole,
        cancelledReason:
          action === "cancel"
            ? cancelReason
            : booking.cancelledReason,
      });

      if (!updated) {
        return NextResponse.json({ message: "Booking not found" }, { status: 404 });
      }

      const currentSlot = findConsultationAvailabilitySlotInMemoryById(booking.slotId);
      const slot =
        action === "cancel" && currentSlot
          ? updateConsultationAvailabilitySlotInMemory(currentSlot.id, {
              lecturerId: currentSlot.lecturerId,
              date: currentSlot.date,
              startTime: currentSlot.startTime,
              endTime: currentSlot.endTime,
              sessionType: currentSlot.sessionType,
              mode: currentSlot.mode,
              location: currentSlot.location,
              status: "AVAILABLE",
              bookingId: null,
            }) ?? currentSlot
          : currentSlot;

      const [lecturer, student] = await Promise.all([
        findLecturerMetaById(updated.lecturerId, mongooseConnection),
        findStudentMetaById(updated.studentId, mongooseConnection),
      ]);

      return NextResponse.json(toApiBooking(updated, slot, lecturer, student));
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return NextResponse.json({ message: "Invalid booking id" }, { status: 400 });
    }

    const bookingRow = await ConsultationBookingModel.findById(bookingId).exec();
    if (!bookingRow) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }

    const booking =
      toConsultationBookingPersistedRecordFromUnknown(bookingRow.toObject()) ?? null;
    if (!booking) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }

    const access = await resolveBookingAccess(request, mongooseConnection, booking);
    if (!access.allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (action === "confirm" && !access.lecturerOwner) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    if (action === "complete" && !access.lecturerOwner) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (action === "cancel" && booking.status === "CANCELLED") {
      return NextResponse.json(
        { message: "Booking is already cancelled" },
        { status: 409 }
      );
    }

    if (action === "cancel" && booking.status === "COMPLETED") {
      return NextResponse.json(
        { message: "Completed bookings cannot be cancelled" },
        { status: 409 }
      );
    }

    if (action === "confirm" && booking.status !== "PENDING") {
      return NextResponse.json(
        { message: "Only pending bookings can be confirmed" },
        { status: 409 }
      );
    }

    if (action === "complete" && booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { message: "Only confirmed bookings can be completed" },
        { status: 409 }
      );
    }

    if (action === "cancel") {
      bookingRow.status = "CANCELLED";
      bookingRow.cancelledAt = new Date(now);
      bookingRow.cancelledByRole = access.studentOwner ? "STUDENT" : "LECTURER";
      bookingRow.cancelledReason = cancelReason;
    }

    if (action === "confirm") {
      bookingRow.status = "CONFIRMED";
      bookingRow.confirmedAt = bookingRow.confirmedAt ?? new Date(now);
    }

    if (action === "complete") {
      bookingRow.status = "COMPLETED";
      bookingRow.completedAt = new Date(now);
    }

    await bookingRow.save();

    let slot: ReturnType<typeof toSlotRecordFromRow> = null;
    if (action === "cancel") {
      const slotRow = await ConsultationAvailabilitySlotModel.findOneAndUpdate(
        {
          _id: booking.slotId,
          isDeleted: false,
          bookingId: bookingRow._id,
        },
        {
          $set: {
            status: "AVAILABLE",
            bookingId: null,
          },
        },
        { new: true }
      )
        .lean()
        .exec()
        .catch(() => null);

      slot = toSlotRecordFromRow(slotRow);
    } else {
      const slotRow = await ConsultationAvailabilitySlotModel.findById(booking.slotId)
        .lean()
        .exec()
        .catch(() => null);
      slot = toSlotRecordFromRow(slotRow);
    }

    const updated =
      toConsultationBookingPersistedRecordFromUnknown(bookingRow.toObject()) ?? null;
    if (!updated) {
      return NextResponse.json({ message: "Failed to map booking" }, { status: 500 });
    }

    const [lecturer, student] = await Promise.all([
      findLecturerMetaById(updated.lecturerId, mongooseConnection),
      findStudentMetaById(updated.studentId, mongooseConnection),
    ]);

    return NextResponse.json(toApiBooking(updated, slot, lecturer, student));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to update consultation booking",
      },
      { status: 500 }
    );
  }
}
