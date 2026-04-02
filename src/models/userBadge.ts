import mongoose, { Schema, type InferSchemaType } from "mongoose";

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
  },
  { timestamps: true }
);

UserBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

export type UserBadgeDocument = InferSchemaType<typeof UserBadgeSchema>;

export default mongoose.models.UserBadge ||
  mongoose.model("UserBadge", UserBadgeSchema);
