import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
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
      enum: ["ADMIN", "LECTURER", "LAB_ASSISTANT", "STUDENT","COMMUNITY_ADMIN"],
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

const existingModel = mongoose.models.User as
  | mongoose.Model<unknown>
  | undefined;

const existingRoleEnums = existingModel?.schema?.path("role") as
  | { enumValues?: string[] }
  | undefined;
if (
  existingModel &&
  Array.isArray(existingRoleEnums?.enumValues) &&
  !existingRoleEnums.enumValues.includes("COMMUNITY_ADMIN")
) {
  delete mongoose.models.User;
}

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

export { UserModel, UserSchema };
