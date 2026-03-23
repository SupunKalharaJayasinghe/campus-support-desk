import mongoose, { Schema } from "mongoose";

const ReplyVoteSchema = new Schema(
{
  replyId: {
    type: Schema.Types.ObjectId,
    ref: "CommunityReply",
    required: true,
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
},
{ timestamps: true }
);

ReplyVoteSchema.index({ replyId: 1, userId: 1 }, { unique: true });

export default mongoose.models.ReplyVote ||
mongoose.model("ReplyVote", ReplyVoteSchema);