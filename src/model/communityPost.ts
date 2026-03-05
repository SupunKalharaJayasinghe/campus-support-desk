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

  attachments: [
    {
      type: String,
    },
  ],

  status: {
    type: String,
    enum: ["open", "resolved"],
    default: "open",
  },
},
{ timestamps: true }
);

export default mongoose.models.CommunityPost ||
mongoose.model("CommunityPost", CommunityPostSchema);