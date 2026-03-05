import mongoose, { Schema } from "mongoose";

const OutlineWeekSchema = new Schema(
  {
    weekNo: { type: Number, required: true, min: 1, max: 60 },
    title: { type: String, required: true, trim: true },
    plannedStartDate: { type: Date, default: null },
    plannedEndDate: { type: Date, default: null },
    manuallyEdited: { type: Boolean, default: false },
    type: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const ModuleOfferingSchema = new Schema(
  {
    intakeId: { type: String, required: true, trim: true },
    termCode: {
      type: String,
      required: true,
      enum: ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"],
    },
    moduleId: { type: String, required: true, trim: true },
    syllabusVersion: { type: String, required: true, enum: ["OLD", "NEW"] },
    assignedLecturers: { type: [String], default: [] },
    outlineWeeks: { type: [OutlineWeekSchema], default: [] },
    outlinePending: { type: Boolean, default: false },
    hasGrades: { type: Boolean, default: false },
    hasAttendance: { type: Boolean, default: false },
    hasContent: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const ModuleOfferingModel =
  mongoose.models.ModuleOffering ||
  mongoose.model("ModuleOffering", ModuleOfferingSchema);

export { ModuleOfferingModel, ModuleOfferingSchema };
