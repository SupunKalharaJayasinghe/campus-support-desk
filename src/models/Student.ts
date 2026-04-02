import mongoose, { Schema } from "mongoose";

const StudentSchema = new Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    nicNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    optionalEmail: { type: String, trim: true, lowercase: true, default: "" },
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

StudentSchema.index({ status: 1, updatedAt: -1 });

const StudentModel =
  mongoose.models.Student || mongoose.model("Student", StudentSchema);

export { StudentModel, StudentSchema };
