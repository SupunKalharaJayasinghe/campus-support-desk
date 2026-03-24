import mongoose, { Schema } from "mongoose";

const CommunityPostLikeSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityPost",
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

CommunityPostLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });

export default mongoose.models.CommunityPostLike ||
  mongoose.model("CommunityPostLike", CommunityPostLikeSchema);

