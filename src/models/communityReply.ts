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

  message: {
    type: String,
    required: true,
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

export default mongoose.models.CommunityReply ||
mongoose.model("CommunityReply", CommunityReplySchema);