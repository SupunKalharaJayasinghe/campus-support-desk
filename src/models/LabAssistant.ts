import mongoose, { Schema } from "mongoose";

const LabAssistantSchema = new Schema(
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

LabAssistantSchema.index({ status: 1, updatedAt: -1 });
LabAssistantSchema.index({ fullName: 1 });

const LabAssistantModel =
  mongoose.models.LabAssistant ||
  mongoose.model("LabAssistant", LabAssistantSchema);

export { LabAssistantModel, LabAssistantSchema };
