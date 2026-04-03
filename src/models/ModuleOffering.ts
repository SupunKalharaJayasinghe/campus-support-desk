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

const WeekResourceSchema = new Schema(
  {
    id: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const WeekAssignmentSchema = new Schema(
  {
    id: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    link: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const WeekTodoSchema = new Schema(
  {
    id: { type: String, trim: true, default: "" },
    text: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const WeekContentSchema = new Schema(
  {
    weekNo: { type: Number, required: true, min: 1, max: 60 },
    outline: { type: String, trim: true, default: "" },
    lectureSlides: { type: [WeekResourceSchema], default: [] },
    resources: { type: [WeekResourceSchema], default: [] },
    assignments: { type: [WeekAssignmentSchema], default: [] },
    todoItems: { type: [WeekTodoSchema], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function normalizeString(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeAssigneeObjects(
  value: unknown,
  options: {
    idKeys: string[];
    outputIdKey: "lecturerId" | "assistantId";
  }
) {
  if (!Array.isArray(value)) {
    return [] as Array<{
      lecturerId?: string;
      assistantId?: string;
      name: string;
      email: string;
    }>;
  }

  const byId = new Map<
    string,
    {
      lecturerId?: string;
      assistantId?: string;
      name: string;
      email: string;
    }
  >();

  value.forEach((item) => {
    let id = "";
    let name = "";
    let email = "";

    if (typeof item === "string") {
      id = String(item).trim();
    } else if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      id =
        options.idKeys
          .map((key) => String(row[key] ?? "").trim())
          .find(Boolean) ?? "";
      name = normalizeString(row.name ?? row.fullName);
      email = String(row.email ?? "").trim().toLowerCase();
    }

    if (!id) {
      return;
    }

    const existing = byId.get(id);
    if (existing) {
      byId.set(id, {
        ...existing,
        name: existing.name || name,
        email: existing.email || email,
      });
      return;
    }

    byId.set(id, {
      [options.outputIdKey]: id,
      name,
      email,
    });
  });

  return Array.from(byId.values());
}

const ModuleOfferingSchema = new Schema(
  {
    facultyCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    degreeCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    intakeName: { type: String, required: true, trim: true },
    termCode: {
      type: String,
      required: true,
      enum: ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"],
    },
    moduleCode: { type: String, required: true, trim: true, uppercase: true },
    moduleName: { type: String, required: true, trim: true },
    syllabusVersion: { type: String, required: true, enum: ["OLD", "NEW"] },
    assignedLecturers: { type: [Schema.Types.Mixed], default: [] },
    assignedLabAssistants: { type: [Schema.Types.Mixed], default: [] },
    status: { type: String, required: true, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    // Legacy compatibility fields still used by older code paths.
    facultyId: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    degreeProgramId: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    intakeId: { type: String, trim: true, default: "" },
    moduleId: { type: String, trim: true, default: "" },
    assignedLecturerIds: { type: [String], default: [] },
    assignedLabAssistantIds: { type: [String], default: [] },
    outlineWeeks: { type: [OutlineWeekSchema], default: [] },
    weekContents: { type: [WeekContentSchema], default: [] },
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
  { intakeName: 1, termCode: 1, moduleCode: 1 },
  { unique: true }
);
ModuleOfferingSchema.index(
  { intakeId: 1, termCode: 1, moduleId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      intakeId: { $exists: true, $type: "string", $ne: "" },
      moduleId: { $exists: true, $type: "string", $ne: "" },
    },
  }
);
ModuleOfferingSchema.index({ updatedAt: -1, status: 1 });
ModuleOfferingSchema.index({
  facultyCode: 1,
  degreeCode: 1,
  intakeName: 1,
  termCode: 1,
  moduleCode: 1,
  status: 1,
});

ModuleOfferingSchema.pre("validate", function syncAssignedAliases(next) {
  const row = this as unknown as {
    facultyCode?: string;
    degreeCode?: string;
    intakeName?: string;
    moduleCode?: string;
    moduleName?: string;
    facultyId?: string;
    degreeProgramId?: string;
    intakeId?: string;
    moduleId?: string;
    assignedLecturerIds?: string[];
    assignedLecturers?: unknown[];
    assignedLabAssistantIds?: string[];
    assignedLabAssistants?: unknown[];
  };

  row.facultyCode = normalizeAcademicCode(row.facultyCode ?? row.facultyId);
  row.degreeCode = normalizeAcademicCode(row.degreeCode ?? row.degreeProgramId);
  row.intakeName = normalizeString(row.intakeName ?? row.intakeId);
  row.moduleCode = normalizeModuleCode(row.moduleCode ?? row.moduleId);
  row.moduleName =
    normalizeString(row.moduleName) || normalizeString(row.moduleCode ?? row.moduleId);

  row.facultyId = normalizeAcademicCode(row.facultyId ?? row.facultyCode);
  row.degreeProgramId = normalizeAcademicCode(row.degreeProgramId ?? row.degreeCode);
  row.intakeId = normalizeString(row.intakeId);
  row.moduleId = normalizeString(row.moduleId);

  const normalizedLecturerObjects = normalizeAssigneeObjects(row.assignedLecturers, {
    idKeys: ["lecturerId", "id", "_id"],
    outputIdKey: "lecturerId",
  });
  const normalizedLecturerIds = Array.from(
    new Set([
      ...normalizeIdList(row.assignedLecturerIds),
      ...normalizedLecturerObjects
        .map((item) => String(item.lecturerId ?? "").trim())
        .filter(Boolean),
    ])
  );
  const lecturerMap = new Map(
    normalizedLecturerObjects.map((item) => [String(item.lecturerId ?? "").trim(), item])
  );
  row.assignedLecturerIds = normalizedLecturerIds;
  row.assignedLecturers = normalizedLecturerIds.map((lecturerId) => {
    const existing = lecturerMap.get(lecturerId);
    return {
      lecturerId,
      name: existing?.name ?? "",
      email: existing?.email ?? "",
    };
  });

  const normalizedAssistantObjects = normalizeAssigneeObjects(row.assignedLabAssistants, {
    idKeys: ["assistantId", "id", "_id"],
    outputIdKey: "assistantId",
  });
  const normalizedAssistantIds = Array.from(
    new Set([
      ...normalizeIdList(row.assignedLabAssistantIds),
      ...normalizedAssistantObjects
        .map((item) => String(item.assistantId ?? "").trim())
        .filter(Boolean),
    ])
  );
  const assistantMap = new Map(
    normalizedAssistantObjects.map((item) => [String(item.assistantId ?? "").trim(), item])
  );
  row.assignedLabAssistantIds = normalizedAssistantIds;
  row.assignedLabAssistants = normalizedAssistantIds.map((assistantId) => {
    const existing = assistantMap.get(assistantId);
    return {
      assistantId,
      name: existing?.name ?? "",
      email: existing?.email ?? "",
    };
  });

  next();
});

const ModuleOfferingModel =
  mongoose.models.ModuleOffering ||
  mongoose.model("ModuleOffering", ModuleOfferingSchema);

export { ModuleOfferingModel, ModuleOfferingSchema };
