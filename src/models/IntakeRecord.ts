import mongoose, { Schema } from "mongoose";

const IntakeTermScheduleSchema = new Schema(
  {
    termCode: {
      type: String,
      required: true,
      enum: ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"],
    },
    startDate: {
      type: String,
      required: true,
      trim: true,
    },
    endDate: {
      type: String,
      required: true,
      trim: true,
    },
    weeks: {
      type: Number,
      required: true,
      min: 1,
      max: 52,
    },
    notifyBeforeDays: {
      type: Number,
      required: true,
      enum: [1, 3, 7],
    },
    isManuallyCustomized: {
      type: Boolean,
      required: true,
      default: false,
    },
    notificationSentAt: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const IntakeNotificationSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    termCode: {
      type: String,
      required: true,
      enum: ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    sentAt: {
      type: String,
      required: true,
      trim: true,
    },
    target: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const IntakeRecordSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
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
    degreeCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    intakeYear: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },
    intakeMonth: {
      type: String,
      required: true,
      trim: true,
    },
    stream: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "INACTIVE", "DRAFT"],
      default: "ACTIVE",
    },
    currentTerm: {
      type: String,
      required: true,
      enum: ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"],
      default: "Y1S1",
    },
    autoJumpEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    lockPastTerms: {
      type: Boolean,
      required: true,
      default: true,
    },
    defaultWeeksPerTerm: {
      type: Number,
      required: true,
      min: 1,
      max: 52,
      default: 16,
    },
    defaultNotifyBeforeDays: {
      type: Number,
      required: true,
      enum: [1, 3, 7],
      default: 3,
    },
    autoGenerateFutureTerms: {
      type: Boolean,
      required: true,
      default: true,
    },
    termSchedules: {
      type: [IntakeTermScheduleSchema],
      default: [],
    },
    notifications: {
      type: [IntakeNotificationSchema],
      default: [],
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

IntakeRecordSchema.index({ facultyCode: 1, degreeCode: 1, status: 1 });
IntakeRecordSchema.index({ isDeleted: 1, updatedAt: -1 });

const IntakeRecordModel =
  mongoose.models.IntakeRecord ||
  mongoose.model("IntakeRecord", IntakeRecordSchema);

export { IntakeRecordModel, IntakeRecordSchema };
