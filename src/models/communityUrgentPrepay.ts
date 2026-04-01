import mongoose, { Schema } from "mongoose";

const CommunityUrgentPrepaySchema = new Schema(
  {
    userRef: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    urgentLevel: {
      type: String,
      enum: ["2days", "5days", "7days"],
      required: true,
    },
    feePoints: {
      type: Number,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const CommunityUrgentPrepayModel =
  mongoose.models.CommunityUrgentPrepay ||
  mongoose.model("CommunityUrgentPrepay", CommunityUrgentPrepaySchema);
