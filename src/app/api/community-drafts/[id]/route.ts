import { connectDB } from "@/lib/mongodb";
import { normalizeOptionalPictureUrl } from "@/lib/community-post-picture";
import {
  urgentFeeFieldsForDb,
  type UrgentLevel,
  type UrgentPaymentMethod,
} from "@/lib/community-urgent";
import {
  dedupeStringsPreserveOrder,
  validateCommunityPostLikeContent,
} from "@/lib/validate-community-post-body";
import CommunityDraft from "@/models/communityDraft";
import mongoose from "mongoose";

type UpdateDraftPayload = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  attachments?: unknown;
  pictureUrl?: unknown;
  status?: unknown;
  userId?: unknown;
  isUrgent?: unknown;
  urgentLevel?: unknown;
  urgentPaymentMethod?: unknown;
  urgentPrepayId?: unknown;
  urgentCardLast4?: unknown;
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
  isUrgent?: boolean;
  urgentLevel?: string | null;
  urgentFeePoints?: number | null;
  urgentFeeRs?: number | null;
  urgentPaymentMethod?: string | null;
  urgentPrepayId?: unknown;
  urgentCardLast4?: string | null;
  urgentCardPaymentRecordId?: unknown;
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
    isUrgent: Boolean(doc.isUrgent),
    urgentLevel:
      doc.urgentLevel === "2days" || doc.urgentLevel === "5days" || doc.urgentLevel === "7days"
        ? (doc.urgentLevel as UrgentLevel)
        : null,
    urgentFeePoints: typeof doc.urgentFeePoints === "number" ? doc.urgentFeePoints : null,
    urgentFeeRs: typeof doc.urgentFeeRs === "number" ? doc.urgentFeeRs : null,
    urgentPaymentMethod:
      doc.urgentPaymentMethod === "points" || doc.urgentPaymentMethod === "card"
        ? (doc.urgentPaymentMethod as UrgentPaymentMethod)
        : null,
    urgentPrepayId: doc.urgentPrepayId ? String(doc.urgentPrepayId) : null,
    urgentCardLast4:
      typeof doc.urgentCardLast4 === "string" && /^\d{4}$/.test(doc.urgentCardLast4)
        ? doc.urgentCardLast4
        : null,
    urgentCardPaymentRecordId: doc.urgentCardPaymentRecordId
      ? String(doc.urgentCardPaymentRecordId)
      : null,
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

    const pictureNorm = normalizeOptionalPictureUrl(body.pictureUrl);
    if (!pictureNorm.ok) {
      return Response.json({ error: pictureNorm.error }, { status: 400 });
    }

    const existingDraft = await CommunityDraft.findOne({
      _id: params.id,
      author: userId,
    }).lean();

    if (!existingDraft) {
      return Response.json({ error: "Draft not found" }, { status: 404 });
    }

    const isUrgent = Boolean(body.isUrgent);
    const urgentLevelRaw = toTrimmedString(body.urgentLevel) as UrgentLevel;
    const urgentLevel: UrgentLevel =
      urgentLevelRaw === "5days" || urgentLevelRaw === "7days" ? urgentLevelRaw : "2days";
    const urgentPaymentMethodRaw = toTrimmedString(body.urgentPaymentMethod) as UrgentPaymentMethod;
    const urgentPaymentMethod: UrgentPaymentMethod =
      urgentPaymentMethodRaw === "card" ? "card" : "points";
    const urgentFees = urgentFeeFieldsForDb(
      isUrgent,
      isUrgent ? urgentLevel : null,
      isUrgent ? urgentPaymentMethod : null
    );

    const urgentPrepayIdRaw = toTrimmedString(body.urgentPrepayId);
    const urgentPrepayId =
      urgentPrepayIdRaw && mongoose.Types.ObjectId.isValid(urgentPrepayIdRaw)
        ? urgentPrepayIdRaw
        : null;

    const urgentCardLast4Raw = toTrimmedString(body.urgentCardLast4);
    let urgentCardLast4: string | null = null;
    if (isUrgent && urgentPaymentMethod === "card") {
      if (!/^\d{4}$/.test(urgentCardLast4Raw)) {
        return Response.json(
          { error: "Enter the last 4 digits of your card to save an urgent card draft." },
          { status: 400 }
        );
      }
      urgentCardLast4 = urgentCardLast4Raw;
    }

    const urgentPaymentLocked =
      Boolean(existingDraft.isUrgent) &&
      (!!existingDraft.urgentCardPaymentRecordId || !!existingDraft.urgentPrepayId);

    if (urgentPaymentLocked) {
      const exLevel = existingDraft.urgentLevel;
      const exMethod = existingDraft.urgentPaymentMethod;
      if (
        !isUrgent ||
        !Boolean(existingDraft.isUrgent) ||
        urgentLevel !== exLevel ||
        urgentPaymentMethod !== exMethod
      ) {
        return Response.json(
          {
            error:
              "This draft's urgent fee is already paid. Urgent duration, payment method, and card settings cannot be changed.",
          },
          { status: 400 }
        );
      }
    }

    const urgentPlanFrozen =
      Boolean(existingDraft.isUrgent) && !urgentPaymentLocked;

    if (urgentPlanFrozen) {
      const exLevel = existingDraft.urgentLevel;
      const exMethod = existingDraft.urgentPaymentMethod;
      if (!isUrgent || urgentLevel !== exLevel || urgentPaymentMethod !== exMethod) {
        return Response.json(
          {
            error:
              "This draft is already urgent. You cannot change urgent duration, turn off urgent, or switch payment method when updating the draft.",
          },
          { status: 400 }
        );
      }
    }

    const urgentSetLocked = {
      isUrgent: existingDraft.isUrgent,
      urgentLevel: existingDraft.urgentLevel,
      urgentFeePoints: existingDraft.urgentFeePoints,
      urgentFeeRs: existingDraft.urgentFeeRs,
      urgentPaymentMethod: existingDraft.urgentPaymentMethod,
      urgentPrepayId: existingDraft.urgentPrepayId,
      urgentCardLast4: existingDraft.urgentCardLast4,
      urgentCardPaymentRecordId: existingDraft.urgentCardPaymentRecordId,
    };

    const urgentSetUnlocked: Record<string, unknown> = {
      isUrgent,
      urgentLevel: isUrgent ? urgentLevel : null,
      urgentFeePoints: urgentFees.urgentFeePoints,
      urgentFeeRs: urgentFees.urgentFeeRs,
      urgentPaymentMethod: isUrgent ? urgentPaymentMethod : null,
      urgentPrepayId: isUrgent && urgentPaymentMethod === "points" ? urgentPrepayId : null,
      urgentCardLast4: isUrgent && urgentPaymentMethod === "card" ? urgentCardLast4 : null,
    };
    if (!isUrgent || urgentPaymentMethod !== "card") {
      urgentSetUnlocked.urgentCardPaymentRecordId = null;
    }

    const urgentSet = urgentPaymentLocked ? urgentSetLocked : urgentSetUnlocked;

    const updated = await CommunityDraft.findOneAndUpdate(
      { _id: params.id, author: userId },
      {
        $set: {
          title,
          description,
          category,
          tags,
          attachments,
          status,
          pictureUrl: pictureNorm.value ?? null,
          ...urgentSet,
        },
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
