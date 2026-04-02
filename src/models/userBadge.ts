import mongoose, { Schema } from "mongoose";

const UserBadgeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    badgeId: {
      type: Schema.Types.ObjectId,
      ref: "Badge",
      required: true,
      index: true,
    },
    awardedAt: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

UserBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

const UserBadgeModel =
  mongoose.models.UserBadge || mongoose.model("UserBadge", UserBadgeSchema);

export default UserBadgeModel;
