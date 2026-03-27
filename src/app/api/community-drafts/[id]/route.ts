import { connectDB } from "@/lib/mongodb";
import CommunityDraft from "@/models/communityDraft";
import mongoose from "mongoose";

type UpdateDraftPayload = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  attachments?: unknown;
  status?: unknown;
  userId?: unknown;
};

const ALLOWED_CATEGORIES = new Set([
  "lost_item",
  "study_material",
  "academic_question",
]);

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDraft(doc: {
  _id: unknown;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  attachments?: string[];
  status?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}) {
  return {
    id: String(doc._id),
    title: doc.title ?? "",
    description: doc.description ?? "",
    category: doc.category ?? "study_material",
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
    status: doc.status === "resolved" ? "resolved" : "open",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid draft id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as UpdateDraftPayload;
    const userId = toTrimmedString(body.userId);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return Response.json({ error: "Valid userId is required" }, { status: 400 });
    }

    const title = toTrimmedString(body.title);
    const description = toTrimmedString(body.description);
    const category = toTrimmedString(body.category);
    const status = body.status === "resolved" ? "resolved" : "open";

    if (!title || !description || !ALLOWED_CATEGORIES.has(category)) {
      return Response.json(
        { error: "title, description, and valid category are required" },
        { status: 400 }
      );
    }

    const tags = Array.isArray(body.tags)
      ? body.tags.map((item) => toTrimmedString(item)).filter((item) => Boolean(item))
      : [];
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.map((item) => toTrimmedString(item)).filter((item) => Boolean(item))
      : [];

    const updated = await CommunityDraft.findOneAndUpdate(
      { _id: params.id, author: userId },
      {
        $set: { title, description, category, tags, attachments, status },
      },
      { new: true }
    ).lean();

    if (updated == null || Array.isArray(updated)) {
      return Response.json({ error: "Draft not found" }, { status: 404 });
    }

    return Response.json(normalizeDraft(updated));
  } catch (error) {
    console.error("community-drafts/[id] PATCH failed", error);
    return Response.json({ error: "Failed to update draft" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid draft id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const userId = toTrimmedString(searchParams.get("userId"));

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return Response.json({ error: "Valid userId is required" }, { status: 400 });
    }

    const deleted = await CommunityDraft.findOneAndDelete({
      _id: params.id,
      author: userId,
    }).lean();

    if (!deleted) {
      return Response.json({ error: "Draft not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("community-drafts/[id] DELETE failed", error);
    return Response.json({ error: "Failed to delete draft" }, { status: 500 });
  }
}
