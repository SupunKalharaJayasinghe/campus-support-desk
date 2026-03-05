import mongoose, { Schema } from "mongoose";

const EnrollmentSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    facultyId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    degreeProgramId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    intakeId: {
      type: String,
      required: true,
      trim: true,
    },
    stream: {
      type: String,
      required: true,
      enum: ["WEEKDAY", "WEEKEND"],
      default: "WEEKDAY",
    },
    subgroup: {
      type: String,
      trim: true,
      default: null,
    },
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

EnrollmentSchema.index(
  { studentId: 1, degreeProgramId: 1, intakeId: 1 },
  { unique: true }
);
EnrollmentSchema.index({ studentId: 1, updatedAt: -1 });

const EnrollmentModel =
  mongoose.models.Enrollment || mongoose.model("Enrollment", EnrollmentSchema);

export { EnrollmentModel, EnrollmentSchema };
