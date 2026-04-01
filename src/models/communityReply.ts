import mongoose, { Schema } from "mongoose";

const CommunityReplySchema = new Schema(
{
  postId: {
    type: Schema.Types.ObjectId,
    ref: "CommunityPost",
    required: true,
  },

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

  /** May be empty when the reply is attachment-only */
  message: {
    type: String,
    default: "",
  },

  /** Optional: https URL or data URL (PDF, image, Word, plain text) */
  attachmentUrl: {
    type: String,
    maxLength: 2_500_000,
    default: null,
  },

  /** Original file name for display when attachmentUrl is set */
  attachmentName: {
    type: String,
    trim: true,
    maxLength: 200,
    default: null,
  },

  upvotes: {
    type: Number,
    default: 0,
  },

  isAccepted: {
    type: Boolean,
    default: false,
  },
},
{ timestamps: true }
);

const communityReplyModelName = "CommunityReply";

if (
  process.env.NODE_ENV === "development" &&
  mongoose.models[communityReplyModelName]
) {
  delete mongoose.models[communityReplyModelName];
}

export default mongoose.models[communityReplyModelName] ||
  mongoose.model(communityReplyModelName, CommunityReplySchema);
