import { connectDB } from "@/lib/mongodb";
import { resolveCommunityActorId } from "@/lib/community-user";
import {
  amountRsForUrgentLevel,
  luhnValid,
  maskCardDisplay,
  parseCardExpiry,
  validateCvc,
} from "@/lib/community-urgent-card-payment-utils";
import {
  encryptPanOptional,
  getUrgentPaymentEncryptionKey,
} from "@/lib/community-urgent-card-payment-crypto";
import type { UrgentLevel } from "@/lib/community-urgent";
import CommunityDraft from "@/models/communityDraft";
import { CommunityUrgentCardPaymentModel } from "@/models/communityUrgentCardPayment";
import mongoose from "mongoose";

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type Body = {
  userId?: unknown;
  username?: unknown;
  email?: unknown;
  name?: unknown;
  authorDisplayName?: unknown;
  draftId?: unknown;
  urgentLevel?: unknown;
  cardNumber?: unknown;
  cardExpiry?: unknown;
  cardCvc?: unknown;
};

export async function POST(req: Request) {
  try {
    await connectDB();
    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const authorId = await resolveCommunityActorId({
      userId: body.userId,
      username: body.username,
      email: body.email,
      name: body.name,
    });
    if (!authorId) {
      return Response.json({ error: "Log in to record card payment." }, { status: 401 });
    }

    const urgentLevelRaw = toTrimmedString(body.urgentLevel) as UrgentLevel;
    const urgentLevel: UrgentLevel =
      urgentLevelRaw === "5days" || urgentLevelRaw === "7days" ? urgentLevelRaw : "2days";
    const amountRs = amountRsForUrgentLevel(urgentLevel);

    const digits = toTrimmedString(body.cardNumber).replace(/\D/g, "");
    if (digits.length < 12 || digits.length > 19) {
      return Response.json({ error: "Enter a valid card number." }, { status: 400 });
    }
    if (!luhnValid(digits)) {
      return Response.json({ error: "Card number failed validation." }, { status: 400 });
    }

    const expiry = parseCardExpiry(toTrimmedString(body.cardExpiry));
    if (!expiry) {
      return Response.json({ error: "Enter a valid expiry (MM/YY, not in the past)." }, { status: 400 });
    }

    const cvcCheck = validateCvc(toTrimmedString(body.cardCvc));
    if (!cvcCheck.ok) {
      return Response.json({ error: "Enter a valid 3-digit CVC." }, { status: 400 });
    }

    const { bin6, last4, masked } = maskCardDisplay(digits);
    if (!/^\d{4}$/.test(last4)) {
      return Response.json({ error: "Could not read card last 4 digits." }, { status: 400 });
    }

    const encKey = getUrgentPaymentEncryptionKey();
    const panEncrypted = encryptPanOptional(digits, encKey) ?? null;

    const displayName =
      toTrimmedString(body.authorDisplayName) ||
      toTrimmedString(body.name) ||
      "Community User";

    const draftIdRaw = toTrimmedString(body.draftId);
    const draftObjectId =
      draftIdRaw && mongoose.Types.ObjectId.isValid(draftIdRaw)
        ? new mongoose.Types.ObjectId(draftIdRaw)
        : null;

    if (draftObjectId) {
      const owns = await CommunityDraft.exists({ _id: draftObjectId, author: authorId });
      if (!owns) {
        return Response.json({ error: "Draft not found." }, { status: 404 });
      }
    }

    const payload = {
      userRef: new mongoose.Types.ObjectId(authorId),
      draftRef: draftObjectId,
      postRef: null,
      status: "pending" as const,
      amountRs,
      urgentLevel,
      userUsername: toTrimmedString(body.username),
      userEmail: toTrimmedString(body.email).toLowerCase(),
      displayName,
      cardBin6: bin6,
      cardLast4: last4,
      cardMaskedDisplay: masked,
      panEncrypted,
      expiryMonth: expiry.month,
      expiryYear: expiry.year,
      cvcVerified: true,
      cvcLength: cvcCheck.length,
    };

    let doc;
    if (draftObjectId) {
      doc = await CommunityUrgentCardPaymentModel.findOneAndUpdate(
        {
          userRef: new mongoose.Types.ObjectId(authorId),
          draftRef: draftObjectId,
          status: "pending",
        },
        { $set: payload },
        { upsert: true, new: true }
      ).lean();
    } else {
      doc = (
        await CommunityUrgentCardPaymentModel.create({
          ...payload,
          draftRef: null,
        })
      ).toObject();
    }

    if (doc == null || doc._id == null) {
      return Response.json({ error: "Failed to persist payment record" }, { status: 500 });
    }

    const paymentId = String(doc._id);

    if (draftObjectId) {
      await CommunityDraft.updateOne(
        { _id: draftObjectId, author: authorId },
        { $set: { urgentCardPaymentRecordId: new mongoose.Types.ObjectId(paymentId) } }
      );
    }

    return Response.json({
      id: paymentId,
      amountRs,
      urgentLevel,
      cardLast4: last4,
      panStoredEncrypted: Boolean(panEncrypted),
    });
  } catch (e) {
    console.error("community-urgent-card-payment POST failed", e);
    return Response.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
