import mongoose, { Schema, Types } from "mongoose";

const GAMIFICATION_ACTIONS = [
  "module_passed",
  "high_score",
  "perfect_score",
  "semester_gpa_above_3",
  "semester_gpa_above_3.5",
  "semester_all_passed",
  "first_class_gpa",
  "gpa_improvement",
  "quiz_completed",
  "quiz_on_time",
  "quiz_high_score",
  "quiz_perfect_score",
  "assignment_submitted",
  "milestone_reached",
  "streak_bonus",
  "custom",
] as const;

const GAMIFICATION_CATEGORIES = [
  "academic",
  "quiz",
  "assignment",
  "milestone",
  "bonus",
  "penalty",
  "custom",
] as const;

const GAMIFICATION_REFERENCE_TYPES = [
  "Grade",
  "QuizAttempt",
  "Assignment",
  "Milestone",
  "Manual",
] as const;

const GAMIFICATION_AWARDED_BY = [
  "system",
  "admin",
  "lecturer",
] as const;

type GamificationAction = (typeof GAMIFICATION_ACTIONS)[number];
type GamificationCategory = (typeof GAMIFICATION_CATEGORIES)[number];
type GamificationReferenceType = (typeof GAMIFICATION_REFERENCE_TYPES)[number];
type GamificationAwardedBy = (typeof GAMIFICATION_AWARDED_BY)[number];

export interface ICategoryBreakdown {
  category: GamificationCategory;
  totalXP: number;
  count: number;
}

export interface IGamificationPoints {
  _id?: Types.ObjectId;
  studentId: Types.ObjectId;
  action: GamificationAction;
  xpPoints: number;
  reason: string;
  category: GamificationCategory;
  referenceType?: GamificationReferenceType;
  referenceId?: Types.ObjectId;
  moduleOfferingId?: Types.ObjectId;
  academicYear?: string;
  semester?: 1 | 2;
  metadata?: Record<string, unknown> | null;
  awardedBy: GamificationAwardedBy;
  isRevoked?: boolean;
  revokedAt?: Date | null;
  revokedReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IGamificationPointsModel extends mongoose.Model<IGamificationPoints> {
  getStudentTotalXP(studentId: Types.ObjectId): Promise<number>;
  getStudentPointsByCategory(
    studentId: Types.ObjectId
  ): Promise<ICategoryBreakdown[]>;
  getRecentActivity(
    studentId: Types.ObjectId,
    limit?: number
  ): Promise<IGamificationPoints[]>;
  hasActionForReference(
    studentId: Types.ObjectId,
    action: string,
    referenceId: Types.ObjectId
  ): Promise<boolean>;
}

/*
XP Points Value Reference — used by the Points Engine (not enforced in the model):

ACADEMIC ACTIONS:
- module_passed:           +10 XP
- high_score (≥80%):       +25 XP
- perfect_score (100%):    +50 XP
- semester_gpa_above_3:    +30 XP
- semester_gpa_above_3.5:  +50 XP
- semester_all_passed:     +40 XP
- first_class_gpa:         +75 XP
- gpa_improvement:         +20 XP

QUIZ ACTIONS (future):
- quiz_completed:          +5 XP
- quiz_on_time:            +10 XP
- quiz_high_score:         +25 XP
- quiz_perfect_score:      +50 XP

MILESTONES:
- milestone_reached (100): +20 XP bonus
- milestone_reached (300): +40 XP bonus
- milestone_reached (600): +60 XP bonus

BONUS:
- streak_bonus:            +30 XP per consecutive good semester
- custom:                  Variable (set by admin)
*/
const GamificationPointsSchema = new Schema<
  IGamificationPoints,
  IGamificationPointsModel
>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: GAMIFICATION_ACTIONS,
    },
    xpPoints: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: GAMIFICATION_CATEGORIES,
    },
    referenceType: {
      type: String,
      enum: GAMIFICATION_REFERENCE_TYPES,
      default: undefined,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    moduleOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "ModuleOffering",
      default: undefined,
    },
    academicYear: {
      type: String,
      trim: true,
      default: undefined,
    },
    semester: {
      type: Number,
      enum: [1, 2],
      default: undefined,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    awardedBy: {
      type: String,
      required: true,
      enum: GAMIFICATION_AWARDED_BY,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
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

GamificationPointsSchema.index({ studentId: 1 });
GamificationPointsSchema.index({ studentId: 1, isRevoked: 1 });
GamificationPointsSchema.index({ studentId: 1, action: 1 });
GamificationPointsSchema.index(
  { studentId: 1, action: 1, referenceId: 1 },
  { unique: true, sparse: true }
);
GamificationPointsSchema.index({ studentId: 1, category: 1 });
GamificationPointsSchema.index({ studentId: 1, createdAt: -1 });
GamificationPointsSchema.index({ action: 1 });

GamificationPointsSchema.static(
  "getStudentTotalXP",
  async function getStudentTotalXP(studentId: Types.ObjectId) {
    const rows = await this.aggregate<{ totalXP: number }>([
      {
        $match: {
          studentId,
          isRevoked: false,
        },
      },
      {
        $group: {
          _id: null,
          totalXP: { $sum: "$xpPoints" },
        },
      },
    ]).exec();

    return Number(rows[0]?.totalXP ?? 0);
  }
);

GamificationPointsSchema.static(
  "getStudentPointsByCategory",
  async function getStudentPointsByCategory(studentId: Types.ObjectId) {
    const rows = await this.aggregate<{
      category: GamificationCategory;
      totalXP: number;
      count: number;
    }>([
      {
        $match: {
          studentId,
          isRevoked: false,
        },
      },
      {
        $group: {
          _id: "$category",
          totalXP: { $sum: "$xpPoints" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          totalXP: 1,
          count: 1,
        },
      },
      {
        $sort: {
          category: 1,
        },
      },
    ]).exec();

    return rows.map((row) => ({
      category: row.category,
      totalXP: Number(row.totalXP ?? 0),
      count: Number(row.count ?? 0),
    }));
  }
);

GamificationPointsSchema.static(
  "getRecentActivity",
  async function getRecentActivity(studentId: Types.ObjectId, limit = 10) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;

    return (await this.find({
      studentId,
      isRevoked: false,
    })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean()
      .exec()) as IGamificationPoints[];
  }
);

GamificationPointsSchema.static(
  "hasActionForReference",
  async function hasActionForReference(
    studentId: Types.ObjectId,
    action: string,
    referenceId: Types.ObjectId
  ) {
    const existing = await this.exists({
      studentId,
      action,
      referenceId,
    });

    return Boolean(existing);
  }
);

const GamificationPointsModel =
  (mongoose.models.GamificationPoints as IGamificationPointsModel) ||
  mongoose.model<IGamificationPoints, IGamificationPointsModel>(
    "GamificationPoints",
    GamificationPointsSchema
  );

export { GamificationPointsModel, GamificationPointsSchema };
