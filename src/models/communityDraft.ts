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

export default mongoose.models.CommunityDraft ||
  mongoose.model("CommunityDraft", CommunityDraftSchema);
