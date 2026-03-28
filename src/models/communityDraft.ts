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
  },
  { timestamps: true }
);

const communityDraftModelName = "CommunityDraft";

if (process.env.NODE_ENV === "development" && mongoose.models[communityDraftModelName]) {
  delete mongoose.models[communityDraftModelName];
}

export default mongoose.models[communityDraftModelName] ??
  mongoose.model(communityDraftModelName, CommunityDraftSchema);
