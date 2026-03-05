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
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    facultyId: { type: String, required: true, trim: true, uppercase: true },
    degreeProgramId: { type: String, required: true, trim: true, uppercase: true },
    intakeId: { type: String, required: true, trim: true },
    stream: {
      type: String,
      required: true,
      enum: ["WEEKDAY", "WEEKEND"],
      default: "WEEKDAY",
    },
    subgroup: { type: String, trim: true, default: null },
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

StudentSchema.index({ facultyId: 1, degreeProgramId: 1, intakeId: 1 });
StudentSchema.index({ status: 1, updatedAt: -1 });

const StudentModel =
  mongoose.models.Student || mongoose.model("Student", StudentSchema);

export { StudentModel, StudentSchema };
