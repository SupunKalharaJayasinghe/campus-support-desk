import mongoose, { Schema, Types } from "mongoose";

const TROPHY_KEYS = [
  "first_module_passed",
  "five_modules_passed",
  "ten_modules_passed",
  "twenty_modules_passed",
  "first_high_score",
  "five_high_scores",
  "perfect_score",
  "triple_perfect",
  "deans_list",
  "first_class_achievement",
  "consistent_performer",
  "clean_sweep",
  "semester_champion",
  "comeback_king",
  "xp_beginner",
  "xp_intermediate",
  "xp_champion",
  "level_2_reached",
  "level_3_reached",
  "level_4_reached",
  "early_bird",
  "all_rounder",
  "resilience",
  "custom",
] as const;

const TROPHY_TIERS = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
] as const;

const TROPHY_CATEGORIES = [
  "academic",
  "score",
  "gpa",
  "semester",
  "milestone",
  "level",
  "special",
  "custom",
] as const;

const TROPHY_REFERENCE_TYPES = [
  "Grade",
  "GamificationPoints",
  "Semester",
  "Level",
  "Manual",
] as const;

type TrophyKey = (typeof TROPHY_KEYS)[number];
type TrophyTier = (typeof TROPHY_TIERS)[number];
type TrophyCategory = (typeof TROPHY_CATEGORIES)[number];
type TrophyReferenceType = (typeof TROPHY_REFERENCE_TYPES)[number];

export interface ITrophy {
  _id?: Types.ObjectId;
  studentId: Types.ObjectId;
  trophyKey: TrophyKey;
  trophyName: string;
  trophyDescription: string;
  trophyIcon: string;
  trophyTier: TrophyTier;
  category: TrophyCategory;
  xpBonusAwarded: number;
  condition: string;
  earnedAt: Date;
  academicYear?: string;
  semester?: 1 | 2;
  referenceType?: TrophyReferenceType;
  referenceId?: Types.ObjectId;
  metadata?: Record<string, unknown> | null;
  isHidden?: boolean;
  showcaseOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITrophyCount {
  total: number;
  byTier: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
    diamond: number;
  };
  byCategory: Record<string, number>;
}

interface ITrophyLeaderboardItem {
  studentId: Types.ObjectId;
  studentName: string;
  trophyCount: number;
  latestTrophy: string;
}

interface ITrophyModel extends mongoose.Model<ITrophy> {
  getStudentTrophies(
    studentId: Types.ObjectId,
    options?: { category?: string; tier?: string; includeHidden?: boolean }
  ): Promise<ITrophy[]>;
  getStudentTrophyCount(studentId: Types.ObjectId): Promise<ITrophyCount>;
  hasTrophy(studentId: Types.ObjectId, trophyKey: string): Promise<boolean>;
  getRecentTrophies(studentId: Types.ObjectId, limit?: number): Promise<ITrophy[]>;
  getTrophyLeaderboard(limit?: number): Promise<ITrophyLeaderboardItem[]>;
}

