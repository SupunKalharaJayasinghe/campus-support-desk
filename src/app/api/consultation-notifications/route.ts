import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ConsultationAvailabilitySlot";
import "@/models/ConsultationBooking";
import "@/models/ConsultationNotification";
import { ConsultationBookingModel } from "@/models/ConsultationBooking";
import { ConsultationNotificationModel } from "@/models/ConsultationNotification";
import { connectMongoose } from "@/models/mongoose";
import type {
  ConsultationNotificationRecipientRole,
  ConsultationNotificationType,
} from "@/models/consultation-notification";
import {
  ensureConsultationNotificationInMemory,
  listConsultationNotificationsInMemory,
  markAllConsultationNotificationsInMemoryAsRead,
  toConsultationNotificationPersistedRecordFromUnknown,
  type ConsultationNotificationPersistedRecord,
} from "@/models/consultation-notification-store";
import {
  findConsultationAvailabilitySlotInMemoryById,
  toConsultationAvailabilitySlotPersistedRecordFromUnknown,
  type ConsultationAvailabilitySlotPersistedRecord,
} from "@/models/consultation-availability-store";
import {
  listConsultationBookingsInMemory,
  toConsultationBookingPersistedRecordFromUnknown,
} from "@/models/consultation-booking-store";
import {
  asObject,
  findLecturerMetaById,
  findStudentMetaById,
  resolveCurrentConsultationActor,
  toLecturerMeta,
  toStudentMeta,
} from "@/app/api/consultation-bookings/shared";

