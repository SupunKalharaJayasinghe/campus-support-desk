import mongoose, { Schema } from "mongoose";

const TermScheduleSchema = new Schema(
  {
    termCode: {
      type: String,
      required: true,
      enum: ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"],
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    weeks: { type: Number, min: 1, max: 52, default: 16 },
    notifyBeforeDays: { type: Number, enum: [1, 3, 7], default: 3 },
    manuallyEdited: { type: Boolean, default: false },
  },
  { _id: false }
);

const IntakeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    facultyId: { type: String, required: true, trim: true, uppercase: true },
    degreeId: { type: String, required: true, trim: true, uppercase: true },
    currentTerm: {
      type: String,
      enum: ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"],
      default: "Y1S1",
    },
    schedules: { type: [TermScheduleSchema], default: [] },
    autoJump: { type: Boolean, default: true },
    lockPastTerms: { type: Boolean, default: true },
    defaultWeeksPerTerm: { type: Number, enum: [12, 14, 16, 18], default: 16 },
    defaultNotifyBeforeDays: { type: Number, enum: [1, 3, 7], default: 3 },
    autoGenerateFutureTerms: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "DRAFT"],
      default: "ACTIVE",
    },
    stream: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const IntakeModel =
  mongoose.models.Intake || mongoose.model("Intake", IntakeSchema);

export { IntakeModel, IntakeSchema };
