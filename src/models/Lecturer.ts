import mongoose, { Schema } from "mongoose";

const LecturerSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    nicStaffId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      unique: true,
      sparse: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    // Academic entities are currently keyed by stable codes/ids in this project.
    facultyIds: {
      type: [String],
      default: [],
    },
    degreeProgramIds: {
      type: [String],
      default: [],
    },
    moduleIds: {
      type: [String],
      default: [],
    },
    // Optional denormalized cache. Actual assignment source of truth is ModuleOffering.
    assignedOfferingIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

LecturerSchema.index({ status: 1, updatedAt: -1 });
LecturerSchema.index({ fullName: 1 });

const LecturerModel =
  mongoose.models.Lecturer || mongoose.model("Lecturer", LecturerSchema);

export { LecturerModel, LecturerSchema };
