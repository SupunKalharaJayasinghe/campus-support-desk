import mongoose, { Schema } from "mongoose";

const CommunityProfileSchema = new Schema(
  {
    userRef: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one profile per user
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      maxLength: 30,
    },

    points: {
      type: Number,
      default: 0,
    },

    level: {
      type: String,
      enum: ["BEGINNER", "HELPER", "EXPERT"],
      default: "BEGINNER",
    },

    status : {
      type: String,
      enum: ["PUBLIC", "PRIVATE"],
      default: "PUBLIC",
    },
  },
  { timestamps: true }
);

export const CommunityProfileModel =
  mongoose.models.CommunityProfile ||
  mongoose.model("CommunityProfile", CommunityProfileSchema);