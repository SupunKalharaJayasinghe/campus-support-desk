import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
{
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["student", "admin"],
    default: "student",
  },

  reputation: {
    type: Number,
    default: 0,
  },

  avatar: {
    type: String,
  },
},
{ timestamps: true }
);

export default mongoose.models.User ||
mongoose.model("User", UserSchema);