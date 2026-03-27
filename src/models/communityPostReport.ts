import mongoose, { Schema } from "mongoose";

const CommunityPostReportSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityPost",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    reasonKey: {
      type: String,
      enum: ["spam", "harassment", "misinformation", "inappropriate", "copyright", "other"],
      required: false,
      index: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["OPEN", "REVIEWED", "AGREED", "DISMISSED"],
      default: "OPEN",
      index: true,
    },
    adminReviewAcknowledged: {
      type: Boolean,
      default: false,
    },
    reviewComment: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
  },
  { timestamps: true }
);

CommunityPostReportSchema.index({ postId: 1, userId: 1 }, { unique: true });
CommunityPostReportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.CommunityPostReport ||
  mongoose.model("CommunityPostReport", CommunityPostReportSchema);

