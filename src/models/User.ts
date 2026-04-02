import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    fullName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["ADMIN", "LOST_ITEM_ADMIN", "LECTURER", "LAB_ASSISTANT", "STUDENT"],
      default: "STUDENT",
    },
    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, default: true },
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    studentRef: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      default: null,
      index: true,
    },
    lecturerRef: {
      type: Schema.Types.ObjectId,
      ref: "Lecturer",
      default: null,
      index: true,
    },
    labAssistantRef: {
      type: Schema.Types.ObjectId,
      ref: "LabAssistant",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

UserSchema.index({ role: 1, status: 1 });

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

export { UserModel, UserSchema };