/*
Trophy Configuration Reference — used by the Milestone Checker:

BRONZE TROPHIES (Common):
- first_module_passed:      "First Steps" 🌟 — Pass your first module
- xp_beginner:              "Point Collector" ⭐ — Reach 100 XP
- level_2_reached:          "Rising Star" 📘 — Reach Intermediate level

SILVER TROPHIES (Notable):
- five_modules_passed:      "Steady Progress" 📚 — Pass 5 modules
- first_high_score:         "Sharp Mind" 🎯 — Score above 80% for the first time
- clean_sweep:              "Clean Sweep" 🧹 — Pass all modules in a semester
- deans_list:               "Dean's List" 📋 — Achieve semester GPA above 3.5
- comeback_king:            "Comeback King" 👑 — Improve GPA by 0.5+ from previous semester
- xp_intermediate:          "XP Warrior" ⚔️ — Reach 300 XP
- level_3_reached:          "Knowledge Seeker" 🎓 — Reach Advanced level

GOLD TROPHIES (Exceptional):
- ten_modules_passed:       "Dedicated Scholar" 🏅 — Pass 10 modules
- five_high_scores:         "Excellence Streak" 🔥 — Score above 80% in 5 modules
- perfect_score:            "Perfectionist" 💎 — Score 100% in a module
- first_class_achievement:  "First Class" 🥇 — Achieve First Class Honours GPA
- consistent_performer:     "Consistency King" 👑 — 3 consecutive semesters GPA ≥ 3.0
- resilience:               "Resilience" 💪 — Pass a previously failed module

PLATINUM TROPHIES (Rare):
- twenty_modules_passed:    "Academic Veteran" 🎖️ — Pass 20 modules
- triple_perfect:           "Triple Threat" ⚡ — Score 100% in 3 modules
- semester_champion:        "Semester Champion" 🏆 — Best performance in a semester
- xp_champion:              "XP Master" 🏆 — Reach 600 XP
- level_4_reached:          "Campus Champion" 🏆 — Reach Champion level

DIAMOND TROPHIES (Legendary):
- all_rounder:              "Renaissance Scholar" 🌐 — Pass modules across 3+ faculties
- early_bird:               "Trailblazer" 🚀 — First to complete a module in a semester
*/
const TrophySchema = new Schema<ITrophy, ITrophyModel>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    trophyKey: {
      type: String,
      required: true,
      enum: TROPHY_KEYS,
    },
    trophyName: {
      type: String,
      required: true,
      trim: true,
    },
    trophyDescription: {
      type: String,
      required: true,
      trim: true,
    },
    trophyIcon: {
      type: String,
      required: true,
      trim: true,
    },
    trophyTier: {
      type: String,
      required: true,
      enum: TROPHY_TIERS,
    },
    category: {
      type: String,
      required: true,
      enum: TROPHY_CATEGORIES,
    },
    xpBonusAwarded: {
      type: Number,
      required: true,
      min: 0,
    },
    condition: {
      type: String,
      required: true,
      trim: true,
    },
    earnedAt: {
      type: Date,
      required: true,
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
    referenceType: {
      type: String,
      enum: TROPHY_REFERENCE_TYPES,
      default: undefined,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    showcaseOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

TrophySchema.index({ studentId: 1 });
TrophySchema.index({ studentId: 1, trophyKey: 1 }, { unique: true });
TrophySchema.index({ studentId: 1, category: 1 });
TrophySchema.index({ studentId: 1, trophyTier: 1 });
TrophySchema.index({ studentId: 1, earnedAt: -1 });
TrophySchema.index({ trophyKey: 1 });
TrophySchema.index({ studentId: 1, isHidden: 1 });

TrophySchema.static(
  "getStudentTrophies",
  async function getStudentTrophies(
    studentId: Types.ObjectId,
    options?: { category?: string; tier?: string; includeHidden?: boolean }
  ) {
    const query: Record<string, unknown> = {
      studentId,
    };

    if (!options?.includeHidden) {
      query.isHidden = false;
    }

    const category = String(options?.category ?? "").trim();
    if (category) {
      query.category = category;
    }

    const tier = String(options?.tier ?? "").trim();
    if (tier) {
      query.trophyTier = tier;
    }

    return (await this.find(query)
      .sort({ earnedAt: -1 })
      .lean()
      .exec()) as ITrophy[];
  }
);

TrophySchema.static(
  "getStudentTrophyCount",
  async function getStudentTrophyCount(studentId: Types.ObjectId) {
    const rows = await this.aggregate<{
      total: Array<{ count: number }>;
      byTier: Array<{ _id: TrophyTier; count: number }>;
      byCategory: Array<{ _id: TrophyCategory; count: number }>;
    }>([
      {
        $match: {
          studentId,
        },
      },
      {
        $facet: {
          total: [
            {
              $count: "count",
            },
          ],
          byTier: [
            {
              $group: {
                _id: "$trophyTier",
                count: { $sum: 1 },
              },
            },
          ],
          byCategory: [
            {
              $group: {
                _id: "$category",
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]).exec();

    const row = rows[0];
    const byTier: ITrophyCount["byTier"] = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0,
    };

    for (const entry of row?.byTier ?? []) {
      byTier[entry._id] = Number(entry.count ?? 0);
    }

    const byCategory: Record<string, number> = {};
    for (const entry of row?.byCategory ?? []) {
      byCategory[entry._id] = Number(entry.count ?? 0);
    }

    return {
      total: Number(row?.total?.[0]?.count ?? 0),
      byTier,
      byCategory,
    };
  }
);

TrophySchema.static(
  "hasTrophy",
  async function hasTrophy(studentId: Types.ObjectId, trophyKey: string) {
    const existing = await this.exists({
      studentId,
      trophyKey,
    });

    return Boolean(existing);
  }
);

TrophySchema.static(
  "getRecentTrophies",
  async function getRecentTrophies(studentId: Types.ObjectId, limit = 5) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;

    return (await this.find({
      studentId,
      isHidden: false,
    })
      .sort({ earnedAt: -1 })
      .limit(safeLimit)
      .lean()
      .exec()) as ITrophy[];
  }
);

TrophySchema.static(
  "getTrophyLeaderboard",
  async function getTrophyLeaderboard(limit = 10) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;

    const rows = await this.aggregate<{
      studentId: Types.ObjectId;
      studentName: string;
      trophyCount: number;
      latestTrophy: string;
    }>([
      {
        $match: {
          isHidden: false,
        },
      },
      {
        $sort: {
          earnedAt: -1,
        },
      },
      {
        $group: {
          _id: "$studentId",
          trophyCount: { $sum: 1 },
          latestTrophy: { $first: "$trophyName" },
          latestEarnedAt: { $first: "$earnedAt" },
        },
      },
      {
        $sort: {
          trophyCount: -1,
          latestEarnedAt: -1,
        },
      },
      {
        $limit: safeLimit,
      },
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      {
        $unwind: {
          path: "$student",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          studentId: "$_id",
          trophyCount: 1,
          latestTrophy: 1,
          studentName: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$student.firstName", ""] },
                  " ",
                  { $ifNull: ["$student.lastName", ""] },
                ],
              },
            },
          },
        },
      },
    ]).exec();

    return rows.map((row) => ({
      studentId: row.studentId,
      studentName: String(row.studentName ?? "").trim() || "Unknown Student",
      trophyCount: Number(row.trophyCount ?? 0),
      latestTrophy: String(row.latestTrophy ?? "").trim(),
    }));
  }
);

const TrophyModel =
  (mongoose.models.Trophy as ITrophyModel) ||
  mongoose.model<ITrophy, ITrophyModel>("Trophy", TrophySchema);

export { TrophyModel, TrophySchema };
