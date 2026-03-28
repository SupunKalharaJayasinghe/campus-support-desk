import { connectDB } from "@/lib/mongodb";
import { resolveCommunityActorId } from "@/lib/community-user";
import { normalizeOptionalPictureUrl } from "@/lib/community-post-picture";
import {
  dedupeStringsPreserveOrder,
  validateCommunityPostLikeContent,
} from "@/lib/validate-community-post-body";
import CommunityDraft from "@/models/communityDraft";
import mongoose from "mongoose";

type DraftPayload = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  attachments?: unknown;
  pictureUrl?: unknown;
  status?: unknown;
  author?: unknown;
  authorUsername?: unknown;
  authorEmail?: unknown;
  authorName?: unknown;
  authorDisplayName?: unknown;
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
  pictureUrl?: string | null;
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
    pictureUrl: typeof doc.pictureUrl === "string" ? doc.pictureUrl : "",
    status: doc.status === "resolved" ? "resolved" : "open",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const userId = toTrimmedString(searchParams.get("userId"));

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return Response.json({ error: "Valid userId is required" }, { status: 400 });
    }

    const drafts = await CommunityDraft.find({ author: userId }).sort({ updatedAt: -1 }).lean();
    return Response.json(drafts.map((draft) => normalizeDraft(draft)));
  } catch (error) {
    console.error("community-drafts GET failed", error);
    return Response.json({ error: "Failed to fetch drafts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    let body: DraftPayload;
    try {
      body = (await req.json()) as DraftPayload;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
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

    const tags = dedupeStringsPreserveOrder(
      Array.isArray(body.tags)
        ? body.tags.map((item) => toTrimmedString(item)).filter((item) => Boolean(item))
        : []
    );
    const attachments = dedupeStringsPreserveOrder(
      Array.isArray(body.attachments)
        ? body.attachments.map((item) => toTrimmedString(item)).filter((item) => Boolean(item))
        : []
    );

    const contentCheck = validateCommunityPostLikeContent({
      title,
      description,
      tags,
      attachments,
    });
    if (!contentCheck.ok) {
      return Response.json({ error: contentCheck.error }, { status: 400 });
    }

    const authorId = await resolveCommunityActorId({
      userId: body.author,
      username: body.authorUsername,
      email: body.authorEmail,
      name: body.authorName || body.authorDisplayName,
    });

    if (!authorId) {
      return Response.json({ error: "Only logged-in users can save drafts" }, { status: 401 });
    }

    const pictureNorm = normalizeOptionalPictureUrl(body.pictureUrl);
    if (!pictureNorm.ok) {
      return Response.json({ error: pictureNorm.error }, { status: 400 });
    }

    const draft = await CommunityDraft.create({
      title,
      description,
      category,
      tags,
      attachments,
      pictureUrl: pictureNorm.value ?? null,
      status,
      author: authorId,
    });

    return Response.json(normalizeDraft(draft.toObject()), { status: 201 });
  } catch (error) {
    console.error("community-drafts POST failed", error);
    return Response.json({ error: "Failed to save draft" }, { status: 500 });
  }
}
