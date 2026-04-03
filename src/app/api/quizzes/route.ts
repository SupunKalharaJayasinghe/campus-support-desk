import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Module";
import "@/models/ModuleOffering";
import "@/models/Quiz";
import "@/models/User";
import { connectMongoose } from "@/lib/mongoose";
import {
  normalizeQuizQuestionType,
  type QuizQuestionType,
} from "@/lib/quiz-question-types";
import type { IOption } from "@/models/Quiz";
import { ModuleModel } from "@/models/Module";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { QuizModel } from "@/models/Quiz";
import { UserModel } from "@/models/User";

const QUIZ_STATUS_VALUES = [
  "draft",
  "published",
  "closed",
  "archived",
] as const;

const QUIZ_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "deadline",
  "title",
  "status",
] as const;

type QuizStatus = (typeof QUIZ_STATUS_VALUES)[number];

interface NormalizedModuleMeta {
  code: string;
  name: string;
  credits?: number;
}

interface NormalizedQuestionInput {
  questionText: string;
  questionType: QuizQuestionType;
  options: IOption[];
  correctAnswer: string;
  marks: number;
  explanation?: string;
  order: number;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function readId(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const row = value as {
      _id?: unknown;
      id?: unknown;
      toString?: () => string;
    };
    const nestedId = String(row._id ?? row.id ?? "").trim();
    if (nestedId) {
      return nestedId;
    }

    const rendered = typeof row.toString === "function" ? row.toString() : "";
    return rendered === "[object Object]" ? "" : rendered.trim();
  }

  return "";
}

export function buildStudentName(student: unknown) {
  const row = asObject(student);
  const firstName = collapseSpaces(row?.firstName);
  const lastName = collapseSpaces(row?.lastName);

  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

export function sanitizeStatus(value: unknown): QuizStatus | "" {
  if (
    value === "draft" ||
    value === "published" ||
    value === "closed" ||
    value === "archived"
  ) {
    return value;
  }

  return "";
}

export function sanitizeSemester(value: unknown): 1 | 2 | null {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2) {
    return parsed;
  }

  return null;
}

export function sanitizePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function sanitizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => collapseSpaces(item))
        .filter(Boolean)
        .slice(0, 25)
    )
  );
}

