import mongoose, { Schema } from "mongoose";

const CommunityReplyLikeSchema = new Schema(
  {
    replyId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityReply",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

CommunityReplyLikeSchema.index({ replyId: 1, userId: 1 }, { unique: true });

export default mongoose.models.CommunityReplyLike ||
  mongoose.model("CommunityReplyLike", CommunityReplyLikeSchema);

