import mongoose, { Schema } from "mongoose";

const CommunityPostSchema = new Schema(
{
  title: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    required: true,
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

  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  authorDisplayName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 50,
  },

  attachments: [
    {
      type: String,
    },
  ],

  /** Optional image: https URL or data:image/... from client upload */
  pictureUrl: {
    type: String,
    maxLength: 2500000,
    default: null,
  },

  status: {
    type: String,
    enum: ["open", "resolved", "archived"],
    default: "open",
  },

    status2: {
    type: String,
    enum: ["resolved", "not_resolved"],
    default: "not_resolved",
  },
  
},
{ timestamps: true }
);

const communityPostModelName = "CommunityPost";

// Next.js can reuse a cached Mongoose model without new schema fields. Bust cache in dev
// so `pictureUrl` and other updates are applied. Restart the dev server if issues persist.
if (process.env.NODE_ENV === "development" && mongoose.models[communityPostModelName]) {
  delete mongoose.models[communityPostModelName];
}

export default mongoose.models[communityPostModelName] ??
  mongoose.model(communityPostModelName, CommunityPostSchema);
