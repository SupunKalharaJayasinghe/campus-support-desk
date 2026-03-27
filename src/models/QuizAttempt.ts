import mongoose, { Schema, Types } from "mongoose";

const QUIZ_ATTEMPT_STATUSES = [
  "in_progress",
  "submitted",
  "auto_submitted",
  "graded",
  "invalidated",
] as const;

const COMPLETED_ATTEMPT_STATUSES = [
  "submitted",
  "auto_submitted",
  "graded",
] as const;

type QuizAttemptStatus = (typeof QUIZ_ATTEMPT_STATUSES)[number];

export interface IAnswer {
  _id?: Types.ObjectId;
  questionId: Types.ObjectId;
  selectedOptionId?: Types.ObjectId;
  answerText?: string;
  isCorrect: boolean;
  marksAwarded: number;
  questionMarks: number;
}

export interface IQuizAttempt {
  _id?: Types.ObjectId;
  quizId: Types.ObjectId;
  studentId: Types.ObjectId;
  answers: IAnswer[];
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  startedAt: Date;
  submittedAt: Date;
  timeTaken: number;
  isOnTime: boolean;
  isWithinTimeLimit: boolean;
  attemptNumber: number;
  status: QuizAttemptStatus;
  moduleOfferingId?: Types.ObjectId;
  academicYear?: string;
  semester?: 1 | 2;
  xpAwarded?: number;
  feedback?: string;
  ipAddress?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IQuizResultsSummary {
  quizId: string;
  totalAttempts: number;
  uniqueStudents: number;
  averageScore: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  passCount: number;
  failCount: number;
  passRate: number;
  averageTimeTaken: number;
  onTimeCount: number;
  lateCount: number;
  scoreDistribution: {
    "90-100": number;
    "80-89": number;
    "70-79": number;
    "60-69": number;
    "50-59": number;
    "below-50": number;
  };
}

interface IQuizAttemptModel extends mongoose.Model<IQuizAttempt> {
  getStudentAttempts(
    studentId: Types.ObjectId,
    quizId?: Types.ObjectId
  ): Promise<IQuizAttempt[]>;
  getQuizResults(quizId: Types.ObjectId): Promise<IQuizResultsSummary>;
  getAttemptCount(studentId: Types.ObjectId, quizId: Types.ObjectId): Promise<number>;
  hasCompletedQuiz(
    studentId: Types.ObjectId,
    quizId: Types.ObjectId
  ): Promise<boolean>;
  getBestAttempt(
    studentId: Types.ObjectId,
    quizId: Types.ObjectId
  ): Promise<IQuizAttempt | null>;
}

const AnswerSchema = new Schema<IAnswer>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    selectedOptionId: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    answerText: {
      type: String,
      trim: true,
      default: "",
    },
    isCorrect: {
      type: Boolean,
      required: true,
      default: false,
    },
    marksAwarded: {
      type: Number,
      required: true,
      min: 0,
    },
    questionMarks: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: true,
    id: false,
  }
);

