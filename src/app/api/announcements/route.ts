import { NextResponse } from "next/server";
import "@/models/Announcement";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import { AnnouncementModel } from "@/models/Announcement";
import {
  collapseSpaces,
  parseBooleanQuery,
  parseLimit,
  resolveAnnouncementActor,
  toAnnouncementApiRecord,
} from "@/models/announcement-api";

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));
  const includeDeletedRequested = parseBooleanQuery(
    searchParams.get("includeDeleted")
  );
  const actor = await resolveAnnouncementActor(request);
  const includeDeleted = includeDeletedRequested && actor?.role === "SUPER_ADMIN";

  const mongoQuery: Record<string, unknown> = includeDeleted
    ? {}
    : { isDeleted: { $ne: true } };

  const query = AnnouncementModel.find(mongoQuery).sort({ createdAt: -1 });
  if (typeof limit === "number") {
    query.limit(limit);
  }

  const rows = (await query
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toAnnouncementApiRecord(row, actor))
    .filter((row): row is NonNullable<ReturnType<typeof toAnnouncementApiRecord>> =>
      Boolean(row)
    );

  return NextResponse.json({ items });
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

    const actor = await resolveAnnouncementActor(request);
    if (!actor) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const title = collapseSpaces(body.title).slice(0, 180);
    const message = collapseSpaces(body.message).slice(0, 3000);
    const targetLabel =
      collapseSpaces(body.targetLabel || "All users").slice(0, 140) || "All users";
    if (!title || !message) {
      return NextResponse.json(
        { message: "Title and message are required" },
        { status: 400 }
      );
    }

    const created = await AnnouncementModel.create({
      title,
      message,
      targetLabel,
      createdBy: actor.name,
      authorUserId: actor.userId,
      authorRole: actor.role,
      authorEmail: actor.email,
      updatedBy: actor.name,
      updatedByUserId: actor.userId,
      updatedByRole: actor.role,
      updatedByEmail: actor.email,
      isDeleted: false,
    });

    const record = toAnnouncementApiRecord(created.toObject(), actor);
    if (!record) {
      return NextResponse.json(
        { message: "Failed to map announcement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to publish announcement",
      },
      { status: 500 }
    );
  }
}