export function parseDateValue(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function loadModuleMetaMap(moduleIds: string[]) {
  const normalizedIds = Array.from(
    new Set(moduleIds.map((item) => collapseSpaces(item)).filter(Boolean))
  );
  if (normalizedIds.length === 0) {
    return new Map<string, NormalizedModuleMeta>();
  }

  const validObjectIds = normalizedIds.filter((item) =>
    mongoose.Types.ObjectId.isValid(item)
  );
  const upperCodes = normalizedIds.map((item) => item.toUpperCase());

  const rows = (await ModuleModel.find({
    $or: [
      { code: { $in: upperCodes } },
      ...(validObjectIds.length > 0
        ? [{ _id: { $in: validObjectIds.map((item) => new mongoose.Types.ObjectId(item)) } }]
        : []),
    ],
  })
    .select("code name credits")
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const map = new Map<string, NormalizedModuleMeta>();
  for (const row of rows) {
    const doc = asObject(row);
    if (!doc) {
      continue;
    }

    const meta = {
      code: collapseSpaces(doc.code).toUpperCase(),
      name: collapseSpaces(doc.name),
      credits: Number(doc.credits ?? 0) || undefined,
    };

    const rowId = readId(doc._id);
    if (rowId) {
      map.set(rowId, meta);
    }
    if (meta.code) {
      map.set(meta.code, meta);
    }
  }

  return map;
}

function computeIsActive(quiz: Record<string, unknown>) {
  const now = new Date();
  const status = collapseSpaces(quiz.status);
  const deadline = parseDateValue(quiz.deadline);
  const startDate = parseDateValue(quiz.startDate);

  return (
    status === "published" &&
    Boolean(deadline && deadline > now) &&
    (!startDate || startDate <= now)
  );
}

export function sanitizeQuizForStudent(quiz: Record<string, unknown>) {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

  return {
    ...quiz,
    questions: questions.map((question) => {
      const row = asObject(question) ?? {};
      const options = Array.isArray(row.options) ? row.options : [];

      return {
        _id: readId(row._id ?? row.id) || null,
        questionText: collapseSpaces(row.questionText),
        questionType: collapseSpaces(row.questionType),
        options: options.map((option) => {
          const optionRow = asObject(option) ?? {};
          return {
            _id: readId(optionRow._id ?? optionRow.id) || null,
            optionText: collapseSpaces(optionRow.optionText),
          };
        }),
        marks: Number(row.marks ?? 0),
        explanation: collapseSpaces(row.explanation),
        order: Number(row.order ?? 0),
      };
    }),
  };
}

export async function mapQuizRowsForResponse(
  rows: unknown[],
  options?: { studentView?: boolean }
) {
  const quizzes = rows
    .map((row) => asObject(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
  const moduleMap = await loadModuleMetaMap(
    quizzes.map((row) => {
      const offering = asObject(row.moduleOfferingId);
      return collapseSpaces(offering?.moduleId);
    })
  );

  return quizzes.map((quiz) => {
    const offering = asObject(quiz.moduleOfferingId);
    const createdBy = asObject(quiz.createdBy);
    const moduleId = collapseSpaces(offering?.moduleId);
    const moduleMeta = moduleMap.get(moduleId) ?? moduleMap.get(moduleId.toUpperCase());

    const mapped = {
      id: readId(quiz._id ?? quiz.id),
      _id: readId(quiz._id ?? quiz.id),
      title: collapseSpaces(quiz.title),
      description: collapseSpaces(quiz.description),
      moduleOfferingId: offering
        ? {
            _id: readId(offering._id ?? offering.id) || null,
            id: readId(offering._id ?? offering.id) || null,
            moduleId,
            moduleCode: moduleMeta?.code ?? moduleId,
            moduleName: moduleMeta?.name ?? moduleId,
            intakeId: collapseSpaces(offering.intakeId),
            termCode: collapseSpaces(offering.termCode),
            status: collapseSpaces(offering.status),
            degreeProgramId: collapseSpaces(offering.degreeProgramId),
            facultyId: collapseSpaces(offering.facultyId),
          }
        : null,
      createdBy: createdBy
        ? {
            _id: readId(createdBy._id ?? createdBy.id) || null,
            id: readId(createdBy._id ?? createdBy.id) || null,
            username: collapseSpaces(createdBy.username),
            email: collapseSpaces(createdBy.email).toLowerCase(),
            role: collapseSpaces(createdBy.role),
            name: collapseSpaces(createdBy.username),
          }
        : null,
      questions: Array.isArray(quiz.questions) ? quiz.questions : [],
      totalMarks: Number(quiz.totalMarks ?? 0),
      passingMarks: Number(quiz.passingMarks ?? 0),
      duration: Number(quiz.duration ?? 0),
      deadline: quiz.deadline instanceof Date ? quiz.deadline.toISOString() : quiz.deadline,
      startDate:
        quiz.startDate instanceof Date
          ? quiz.startDate.toISOString()
          : quiz.startDate ?? null,
      status: collapseSpaces(quiz.status),
      maxAttempts: Number(quiz.maxAttempts ?? 1),
      shuffleQuestions: Boolean(quiz.shuffleQuestions),
      shuffleOptions: Boolean(quiz.shuffleOptions),
      showResultsImmediately: Boolean(quiz.showResultsImmediately),
      showCorrectAnswers: Boolean(quiz.showCorrectAnswers),
      academicYear: collapseSpaces(quiz.academicYear) || null,
      semester: Number(quiz.semester ?? 0) || null,
      tags: Array.isArray(quiz.tags) ? quiz.tags.map((item) => collapseSpaces(item)) : [],
      questionCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
      isActive: computeIsActive(quiz),
      createdAt:
        quiz.createdAt instanceof Date ? quiz.createdAt.toISOString() : quiz.createdAt,
      updatedAt:
        quiz.updatedAt instanceof Date ? quiz.updatedAt.toISOString() : quiz.updatedAt,
    };

    return options?.studentView ? sanitizeQuizForStudent(mapped) : mapped;
  });
}

export function normalizeQuestionInputs(rawQuestions: unknown) {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return {
      error: "At least one question is required",
      questions: [] as NormalizedQuestionInput[],
    };
  }

  const normalizedQuestions: NormalizedQuestionInput[] = [];

  for (let index = 0; index < rawQuestions.length; index += 1) {
    const questionRow = asObject(rawQuestions[index]);
    if (!questionRow) {
      return {
        error: `Question ${index + 1} must be an object`,
        questions: [] as NormalizedQuestionInput[],
      };
    }

    const questionText = collapseSpaces(questionRow.questionText);
    const questionType = normalizeQuizQuestionType(questionRow.questionType);
    const marks = Number(questionRow.marks);
    const order = sanitizePositiveInteger(questionRow.order, index + 1);
    const explanation = collapseSpaces(questionRow.explanation);

    if (!questionText) {
      return {
        error: `Question ${index + 1} text is required`,
        questions: [] as NormalizedQuestionInput[],
      };
    }

    if (!questionType) {
      return {
        error: `Question ${index + 1} type is invalid`,
        questions: [] as NormalizedQuestionInput[],
      };
    }

    if (!Number.isFinite(marks) || marks < 1) {
      return {
        error: `Question ${index + 1} marks must be at least 1`,
        questions: [] as NormalizedQuestionInput[],
      };
    }

    if (questionType === "short-answer") {
      const correctAnswer = collapseSpaces(questionRow.correctAnswer);
      if (!correctAnswer) {
        return {
          error: `Question ${index + 1} requires a correctAnswer`,
          questions: [] as NormalizedQuestionInput[],
        };
      }

      normalizedQuestions.push({
        questionText,
        questionType,
        options: [],
        correctAnswer,
        marks,
        explanation,
        order,
      });
      continue;
    }

    const options = Array.isArray(questionRow.options) ? questionRow.options : [];
    if (options.length < 2) {
      return {
        error: `Question ${index + 1} must have at least 2 options`,
        questions: [] as NormalizedQuestionInput[],
      };
    }

    const normalizedOptions = options
      .map((option) => {
        const row = asObject(option);
        return row
          ? {
              optionText: collapseSpaces(row.optionText),
              isCorrect: Boolean(row.isCorrect),
            }
          : null;
      })
      .filter((option): option is IOption => Boolean(option?.optionText));

    if (normalizedOptions.length < 2) {
      return {
        error: `Question ${index + 1} must have at least 2 valid options`,
        questions: [] as NormalizedQuestionInput[],
      };
    }

    const correctOptions = normalizedOptions.filter((option) => option.isCorrect);
    if (correctOptions.length !== 1) {
      return {
        error: `Question ${index + 1} must have exactly 1 correct option`,
        questions: [] as NormalizedQuestionInput[],
      };
    }

    normalizedQuestions.push({
      questionText,
      questionType,
      options: normalizedOptions,
      correctAnswer: correctOptions[0].optionText,
      marks,
      explanation,
      order,
    });
  }

  return {
    error: "",
    questions: normalizedQuestions,
  };
}

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const moduleOfferingId = collapseSpaces(searchParams.get("moduleOfferingId"));
    const createdBy = collapseSpaces(searchParams.get("createdBy"));
    const statusParam = searchParams.get("status");
    const status = statusParam === null ? "" : sanitizeStatus(statusParam);
    const academicYear = collapseSpaces(searchParams.get("academicYear"));
    const semesterParam = searchParams.get("semester");
    const semester =
      semesterParam === null ? null : sanitizeSemester(searchParams.get("semester"));
    const search = collapseSpaces(searchParams.get("search"));
    const page = sanitizePositiveInteger(searchParams.get("page"), 1);
    const limit = Math.min(sanitizePositiveInteger(searchParams.get("limit"), 20), 100);
    const sortBy = collapseSpaces(searchParams.get("sortBy")) || "createdAt";
    const sortOrder = collapseSpaces(searchParams.get("sortOrder")).toLowerCase() === "asc"
      ? 1
      : -1;
    const studentView = Boolean(collapseSpaces(searchParams.get("studentId")));

    if (moduleOfferingId && !mongoose.Types.ObjectId.isValid(moduleOfferingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid moduleOfferingId filter" },
        { status: 400 }
      );
    }

    if (createdBy && !mongoose.Types.ObjectId.isValid(createdBy)) {
      return NextResponse.json(
        { success: false, error: "Invalid createdBy filter" },
        { status: 400 }
      );
    }

    if (statusParam !== null && !status) {
      return NextResponse.json(
        {
          success: false,
          error: `Status must be one of: ${QUIZ_STATUS_VALUES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (semesterParam !== null && semester === null) {
      return NextResponse.json(
        { success: false, error: "Semester must be 1 or 2" },
        { status: 400 }
      );
    }

    if (!QUIZ_SORT_FIELDS.includes(sortBy as (typeof QUIZ_SORT_FIELDS)[number])) {
      return NextResponse.json(
        {
          success: false,
          error: `sortBy must be one of: ${QUIZ_SORT_FIELDS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const query: Record<string, unknown> = {};
    if (moduleOfferingId) {
      query.moduleOfferingId = new mongoose.Types.ObjectId(moduleOfferingId);
    }
    if (createdBy) {
      query.createdBy = new mongoose.Types.ObjectId(createdBy);
    }
    if (status) {
      query.status = status;
    }
    if (academicYear) {
      query.academicYear = academicYear;
    }
    if (semester !== null) {
      query.semester = semester;
    }
    if (search) {
      query.title = {
        $regex: escapeRegExp(search),
        $options: "i",
      };
    }

    const total = await QuizModel.countDocuments(query).catch(() => 0);
    const rows = (await QuizModel.find(query)
      .populate({
        path: "moduleOfferingId",
        select: "moduleId intakeId termCode status degreeProgramId facultyId",
      })
      .populate({
        path: "createdBy",
        select: "username email role",
      })
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const quizzes = await mapQuizRowsForResponse(rows, { studentView });
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return NextResponse.json({
      success: true,
      data: {
        quizzes,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: totalPages > 0 && page < totalPages,
          hasPrev: page > 1 && total > 0,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch quizzes",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const title = collapseSpaces(body.title);
    const description = collapseSpaces(body.description);
    const moduleOfferingId = collapseSpaces(body.moduleOfferingId);
    const createdBy = collapseSpaces(body.createdBy);
    const duration = Number(body.duration);
    const deadline = parseDateValue(body.deadline);
    const startDate = body.startDate === undefined ? null : parseDateValue(body.startDate);
    const status = sanitizeStatus(body.status) || "draft";
    const academicYear = collapseSpaces(body.academicYear);
    const semester =
      body.semester === undefined || body.semester === null
        ? undefined
        : sanitizeSemester(body.semester);
    const maxAttempts = body.maxAttempts === undefined
      ? 1
      : sanitizePositiveInteger(body.maxAttempts, 1);
    const shuffleQuestions = Boolean(body.shuffleQuestions);
    const shuffleOptions = Boolean(body.shuffleOptions);
    const showResultsImmediately =
      body.showResultsImmediately === undefined
        ? true
        : Boolean(body.showResultsImmediately);
    const showCorrectAnswers = Boolean(body.showCorrectAnswers);
    const tags = sanitizeTags(body.tags);

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    if (!moduleOfferingId || !mongoose.Types.ObjectId.isValid(moduleOfferingId)) {
      return NextResponse.json(
        { success: false, error: "Valid moduleOfferingId is required" },
        { status: 400 }
      );
    }

    if (!createdBy || !mongoose.Types.ObjectId.isValid(createdBy)) {
      return NextResponse.json(
        { success: false, error: "Valid createdBy is required" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(duration) || duration < 1) {
      return NextResponse.json(
        { success: false, error: "Duration must be at least 1 minute" },
        { status: 400 }
      );
    }

    if (!deadline || deadline <= new Date()) {
      return NextResponse.json(
        { success: false, error: "Deadline must be a valid future date" },
        { status: 400 }
      );
    }

    if (body.startDate !== undefined && !startDate) {
      return NextResponse.json(
        { success: false, error: "startDate must be a valid date" },
        { status: 400 }
      );
    }

    if (startDate && startDate >= deadline) {
      return NextResponse.json(
        { success: false, error: "startDate must be before deadline" },
        { status: 400 }
      );
    }

    if (body.semester !== undefined && semester === null) {
      return NextResponse.json(
        { success: false, error: "Semester must be 1 or 2" },
        { status: 400 }
      );
    }

    const normalizedQuestions = normalizeQuestionInputs(body.questions);
    if (normalizedQuestions.error) {
      return NextResponse.json(
        { success: false, error: normalizedQuestions.error },
        { status: 400 }
      );
    }

    const totalMarks = normalizedQuestions.questions.reduce(
      (sum, question) => sum + question.marks,
      0
    );
    const requestedPassingMarks = body.passingMarks === undefined
      ? null
      : Number(body.passingMarks);
    const passingMarks =
      requestedPassingMarks === null
        ? Math.ceil(totalMarks * 0.5)
        : requestedPassingMarks;

    if (!Number.isFinite(passingMarks) || passingMarks < 0 || passingMarks > totalMarks) {
      return NextResponse.json(
        {
          success: false,
          error: "passingMarks must be between 0 and totalMarks",
        },
        { status: 400 }
      );
    }

    const [offering, creator] = await Promise.all([
      ModuleOfferingModel.findById(moduleOfferingId).lean().exec().catch(() => null),
      UserModel.findById(createdBy).select("role").lean().exec().catch(() => null),
    ]);

    if (!offering) {
      return NextResponse.json(
        { success: false, error: "Module offering not found" },
        { status: 400 }
      );
    }

    if (!creator) {
      return NextResponse.json(
        { success: false, error: "Created by user not found" },
        { status: 400 }
      );
    }

    const creatorRole = collapseSpaces(asObject(creator)?.role).toUpperCase();
    if (creatorRole !== "ADMIN" && creatorRole !== "LECTURER") {
      return NextResponse.json(
        {
          success: false,
          error: "createdBy user must have an ADMIN or LECTURER role",
        },
        { status: 400 }
      );
    }

    const created = await QuizModel.create({
      title,
      description,
      moduleOfferingId: new mongoose.Types.ObjectId(moduleOfferingId),
      createdBy: new mongoose.Types.ObjectId(createdBy),
      questions: normalizedQuestions.questions,
      totalMarks,
      passingMarks,
      duration: Math.floor(duration),
      deadline,
      startDate,
      status,
      maxAttempts,
      shuffleQuestions,
      shuffleOptions,
      showResultsImmediately,
      showCorrectAnswers,
      academicYear: academicYear || undefined,
      semester: semester ?? undefined,
      tags,
    });

    const row = await QuizModel.findById(created._id)
      .populate({
        path: "moduleOfferingId",
        select: "moduleId intakeId termCode status degreeProgramId facultyId",
      })
      .populate({
        path: "createdBy",
        select: "username email role",
      })
      .lean()
      .exec()
      .catch(() => null);

    const mappedRows = row ? await mapQuizRowsForResponse([row]) : [];
    const mappedQuiz = mappedRows[0] ?? null;

    if (!mappedQuiz) {
      return NextResponse.json(
        { success: false, error: "Failed to map created quiz" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: mappedQuiz,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create quiz",
      },
      { status: 500 }
    );
  }
}