function buildSlotStart(date: string, startTime: string) {
  const parsed = new Date(`${date}T${startTime}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveReminderType(
  slot: Pick<ConsultationAvailabilitySlotPersistedRecord, "date" | "startTime">,
  now = new Date()
): ConsultationNotificationType | null {
  const slotStart = buildSlotStart(slot.date, slot.startTime);
  if (!slotStart) {
    return null;
  }

  const hoursUntilStart = (slotStart.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilStart <= 0) {
    return null;
  }

  if (hoursUntilStart <= 2) {
    return "STARTING_SOON_REMINDER";
  }

  if (hoursUntilStart <= 36) {
    return "DAY_BEFORE_REMINDER";
  }

  return null;
}

function buildNotificationTitle(type: ConsultationNotificationType) {
  return type === "STARTING_SOON_REMINDER"
    ? "Consultation starts soon"
    : "Upcoming consultation reminder";
}

function buildNotificationMessage(input: {
  recipientRole: ConsultationNotificationRecipientRole;
  slot: ConsultationAvailabilitySlotPersistedRecord;
  studentName: string;
  lecturerName: string;
}) {
  const sessionLabel = `${input.slot.sessionType} on ${input.slot.date} at ${input.slot.startTime}`;
  if (input.recipientRole === "LECTURER") {
    return `${input.studentName} is booked for ${sessionLabel}.`;
  }

  return `Your session with ${input.lecturerName} is scheduled for ${sessionLabel}.`;
}

function toApiNotification(row: ConsultationNotificationPersistedRecord) {
  return {
    id: row.id,
    bookingId: row.bookingId,
    recipientRole: row.recipientRole,
    recipientId: row.recipientId,
    type: row.type,
    title: row.title,
    message: row.message,
    readAt: row.readAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    unread: !row.readAt,
  };
}

async function ensureMongoReminder(
  input: Omit<ConsultationNotificationPersistedRecord, "id" | "createdAt" | "updatedAt" | "readAt">
) {
  await ConsultationNotificationModel.findOneAndUpdate(
    { notificationKey: input.notificationKey },
    {
      $setOnInsert: {
        notificationKey: input.notificationKey,
        recipientRole: input.recipientRole,
        recipientId: input.recipientId,
        bookingId: input.bookingId,
        type: input.type,
        title: input.title,
        message: input.message,
        readAt: null,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
    .lean()
    .exec()
    .catch(() => null);
}

async function syncConsultationReminders(
  mongooseConnection: mongoose.Mongoose | null
) {
  if (!mongooseConnection) {
    const bookings = listConsultationBookingsInMemory({ status: "CONFIRMED" });
    for (const booking of bookings) {
      const slot = findConsultationAvailabilitySlotInMemoryById(booking.slotId);
      if (!slot) {
        continue;
      }

      const reminderType = resolveReminderType(slot);
      if (!reminderType) {
        continue;
      }

      const [lecturer, student] = await Promise.all([
        findLecturerMetaById(booking.lecturerId, mongooseConnection),
        findStudentMetaById(booking.studentId, mongooseConnection),
      ]);

      const lecturerName = lecturer?.fullName ?? "your lecturer";
      const studentName = student?.fullName ?? student?.studentId ?? "the student";

      for (const recipient of [
        { role: "LECTURER" as const, id: booking.lecturerId },
        { role: "STUDENT" as const, id: booking.studentId },
      ]) {
        ensureConsultationNotificationInMemory({
          notificationKey: `${reminderType}:${booking.id}:${recipient.role}`,
          recipientRole: recipient.role,
          recipientId: recipient.id,
          bookingId: booking.id,
          type: reminderType,
          title: buildNotificationTitle(reminderType),
          message: buildNotificationMessage({
            recipientRole: recipient.role,
            slot,
            lecturerName,
            studentName,
          }),
        });
      }
    }

    return;
  }

  const rows = (await ConsultationBookingModel.find({ status: "CONFIRMED" })
    .populate({
      path: "slotId",
      select: "date startTime endTime sessionType mode location status bookingId isDeleted",
    })
    .populate({ path: "lecturerId", select: "fullName email" })
    .populate({
      path: "studentId",
      select: "studentId firstName lastName email status",
    })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  for (const row of rows) {
    const booking = toConsultationBookingPersistedRecordFromUnknown(row);
    const slot = toConsultationAvailabilitySlotPersistedRecordFromUnknown(
      asObject(row)?.slotId
    );
    const lecturer = toLecturerMeta(asObject(row)?.lecturerId);
    const student = toStudentMeta(asObject(row)?.studentId);

    if (!booking || !slot || slot.isDeleted) {
      continue;
    }

    const reminderType = resolveReminderType(slot);
    if (!reminderType) {
      continue;
    }

    const lecturerName = lecturer?.fullName ?? "your lecturer";
    const studentName = student?.fullName ?? student?.studentId ?? "the student";

    for (const recipient of [
      { role: "LECTURER" as const, id: booking.lecturerId },
      { role: "STUDENT" as const, id: booking.studentId },
    ]) {
      await ensureMongoReminder({
        notificationKey: `${reminderType}:${booking.id}:${recipient.role}`,
        recipientRole: recipient.role,
        recipientId: recipient.id,
        bookingId: booking.id,
        type: reminderType,
        title: buildNotificationTitle(reminderType),
        message: buildNotificationMessage({
          recipientRole: recipient.role,
          slot,
          lecturerName,
          studentName,
        }),
      });
    }
  }
}

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }
    await syncConsultationReminders(mongooseConnection);

    const { searchParams } = new URL(request.url);
    const actor = await resolveCurrentConsultationActor(request, mongooseConnection, {
      lecturerId: String(searchParams.get("lecturerId") ?? "").trim(),
      studentId: String(searchParams.get("studentId") ?? "").trim(),
    });

    if (!actor.role || !actor.actorId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!mongooseConnection) {
      const items = listConsultationNotificationsInMemory({
        recipientRole: actor.role,
        recipientId: actor.actorId,
      }).map((row) => toApiNotification(row));

      return NextResponse.json({ items, total: items.length });
    }

    const rows = (await ConsultationNotificationModel.find({
      recipientRole: actor.role,
      recipientId: actor.actorId,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const items = rows
      .map((row) => toConsultationNotificationPersistedRecordFromUnknown(row))
      .filter(Boolean)
      .map((row) => toApiNotification(row as ConsultationNotificationPersistedRecord));

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to load consultation notifications",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
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
    const action = String(body.action ?? "").trim().toLowerCase();

    if (action !== "mark-all-read") {
      return NextResponse.json(
        { message: "Action must be mark-all-read" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const actor = await resolveCurrentConsultationActor(request, mongooseConnection, {
      lecturerId: String(searchParams.get("lecturerId") ?? "").trim(),
      studentId: String(searchParams.get("studentId") ?? "").trim(),
    });

    if (!actor.role || !actor.actorId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!mongooseConnection) {
      const changed = markAllConsultationNotificationsInMemoryAsRead({
        recipientRole: actor.role,
        recipientId: actor.actorId,
      });
      return NextResponse.json({ ok: true, changed });
    }

    const result = await ConsultationNotificationModel.updateMany(
      {
        recipientRole: actor.role,
        recipientId: actor.actorId,
        readAt: null,
      },
      {
        $set: {
          readAt: new Date(),
        },
      }
    )
      .exec()
      .catch(() => null);

    return NextResponse.json({
      ok: true,
      changed: Number(result?.modifiedCount ?? 0),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to update consultation notifications",
      },
      { status: 500 }
    );
  }
}
