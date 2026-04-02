import mongoose, { Schema } from "mongoose";

const FacultySchema = new Schema(
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
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "INACTIVE"],
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

FacultySchema.index({ isDeleted: 1, updatedAt: -1 });

const FacultyModel =
  mongoose.models.Faculty || mongoose.model("Faculty", FacultySchema);

export { FacultyModel, FacultySchema };
