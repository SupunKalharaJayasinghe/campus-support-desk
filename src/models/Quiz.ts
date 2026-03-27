import mongoose, { Schema, Types } from "mongoose";

const QUIZ_STATUSES = [
  "draft",
  "published",
  "closed",
  "archived",
] as const;

const QUESTION_TYPES = [
  "mcq",
  "true-false",
  "short-answer",
] as const;

type QuizStatus = (typeof QUIZ_STATUSES)[number];
type QuestionType = (typeof QUESTION_TYPES)[number];

export interface IOption {
  _id?: Types.ObjectId;
  optionText: string;
  isCorrect: boolean;
}

export interface IQuestion {
  _id?: Types.ObjectId;
  questionText: string;
  questionType: QuestionType;
  options: IOption[];
  correctAnswer: string;
  marks: number;
  explanation?: string;
  order: number;
}

export interface IQuiz {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  moduleOfferingId: Types.ObjectId;
  createdBy: Types.ObjectId;
  questions: IQuestion[];
  totalMarks: number;
  passingMarks: number;
  duration: number;
  deadline: Date;
  startDate?: Date | null;
  status: QuizStatus;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showResultsImmediately?: boolean;
  showCorrectAnswers?: boolean;
  academicYear?: string;
  semester?: 1 | 2;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IQuizStats {
  totalQuestions: number;
  totalMarks: number;
  duration: number;
  deadline: Date;
  status: string;
}

interface IQuizModel extends mongoose.Model<IQuiz> {
  getActiveQuizzes(moduleOfferingId: Types.ObjectId): Promise<IQuiz[]>;
  getQuizzesByLecturer(lecturerId: Types.ObjectId): Promise<IQuiz[]>;
  getQuizStats(quizId: Types.ObjectId): Promise<IQuizStats>;
}

const OptionSchema = new Schema<IOption>(
  {
    optionText: {
      type: String,
      required: true,
      trim: true,
    },
    isCorrect: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    _id: true,
    id: false,
  }
);

const QuestionSchema = new Schema<IQuestion>(
  {
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    questionType: {
      type: String,
      required: true,
      enum: QUESTION_TYPES,
    },
    options: {
      type: [OptionSchema],
      default: [],
      validate: {
        validator(value: IOption[]) {
          const question = this as IQuestion;
          if (question.questionType === "short-answer") {
            return true;
          }

          return Array.isArray(value) && value.length > 0;
        },
        message: "Options are required for MCQ and true-false questions",
      },
    },
    correctAnswer: {
      type: String,
      required: true,
      trim: true,
    },
    marks: {
      type: Number,
      required: true,
      min: 1,
    },
    explanation: {
      type: String,
      trim: true,
      default: "",
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: true,
    id: false,
  }
);

const QuizSchema = new Schema<IQuiz, IQuizModel>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    moduleOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "ModuleOffering",
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questions: {
      type: [QuestionSchema],
      required: true,
      validate: {
        validator(value: IQuestion[]) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one question is required",
      },
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 0,
    },
    passingMarks: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    deadline: {
      type: Date,
      required: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: QUIZ_STATUSES,
    },
    maxAttempts: {
      type: Number,
      min: 1,
      default: 1,
    },
    shuffleQuestions: {
      type: Boolean,
      default: false,
    },
    shuffleOptions: {
      type: Boolean,
      default: false,
    },
    showResultsImmediately: {
      type: Boolean,
      default: true,
    },
    showCorrectAnswers: {
      type: Boolean,
      default: false,
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
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

QuizSchema.index({ moduleOfferingId: 1 });
QuizSchema.index({ createdBy: 1 });
QuizSchema.index({ moduleOfferingId: 1, status: 1 });
QuizSchema.index({ status: 1, deadline: 1 });
QuizSchema.index({ moduleOfferingId: 1, createdAt: -1 });

QuizSchema.virtual("isActive").get(function getIsActive(this: IQuiz) {
  const now = new Date();
  const hasStarted = !this.startDate || this.startDate <= now;

  return this.status === "published" && this.deadline > now && hasStarted;
});

QuizSchema.virtual("questionCount").get(function getQuestionCount(this: IQuiz) {
  return Array.isArray(this.questions) ? this.questions.length : 0;
});

QuizSchema.static(
  "getActiveQuizzes",
  async function getActiveQuizzes(moduleOfferingId: Types.ObjectId) {
    const now = new Date();

    return (await this.find({
      moduleOfferingId,
      status: "published",
      deadline: { $gt: now },
      $or: [
        { startDate: { $exists: false } },
        { startDate: null },
        { startDate: { $lte: now } },
      ],
    })
      .sort({ deadline: 1 })
      .lean()
      .exec()) as IQuiz[];
  }
);

QuizSchema.static(
  "getQuizzesByLecturer",
  async function getQuizzesByLecturer(lecturerId: Types.ObjectId) {
    return (await this.find({
      createdBy: lecturerId,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as IQuiz[];
  }
);

QuizSchema.static(
  "getQuizStats",
  async function getQuizStats(quizId: Types.ObjectId) {
    const quiz = await this.findById(quizId)
      .select("questions totalMarks duration deadline status")
      .lean()
      .exec();

    return {
      totalQuestions: Array.isArray(quiz?.questions) ? quiz.questions.length : 0,
      totalMarks: Number(quiz?.totalMarks ?? 0),
      duration: Number(quiz?.duration ?? 0),
      deadline: quiz?.deadline instanceof Date ? quiz.deadline : new Date(0),
      status: String(quiz?.status ?? ""),
    };
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
const QuizModel =
  (mongoose.models.Quiz as IQuizModel) ||
  mongoose.model<IQuiz, IQuizModel>("Quiz", QuizSchema);

export { OptionSchema, QuestionSchema, QuizModel, QuizSchema };
