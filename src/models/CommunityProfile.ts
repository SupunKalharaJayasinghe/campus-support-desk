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

    bio: {
      type: String,
      maxLength: 150,
      default: "",
    },

    avatar: {
      type: String, // image URL
      default: "",
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
  },
  { timestamps: true }
);

export const CommunityProfileModel =
  mongoose.models.CommunityProfile ||
  mongoose.model("CommunityProfile", CommunityProfileSchema);