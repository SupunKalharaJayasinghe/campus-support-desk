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
      maxLength: 1_200_000,
      default: "",
    },

    points: {
      type: Number,
      default: 0,
    },

    /** Community leaderboard / profile stats (may be updated by jobs or admins). */
    reputation: {
      type: Number,
      default: 0,
    },

    profileRank: {
      type: Number,
      default: 0,
    },

    profileViews: {
      type: Number,
      default: 0,
    },

    activeStreakDays: {
      type: Number,
      default: 0,
    },

    postsCount: {
      type: Number,
      default: 0,
    },

    repliesCount: {
      type: Number,
      default: 0,
    },

    helpfulVotesCount: {
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

    /** One-time community admin +20 points bonus per profile. */
    adminBonus20Used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const CommunityProfileModel =
  mongoose.models.CommunityProfile ||
  mongoose.model("CommunityProfile", CommunityProfileSchema);