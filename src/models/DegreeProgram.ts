import mongoose, { Schema } from "mongoose";

const DegreeProgramSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    facultyCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    award: {
      type: String,
      required: true,
      trim: true,
    },
    credits: {
      type: Number,
      required: true,
      min: 1,
    },
    durationYears: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "INACTIVE", "DRAFT"],
      default: "ACTIVE",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

DegreeProgramSchema.index({ facultyCode: 1, status: 1 });
DegreeProgramSchema.index({ isDeleted: 1, updatedAt: -1 });

const DegreeProgramModel =
  mongoose.models.DegreeProgram ||
  mongoose.model("DegreeProgram", DegreeProgramSchema);

export { DegreeProgramModel, DegreeProgramSchema };
