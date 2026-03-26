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

export default mongoose.models.CommunityPost ||
mongoose.model("CommunityPost", CommunityPostSchema);
