import mongoose, { Schema } from "mongoose";

const CommunityDraftSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["lost_item", "study_material", "academic_question"],
      required: true,
    },
    tags: [
      {
        type: String,
      },
    ],
    attachments: [
      {
        type: String,
      },
    ],
    pictureUrl: {
      type: String,
      maxLength: 2500000,
      default: null,
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // URGENT + PAYMENT (stored on draft; locked during draft updates)
    isUrgent: {
      type: Boolean,
      default: false,
    },
    urgentLevel: {
      type: String,
      enum: ["2days", "5days", "7days"],
      default: null,
    },
    urgentFeePoints: {
      type: Number,
      default: null,
    },
    /** INR amount for urgent when paid by card (demo); null when not card or not urgent. */
    urgentFeeRs: {
      type: Number,
      default: null,
    },
    urgentPaymentMethod: {
      type: String,
      enum: ["points", "card"],
      default: null,
    },
    /**
     * When urgent is paid by points *before* posting, we store a short-lived prepay id on the draft.
     * Posting consumes the prepay so points are not deducted twice.
     */
    urgentPrepayId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityUrgentPrepay",
      default: null,
    },
    /** Last 4 digits when urgent is paid by card (demo flow; matches post storage). */
    urgentCardLast4: {
      type: String,
      default: null,
      maxlength: 4,
    },
    /** Latest pending card payment audit row linked to this draft (see CommunityUrgentCardPayment). */
    urgentCardPaymentRecordId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityUrgentCardPayment",
      default: null,
    },
  },
  { timestamps: true }
);

const communityDraftModelName = "CommunityDraft";

if (process.env.NODE_ENV === "development" && mongoose.models[communityDraftModelName]) {
  delete mongoose.models[communityDraftModelName];
}

export default mongoose.models[communityDraftModelName] ??
  mongoose.model(communityDraftModelName, CommunityDraftSchema);
