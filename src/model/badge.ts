import mongoose, { Schema } from "mongoose";

const BadgeSchema = new Schema(
{
  name: {
    type: String,
    required: true,
  },

  description: {
    type: String,
  },

  icon: {
    type: String,
  },

  pointsRequired: {
    type: Number,
    default: 0,
  },
},
{ timestamps: true }
);

export default mongoose.models.Badge ||
mongoose.model("Badge", BadgeSchema);