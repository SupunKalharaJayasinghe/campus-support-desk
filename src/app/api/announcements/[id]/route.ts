import { NextResponse } from "next/server";
import mongoose from "mongoose";
import "@/models/Announcement";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import { AnnouncementModel } from "@/models/Announcement";
import {
  canManageAnnouncement,
  collapseSpaces,
  resolveAnnouncementActor,
  toAnnouncementApiRecord,
} from "@/models/announcement-api";

function parseId(value: unknown) {
  const id = collapseSpaces(value);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return "";
  }
  return id;
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const announcementId = parseId(params.id);
    if (!announcementId) {
      return NextResponse.json({ message: "Announcement id is required" }, { status: 400 });
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const actor = await resolveAnnouncementActor(request);
    if (!actor) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const row = await AnnouncementModel.findById(announcementId).exec();
    if (!row) {
      return NextResponse.json({ message: "Announcement not found" }, { status: 404 });
    }

    if (row.isDeleted === true) {
      return NextResponse.json(
        { message: "Deleted announcement cannot be updated" },
        { status: 409 }
      );
    }

    const authorUserId = collapseSpaces(row.authorUserId);
    if (!canManageAnnouncement(actor, authorUserId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const nextTitle = collapseSpaces(body.title).slice(0, 180);
    const nextMessage = collapseSpaces(body.message).slice(0, 3000);
    const nextTargetLabel = collapseSpaces(body.targetLabel).slice(0, 140);

    if (!nextTitle && !nextMessage && !nextTargetLabel) {
      return NextResponse.json(
        { message: "Provide title, message, or target label to update" },
        { status: 400 }
      );
    }

    if (nextTitle) {
      row.title = nextTitle;
    }
    if (nextMessage) {
      row.message = nextMessage;
    }
    if (nextTargetLabel) {
      row.targetLabel = nextTargetLabel;
    }

    row.updatedBy = actor.name;
    row.updatedByUserId = actor.userId;
    row.updatedByRole = actor.role;
    row.updatedByEmail = actor.email;

    await row.save();

    const record = toAnnouncementApiRecord(row.toObject(), actor);
    if (!record) {
      return NextResponse.json(
        { message: "Failed to map announcement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: record });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update announcement",
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
    const announcementId = parseId(params.id);
    if (!announcementId) {
      return NextResponse.json({ message: "Announcement id is required" }, { status: 400 });
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const actor = await resolveAnnouncementActor(request);
    if (!actor) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const row = await AnnouncementModel.findById(announcementId).exec();
    if (!row) {
      return NextResponse.json({ message: "Announcement not found" }, { status: 404 });
    }

    const authorUserId = collapseSpaces(row.authorUserId);
    if (!canManageAnnouncement(actor, authorUserId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (row.isDeleted !== true) {
      row.isDeleted = true;
      row.deletedAt = new Date();
      row.deletedBy = actor.name;
      row.deletedByUserId = actor.userId;
      row.deletedByRole = actor.role;
      row.deletedByEmail = actor.email;
      row.updatedBy = actor.name;
      row.updatedByUserId = actor.userId;
      row.updatedByRole = actor.role;
      row.updatedByEmail = actor.email;
      await row.save();
    }

    const record = toAnnouncementApiRecord(row.toObject(), actor);
    if (!record) {
      return NextResponse.json(
        { message: "Failed to map announcement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: record, ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to delete announcement",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const announcementId = parseId(params.id);
  if (!announcementId) {
    return NextResponse.json({ message: "Announcement id is required" }, { status: 400 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const actor = await resolveAnnouncementActor(request);
  const row = await AnnouncementModel.findById(announcementId)
    .lean()
    .exec()
    .catch(() => null);
  if (!row) {
    return NextResponse.json({ message: "Announcement not found" }, { status: 404 });
  }

  const record = toAnnouncementApiRecord(row, actor);
  if (!record) {
    return NextResponse.json({ message: "Failed to map announcement" }, { status: 500 });
  }

  if (record.isDeleted && actor?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Announcement not found" }, { status: 404 });
  }

  return NextResponse.json({ item: record });
}
