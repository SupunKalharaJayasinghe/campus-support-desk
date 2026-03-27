import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import "@/models/Quiz";
import "@/models/QuizAttempt";
import "@/models/User";
import { connectMongoose } from "@/lib/mongoose";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { QuizModel } from "@/models/Quiz";
import { QuizAttemptModel } from "@/models/QuizAttempt";
import { UserModel } from "@/models/User";
import {
  collapseSpaces,
  mapQuizRowsForResponse,
  normalizeQuestionInputs,
  parseDateValue,
  sanitizeSemester,
  sanitizeStatus,
  sanitizeTags,
} from "../route";

const RESTRICTED_AFTER_ATTEMPT_FIELDS = new Set([
  "questions",
  "totalMarks",
  "passingMarks",
  "duration",
  "moduleOfferingId",
  "maxAttempts",
  "shuffleQuestions",
  "shuffleOptions",
  "startDate",
  "academicYear",
  "semester",
  "createdBy",
]);

async function findMappedQuizById(quizId: string, studentView = false) {
  const row = await QuizModel.findById(quizId)
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

  if (!row) {
    return null;
  }

  const mappedRows = await mapQuizRowsForResponse([row], { studentView });
  return mappedRows[0] ?? null;
}

function hasRestrictedUpdate(body: Record<string, unknown>) {
  return Array.from(RESTRICTED_AFTER_ATTEMPT_FIELDS).some((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const quizId = String(params.id ?? "").trim();
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentView = collapseSpaces(searchParams.get("studentView")).toLowerCase() === "true";

    const quiz = await findMappedQuizById(quizId, studentView);
    if (!quiz) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch quiz",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const quizId = String(params.id ?? "").trim();
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const quiz = await QuizModel.findById(quizId).exec();
    if (!quiz) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    const attemptExists = Boolean(
      await QuizAttemptModel.exists({ quizId: quiz._id }).catch(() => null)
    );
    if (attemptExists && hasRestrictedUpdate(body)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot modify questions/marks/duration after students have attempted this quiz",
        },
        { status: 400 }
      );
    }

    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const title = collapseSpaces(body.title);
      if (!title) {
        return NextResponse.json(
          { success: false, error: "Title is required" },
          { status: 400 }
        );
      }
      quiz.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, "description")) {
      quiz.description = collapseSpaces(body.description);
    }

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      const status = sanitizeStatus(body.status);
      if (!status) {
        return NextResponse.json(
          { success: false, error: "Invalid quiz status" },
          { status: 400 }
        );
      }
      quiz.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(body, "showResultsImmediately")) {
      quiz.showResultsImmediately = Boolean(body.showResultsImmediately);
    }

    if (Object.prototype.hasOwnProperty.call(body, "showCorrectAnswers")) {
      quiz.showCorrectAnswers = Boolean(body.showCorrectAnswers);
    }

    if (Object.prototype.hasOwnProperty.call(body, "tags")) {
      quiz.tags = sanitizeTags(body.tags);
    }

    if (Object.prototype.hasOwnProperty.call(body, "deadline")) {
      const deadline = parseDateValue(body.deadline);
      if (!deadline || deadline <= new Date()) {
        return NextResponse.json(
          { success: false, error: "Deadline must be a valid future date" },
          { status: 400 }
        );
      }
      quiz.deadline = deadline;
    }

    if (!attemptExists) {
      if (Object.prototype.hasOwnProperty.call(body, "moduleOfferingId")) {
        const moduleOfferingId = collapseSpaces(body.moduleOfferingId);
        if (!moduleOfferingId || !mongoose.Types.ObjectId.isValid(moduleOfferingId)) {
          return NextResponse.json(
            { success: false, error: "Valid moduleOfferingId is required" },
            { status: 400 }
          );
        }

        const offeringExists = Boolean(
          await ModuleOfferingModel.exists({ _id: moduleOfferingId }).catch(() => null)
        );
        if (!offeringExists) {
          return NextResponse.json(
            { success: false, error: "Module offering not found" },
            { status: 400 }
          );
        }

        quiz.moduleOfferingId = new mongoose.Types.ObjectId(moduleOfferingId);
      }

      if (Object.prototype.hasOwnProperty.call(body, "createdBy")) {
        const createdBy = collapseSpaces(body.createdBy);
        if (!createdBy || !mongoose.Types.ObjectId.isValid(createdBy)) {
          return NextResponse.json(
            { success: false, error: "Valid createdBy is required" },
            { status: 400 }
          );
        }

        const creator = await UserModel.findById(createdBy)
          .select("role")
          .lean()
          .exec()
          .catch(() => null);
        const creatorRole = collapseSpaces(
          (creator as { role?: unknown } | null)?.role
        ).toUpperCase();
        if (!creator) {
          return NextResponse.json(
            { success: false, error: "Created by user not found" },
            { status: 400 }
          );
        }
        if (creatorRole !== "ADMIN" && creatorRole !== "LECTURER") {
          return NextResponse.json(
            {
              success: false,
              error: "createdBy user must have an ADMIN or LECTURER role",
            },
            { status: 400 }
          );
        }

        quiz.createdBy = new mongoose.Types.ObjectId(createdBy);
      }

      if (Object.prototype.hasOwnProperty.call(body, "questions")) {
        const normalizedQuestions = normalizeQuestionInputs(body.questions);
        if (normalizedQuestions.error) {
          return NextResponse.json(
            { success: false, error: normalizedQuestions.error },
            { status: 400 }
          );
        }

        quiz.set("questions", normalizedQuestions.questions);
        quiz.totalMarks = normalizedQuestions.questions.reduce(
          (sum, question) => sum + question.marks,
          0
        );

        if (Object.prototype.hasOwnProperty.call(body, "passingMarks")) {
          const passingMarks = Number(body.passingMarks);
          if (
            !Number.isFinite(passingMarks) ||
            passingMarks < 0 ||
            passingMarks > quiz.totalMarks
          ) {
            return NextResponse.json(
              {
                success: false,
                error: "passingMarks must be between 0 and totalMarks",
              },
              { status: 400 }
            );
          }
          quiz.passingMarks = passingMarks;
        } else {
          quiz.passingMarks = Math.ceil(quiz.totalMarks * 0.5);
        }
      } else if (Object.prototype.hasOwnProperty.call(body, "passingMarks")) {
        const passingMarks = Number(body.passingMarks);
        if (
          !Number.isFinite(passingMarks) ||
          passingMarks < 0 ||
          passingMarks > quiz.totalMarks
        ) {
          return NextResponse.json(
            {
              success: false,
              error: "passingMarks must be between 0 and totalMarks",
            },
            { status: 400 }
          );
        }
        quiz.passingMarks = passingMarks;
      }

      if (Object.prototype.hasOwnProperty.call(body, "duration")) {
        const duration = Number(body.duration);
        if (!Number.isFinite(duration) || duration < 1) {
          return NextResponse.json(
            { success: false, error: "Duration must be at least 1 minute" },
            { status: 400 }
          );
        }
        quiz.duration = Math.floor(duration);
      }

      if (Object.prototype.hasOwnProperty.call(body, "startDate")) {
        const startDate =
          body.startDate === null || body.startDate === ""
            ? null
            : parseDateValue(body.startDate);
        if (body.startDate !== null && body.startDate !== "" && !startDate) {
          return NextResponse.json(
            { success: false, error: "startDate must be a valid date" },
            { status: 400 }
          );
        }
        quiz.startDate = startDate;
      }

      if (Object.prototype.hasOwnProperty.call(body, "maxAttempts")) {
        const maxAttempts = Number(body.maxAttempts);
        if (!Number.isFinite(maxAttempts) || maxAttempts < 1) {
          return NextResponse.json(
            { success: false, error: "maxAttempts must be at least 1" },
            { status: 400 }
          );
        }
        quiz.maxAttempts = Math.floor(maxAttempts);
      }

      if (Object.prototype.hasOwnProperty.call(body, "shuffleQuestions")) {
        quiz.shuffleQuestions = Boolean(body.shuffleQuestions);
      }

      if (Object.prototype.hasOwnProperty.call(body, "shuffleOptions")) {
        quiz.shuffleOptions = Boolean(body.shuffleOptions);
      }

      if (Object.prototype.hasOwnProperty.call(body, "academicYear")) {
        quiz.academicYear = collapseSpaces(body.academicYear) || undefined;
      }

      if (Object.prototype.hasOwnProperty.call(body, "semester")) {
        const semester = sanitizeSemester(body.semester);
        if (semester === null) {
          return NextResponse.json(
            { success: false, error: "Semester must be 1 or 2" },
            { status: 400 }
          );
        }
        quiz.semester = semester;
      }
    }

    if (quiz.startDate && quiz.deadline && quiz.startDate >= quiz.deadline) {
      return NextResponse.json(
        { success: false, error: "startDate must be before deadline" },
        { status: 400 }
      );
    }

    await quiz.save();

    const mappedQuiz = await findMappedQuizById(quizId);
    if (!mappedQuiz) {
      return NextResponse.json(
        { success: false, error: "Failed to map updated quiz" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mappedQuiz,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update quiz",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const quizId = String(params.id ?? "").trim();
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    const quiz = await QuizModel.findById(quizId).exec();
    if (!quiz) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    const attemptExists = Boolean(
      await QuizAttemptModel.exists({ quizId: quiz._id }).catch(() => null)
    );

    if (attemptExists) {
      quiz.status = "archived";
      await quiz.save();

      return NextResponse.json({
        success: true,
        data: {
          message: "Quiz has existing attempts and was archived instead of deleted",
        },
      });
    }

    await QuizModel.deleteOne({ _id: quiz._id }).catch(() => null);

    return NextResponse.json({
      success: true,
      data: {
        message: "Quiz deleted successfully",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete quiz",
      },
      { status: 500 }
    );
  }
}