const QuizAttemptSchema = new Schema<IQuizAttempt, IQuizAttemptModel>(
  {
    quizId: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    answers: {
      type: [AnswerSchema],
      default: [],
    },
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 0,
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    passed: {
      type: Boolean,
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    submittedAt: {
      type: Date,
      required: true,
    },
    timeTaken: {
      type: Number,
      required: true,
      min: 0,
    },
    isOnTime: {
      type: Boolean,
      required: true,
    },
    isWithinTimeLimit: {
      type: Boolean,
      required: true,
    },
    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      required: true,
      enum: QUIZ_ATTEMPT_STATUSES,
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
    xpAwarded: {
      type: Number,
      min: 0,
      default: 0,
    },
    feedback: {
      type: String,
      trim: true,
      default: "",
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

QuizAttemptSchema.index({ quizId: 1, studentId: 1 });
QuizAttemptSchema.index({ studentId: 1 });
QuizAttemptSchema.index({ quizId: 1 });
QuizAttemptSchema.index(
  { studentId: 1, quizId: 1, attemptNumber: 1 },
  { unique: true }
);
QuizAttemptSchema.index({ studentId: 1, submittedAt: -1 });
QuizAttemptSchema.index({ quizId: 1, status: 1 });
QuizAttemptSchema.index({ quizId: 1, percentage: -1 });
QuizAttemptSchema.index({ moduleOfferingId: 1, studentId: 1 });

QuizAttemptSchema.virtual("durationFormatted").get(function getDurationFormatted(
  this: IQuizAttempt
) {
  const safeSeconds = Math.max(0, Math.floor(Number(this.timeTaken ?? 0)));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}m ${seconds}s`;
});

QuizAttemptSchema.static(
  "getStudentAttempts",
  async function getStudentAttempts(studentId: Types.ObjectId, quizId?: Types.ObjectId) {
    const query: Record<string, unknown> = {
      studentId,
    };

    if (quizId) {
      query.quizId = quizId;
    }

    return (await this.find(query)
      .populate({
        path: "quizId",
        select: "title moduleOfferingId",
      })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean()
      .exec()) as IQuizAttempt[];
  }
);

QuizAttemptSchema.static(
  "getQuizResults",
  async function getQuizResults(quizId: Types.ObjectId) {
    const attempts = (await this.find({
      quizId,
      status: { $in: COMPLETED_ATTEMPT_STATUSES },
    })
      .select("studentId score percentage passed timeTaken isOnTime")
      .lean()
      .exec()) as Array<Pick<
      IQuizAttempt,
      "studentId" | "score" | "percentage" | "passed" | "timeTaken" | "isOnTime"
    >>;

    const totalAttempts = attempts.length;
    const uniqueStudents = new Set(
      attempts.map((attempt) => String(attempt.studentId))
    ).size;
    const totalScore = attempts.reduce(
      (sum, attempt) => sum + Number(attempt.score ?? 0),
      0
    );
    const totalPercentage = attempts.reduce(
      (sum, attempt) => sum + Number(attempt.percentage ?? 0),
      0
    );
    const totalTimeTaken = attempts.reduce(
      (sum, attempt) => sum + Number(attempt.timeTaken ?? 0),
      0
    );
    const highestScore = attempts.reduce(
      (highest, attempt) => Math.max(highest, Number(attempt.score ?? 0)),
      0
    );
    const lowestScore =
      totalAttempts > 0
        ? attempts.reduce(
            (lowest, attempt) => Math.min(lowest, Number(attempt.score ?? 0)),
            Number(attempts[0]?.score ?? 0)
          )
        : 0;
    const passCount = attempts.filter((attempt) => Boolean(attempt.passed)).length;
    const failCount = totalAttempts - passCount;
    const onTimeCount = attempts.filter((attempt) => Boolean(attempt.isOnTime)).length;
    const lateCount = totalAttempts - onTimeCount;

    const scoreDistribution: IQuizResultsSummary["scoreDistribution"] = {
      "90-100": 0,
      "80-89": 0,
      "70-79": 0,
      "60-69": 0,
      "50-59": 0,
      "below-50": 0,
    };

    for (const attempt of attempts) {
      const percentage = Number(attempt.percentage ?? 0);

      if (percentage >= 90) {
        scoreDistribution["90-100"] += 1;
      } else if (percentage >= 80) {
        scoreDistribution["80-89"] += 1;
      } else if (percentage >= 70) {
        scoreDistribution["70-79"] += 1;
      } else if (percentage >= 60) {
        scoreDistribution["60-69"] += 1;
      } else if (percentage >= 50) {
        scoreDistribution["50-59"] += 1;
      } else {
        scoreDistribution["below-50"] += 1;
      }
    }

    return {
      quizId: String(quizId),
      totalAttempts,
      uniqueStudents,
      averageScore:
        totalAttempts > 0 ? Number((totalScore / totalAttempts).toFixed(2)) : 0,
      averagePercentage:
        totalAttempts > 0
          ? Number((totalPercentage / totalAttempts).toFixed(2))
          : 0,
      highestScore,
      lowestScore,
      passCount,
      failCount,
      passRate:
        totalAttempts > 0 ? Number(((passCount / totalAttempts) * 100).toFixed(2)) : 0,
      averageTimeTaken:
        totalAttempts > 0
          ? Number((totalTimeTaken / totalAttempts).toFixed(2))
          : 0,
      onTimeCount,
      lateCount,
      scoreDistribution,
    };
  }
);

QuizAttemptSchema.static(
  "getAttemptCount",
  async function getAttemptCount(studentId: Types.ObjectId, quizId: Types.ObjectId) {
    return this.countDocuments({
      studentId,
      quizId,
    }).exec();
  }
);

QuizAttemptSchema.static(
  "hasCompletedQuiz",
  async function hasCompletedQuiz(studentId: Types.ObjectId, quizId: Types.ObjectId) {
    const attempt = await this.exists({
      studentId,
      quizId,
      status: { $in: COMPLETED_ATTEMPT_STATUSES },
    });

    return Boolean(attempt);
  }
);

QuizAttemptSchema.static(
  "getBestAttempt",
  async function getBestAttempt(studentId: Types.ObjectId, quizId: Types.ObjectId) {
    return (await this.findOne({
      studentId,
      quizId,
      status: { $in: COMPLETED_ATTEMPT_STATUSES },
    })
      .sort({
        score: -1,
        percentage: -1,
        submittedAt: -1,
      })
      .lean()
      .exec()) as IQuizAttempt | null;
  }
);

/*
Gamification Integration Reference — used by the Points Engine:

When a QuizAttempt is submitted with status "submitted":

1. quiz_completed:     +5 XP  — Always awarded on submission
2. quiz_on_time:       +10 XP — If isOnTime === true (submitted before deadline)
3. quiz_high_score:    +25 XP — If percentage >= 80
4. quiz_perfect_score: +50 XP — If percentage === 100

The GamificationPoints model uses:
  - referenceType: "QuizAttempt"
  - referenceId: quizAttempt._id
  - action: one of the above

Trophy triggers from quizzes (checked by milestone-checker):
  - Quiz completions count toward potential future quiz-related trophies
  - High quiz scores can contribute to overall score-based trophies
*/
const QuizAttemptModel =
  (mongoose.models.QuizAttempt as IQuizAttemptModel) ||
  mongoose.model<IQuizAttempt, IQuizAttemptModel>(
    "QuizAttempt",
    QuizAttemptSchema
  );

export { AnswerSchema, QuizAttemptModel, QuizAttemptSchema };
