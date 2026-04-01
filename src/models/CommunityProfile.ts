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

    username: {
      type: String,
      trim: true,
      maxLength: 40,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      maxLength: 120,
      default: "",
    },

    bio: {
      type: String,
      trim: true,
      maxLength: 500,
      default: "",
    },

    faculty: {
      type: String,
      trim: true,
      maxLength: 80,
      default: "Computing",
    },

    studyYear: {
      type: String,
      trim: true,
      maxLength: 40,
      default: "Year 2",
    },

    avatarUrl: {
      type: String,
      trim: true,
      maxLength: 2048,
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

    status: {
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