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
    intakeId: { type: String, required: true, trim: true },
    termCode: {
      type: String,
      required: true,
      enum: ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"],
    },
    moduleId: { type: String, required: true, trim: true },
    syllabusVersion: { type: String, required: true, enum: ["OLD", "NEW"] },
    assignedLecturerIds: { type: [String], default: [] },
    assignedLabAssistantIds: { type: [String], default: [] },
    status: { type: String, required: true, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    // Backward-compatible alias used by existing module dependency/unassign flows.
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

ModuleOfferingSchema.index(
  { intakeId: 1, termCode: 1, moduleId: 1 },
  { unique: true }
);
ModuleOfferingSchema.index({ updatedAt: -1, status: 1 });
ModuleOfferingSchema.index({
  facultyId: 1,
  degreeProgramId: 1,
  intakeId: 1,
  termCode: 1,
  status: 1,
});

ModuleOfferingSchema.pre("validate", function syncAssignedAliases(next) {
  const row = this as {
    assignedLecturerIds?: string[];
    assignedLecturers?: string[];
    assignedLabAssistantIds?: string[];
  };

  const fromIds = Array.isArray(row.assignedLecturerIds) ? row.assignedLecturerIds : [];
  const fromAlias = Array.isArray(row.assignedLecturers) ? row.assignedLecturers : [];
  const normalized = Array.from(
    new Set([...fromIds, ...fromAlias].map((item) => String(item ?? "").trim()).filter(Boolean))
  );
  const normalizedLabAssistants = Array.from(
    new Set(
      (Array.isArray(row.assignedLabAssistantIds) ? row.assignedLabAssistantIds : [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );

  row.assignedLecturerIds = normalized;
  row.assignedLecturers = normalized;
  row.assignedLabAssistantIds = normalizedLabAssistants;
  next();
});

const ModuleOfferingModel =
  mongoose.models.ModuleOffering ||
  mongoose.model("ModuleOffering", ModuleOfferingSchema);

export { ModuleOfferingModel, ModuleOfferingSchema };
