import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ConsultationNotification";
import { ConsultationNotificationModel } from "@/models/ConsultationNotification";
import { connectMongoose } from "@/models/mongoose";
import {
  findConsultationNotificationInMemoryById,
  markConsultationNotificationInMemoryAsRead,
  toConsultationNotificationPersistedRecordFromUnknown,
} from "@/models/consultation-notification-store";
import { resolveCurrentConsultationActor } from "@/app/api/consultation-bookings/shared";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = String(params.id ?? "").trim();
    if (!notificationId) {
      return NextResponse.json(
        { message: "Notification id is required" },
        { status: 400 }
      );
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    const { searchParams } = new URL(request.url);
    const actor = await resolveCurrentConsultationActor(request, mongooseConnection, {
      lecturerId: String(searchParams.get("lecturerId") ?? "").trim(),
      studentId: String(searchParams.get("studentId") ?? "").trim(),
    });

    if (!actor.role || !actor.actorId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!mongooseConnection) {
      const current = findConsultationNotificationInMemoryById(notificationId);
      if (!current) {
        return NextResponse.json(
          { message: "Notification not found" },
          { status: 404 }
        );
      }

      if (
        current.recipientRole !== actor.role ||
        current.recipientId !== actor.actorId
      ) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      const updated = markConsultationNotificationInMemoryAsRead(notificationId);
      return NextResponse.json({ ok: true, item: updated });
    }

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return NextResponse.json(
        { message: "Invalid notification id" },
        { status: 400 }
      );
    }

    const row = await ConsultationNotificationModel.findById(notificationId).exec();
    if (!row) {
      return NextResponse.json(
        { message: "Notification not found" },
        { status: 404 }
      );
    }

    const current =
      toConsultationNotificationPersistedRecordFromUnknown(row.toObject()) ?? null;
    if (!current) {
      return NextResponse.json(
        { message: "Notification not found" },
        { status: 404 }
      );
    }

    if (
      current.recipientRole !== actor.role ||
      current.recipientId !== actor.actorId
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    row.readAt = row.readAt ?? new Date();
    await row.save();

    return NextResponse.json({
      ok: true,
      item: toConsultationNotificationPersistedRecordFromUnknown(row.toObject()),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to update consultation notification",
      },
      { status: 500 }
    );
  }
}
