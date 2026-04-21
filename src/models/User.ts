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
      enum: [
        "ADMIN",
        "LECTURER",
        "LAB_ASSISTANT",
        "STUDENT",
        "COMMUNITY_ADMIN",
        "TECHNICIAN",
      ],
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
    /** Area of focus (e.g. hardware, networking); used for technicians (`TECHNICIAN`). */
    specialization: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
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
/** Drop stale compiled model so enum updates (e.g. TECHNICIAN) apply in dev/hot reload. */
const roleEnum = existingRoleEnums?.enumValues;
if (
  existingModel &&
  Array.isArray(roleEnum) &&
  (!roleEnum.includes("COMMUNITY_ADMIN") || !roleEnum.includes("TECHNICIAN"))
) {
  delete mongoose.models.User;
}

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

export { UserModel, UserSchema };
