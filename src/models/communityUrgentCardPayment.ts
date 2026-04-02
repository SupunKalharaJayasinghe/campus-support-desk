import mongoose, { Schema } from "mongoose";

/**
 * Audit trail for urgent post fees paid by card (demo / manual reconciliation).
 * PCI: CVC is never stored. Full PAN is only stored encrypted when COMMUNITY_URGENT_PAYMENT_KEY is set.
 */
const CommunityUrgentCardPaymentSchema = new Schema(
  {
    userRef: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    draftRef: {
      type: Schema.Types.ObjectId,
      ref: "CommunityDraft",
      default: null,
      index: true,
    },
    postRef: {
      type: Schema.Types.ObjectId,
      ref: "CommunityPost",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "consumed"],
      default: "pending",
      index: true,
    },
    amountRs: { type: Number, required: true },
    urgentLevel: {
      type: String,
      enum: ["2days", "5days", "7days"],
      required: true,
    },
    userUsername: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    displayName: { type: String, default: "" },
    cardBin6: { type: String, default: "" },
    cardLast4: { type: String, default: "", maxlength: 4 },
    cardMaskedDisplay: { type: String, default: "" },
    /** AES-256-GCM blob when encryption key configured; otherwise null. */
    panEncrypted: { type: String, default: null },
    expiryMonth: { type: Number, required: true },
    expiryYear: { type: Number, required: true },
    /** Whether a valid-length CVC was supplied at checkout (value never stored). */
    cvcVerified: { type: Boolean, default: false },
    cvcLength: { type: Number, default: null },
  },
  { timestamps: true }
);

CommunityUrgentCardPaymentSchema.index({ userRef: 1, draftRef: 1, status: 1 });

const name = "CommunityUrgentCardPayment";

if (process.env.NODE_ENV === "development" && mongoose.models[name]) {
  delete mongoose.models[name];
}

export const CommunityUrgentCardPaymentModel =
  mongoose.models[name] ?? mongoose.model(name, CommunityUrgentCardPaymentSchema);
