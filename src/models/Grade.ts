import mongoose, { Schema, Types } from "mongoose";

export interface IGrade {
  studentId: Types.ObjectId;
  moduleOfferingId: Types.ObjectId;
  caMarks: number;
  finalExamMarks: number;
  totalMarks: number;
  gradeLetter: "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D+" | "D" | "F";
  gradePoint: number;
  status: "pass" | "fail" | "pro-rata" | "repeat";
  academicYear: string;
  semester: 1 | 2;
  gradedBy?: Types.ObjectId | null;
  gradedAt?: Date | null;
  remarks?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/*
Status reference. Actual calculation is handled in a separate utility:
- If CA < 45 AND Final < 45 -> status = "pro-rata" (full module repeat)
- If CA >= 45 AND Final < 45 -> status = "repeat" (final exam only)
- If CA >= 45 AND Final >= 45 -> status = "pass"
- If total marks lead to grade F -> status = "fail"

Grade scale reference:
- A+ = 4.0 (90-100)
- A = 4.0 (85-89)
- A- = 3.7 (80-84)
- B+ = 3.3 (75-79)
- B = 3.0 (70-74)
- B- = 2.7 (65-69)
- C+ = 2.3 (60-64)
- C = 2.0 (55-59)
- C- = 1.7 (50-54)
- D+ = 1.3 (45-49)
- D = 1.0 (40-44)
- F = 0.0 (0-39)
*/
const GradeSchema = new Schema<IGrade>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    moduleOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "ModuleOffering",
      required: true,
      index: true,
    },
    caMarks: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    finalExamMarks: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    gradeLetter: {
      type: String,
      required: true,
      enum: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"],
    },
    gradePoint: {
      type: Number,
      required: true,
      min: 0,
      max: 4,
    },
    status: {
      type: String,
      required: true,
      enum: ["pass", "fail", "pro-rata", "repeat"],
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    semester: {
      type: Number,
      required: true,
      enum: [1, 2],
    },
    gradedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    gradedAt: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

GradeSchema.index({ studentId: 1, moduleOfferingId: 1 }, { unique: true });

const GradeModel =
  (mongoose.models.Grade as mongoose.Model<IGrade>) ||
  mongoose.model<IGrade>("Grade", GradeSchema);

export { GradeModel, GradeSchema };
