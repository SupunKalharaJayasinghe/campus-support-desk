import mongoose, { Schema } from "mongoose";

const UserBadgeSchema = new Schema(
{
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  badgeId: {
    type: Schema.Types.ObjectId,
    ref: "Badge",
    required: true,
  },

  earnedAt: {
    type: Date,
    default: Date.now,
  },
},
{ timestamps: true }
);

export default mongoose.models.UserBadge ||
mongoose.model("UserBadge", UserBadgeSchema);