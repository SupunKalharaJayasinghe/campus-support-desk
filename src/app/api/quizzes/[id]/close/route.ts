import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import "@/models/Quiz";
import "@/models/QuizAttempt";
import "@/models/User";
import { awardPointsForQuizAttempt } from "@/lib/points-engine";
import { connectMongoose } from "@/lib/mongoose";
import type { IAnswer } from "@/models/QuizAttempt";
import { QuizModel } from "@/models/Quiz";
import { QuizAttemptModel } from "@/models/QuizAttempt";
import { collapseSpaces, mapQuizRowsForResponse, readId } from "../../route";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function gradeAnswers(
  quiz: Record<string, unknown>,
  submittedAnswers: unknown[]
) {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const answersByQuestion = new Map<string, Record<string, unknown>>();

  submittedAnswers.forEach((answer) => {
    const row = asObject(answer);
    if (!row) {
      return;
    }

    const questionId = readId(row.questionId);
    if (questionId) {
      answersByQuestion.set(questionId, row);
    }
  });

  const gradedAnswers: IAnswer[] = questions.map((question) => {
    const questionRow = asObject(question) ?? {};
    const questionId = readId(questionRow._id ?? questionRow.id);
    const submitted = answersByQuestion.get(questionId) ?? null;
    const questionType = collapseSpaces(questionRow.questionType);
    const questionMarks = Number(questionRow.marks ?? 0);
    const options = Array.isArray(questionRow.options) ? questionRow.options : [];

    let isCorrect = false;
    let marksAwarded = 0;
    let selectedOptionId: mongoose.Types.ObjectId | undefined;
    const answerText = collapseSpaces(submitted?.answerText);

    if (questionType === "mcq" || questionType === "true-false") {
      const selectedId = readId(submitted?.selectedOptionId);
      if (selectedId && mongoose.Types.ObjectId.isValid(selectedId)) {
        selectedOptionId = new mongoose.Types.ObjectId(selectedId);
      }

      const selectedOption = options.find((option) => {
        const optionRow = asObject(option);
        return readId(optionRow?._id ?? optionRow?.id) === selectedId;
      });
      const selectedRow = asObject(selectedOption);
      isCorrect = Boolean(selectedRow?.isCorrect);
      marksAwarded = isCorrect ? questionMarks : 0;
    } else {
      // Short-answer auto grading is exact-match only. Lecturers can manually re-grade later.
      const normalizedAnswer = answerText.toLowerCase();
      const normalizedCorrect = collapseSpaces(questionRow.correctAnswer).toLowerCase();
      isCorrect = Boolean(normalizedAnswer) && normalizedAnswer === normalizedCorrect;
      marksAwarded = isCorrect ? questionMarks : 0;
    }

    return {
      questionId: new mongoose.Types.ObjectId(questionId),
      ...(selectedOptionId ? { selectedOptionId } : {}),
      ...(answerText ? { answerText } : {}),
      isCorrect,
      marksAwarded,
      questionMarks,
    };
  });

  const score = gradedAnswers.reduce((sum, answer) => sum + answer.marksAwarded, 0);
  const totalMarks = Number(quiz.totalMarks ?? 0);
  const percentage =
    totalMarks > 0
      ? Math.round(((score / totalMarks) * 100 + Number.EPSILON) * 100) / 100
      : 0;
  const passed = score >= Number(quiz.passingMarks ?? 0);

  return {
    gradedAnswers,
    score,
    totalMarks,
    percentage,
    passed,
  };
}

export async function POST(
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

    if (quiz.status !== "published") {
      return NextResponse.json(
        { success: false, error: "Only published quizzes can be closed" },
        { status: 400 }
      );
    }

    const inProgressAttempts = await QuizAttemptModel.find({
      quizId: quiz._id,
      status: "in_progress",
    }).exec();

    const now = new Date();
    let autoSubmittedCount = 0;
    const autoSubmittedAttemptIds: string[] = [];

    for (const attempt of inProgressAttempts) {
      const submission = gradeAnswers(
        quiz.toObject() as unknown as Record<string, unknown>,
        Array.isArray(attempt.answers) ? attempt.answers : []
      );
      const startedAt = attempt.startedAt instanceof Date ? attempt.startedAt : now;
      const timeTaken = Math.max(
        0,
        Math.floor((now.getTime() - startedAt.getTime()) / 1000)
      );

      attempt.answers = submission.gradedAnswers;
      attempt.score = submission.score;
      attempt.totalMarks = submission.totalMarks;
      attempt.percentage = submission.percentage;
      attempt.passed = submission.passed;
      attempt.submittedAt = now;
      attempt.timeTaken = timeTaken;
      attempt.isOnTime = now <= quiz.deadline;
      attempt.isWithinTimeLimit = timeTaken <= Number(quiz.duration ?? 0) * 60;
      attempt.status = "auto_submitted";
      await attempt.save();
      autoSubmittedCount += 1;
      autoSubmittedAttemptIds.push(String(attempt._id));
    }

    const xpResults = await Promise.allSettled(
      autoSubmittedAttemptIds.map(async (attemptId) => awardPointsForQuizAttempt(attemptId))
    );
    const xpSummary = xpResults.reduce(
      (summary, outcome) => {
        if (outcome.status !== "fulfilled") {
          console.error("quiz close XP award error", outcome.reason);
          return summary;
        }

        if (outcome.value.errors.length > 0) {
          console.error("quiz close XP award errors", outcome.value.errors);
        }

        return {
          totalXPAwarded:
            summary.totalXPAwarded + Number(outcome.value.totalPointsAwarded ?? 0),
          studentsAwarded:
            summary.studentsAwarded +
            (Number(outcome.value.totalPointsAwarded ?? 0) > 0 ? 1 : 0),
        };
      },
      {
        totalXPAwarded: 0,
        studentsAwarded: 0,
      }
    );

    quiz.status = "closed";
    await quiz.save();

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

    const mapped = row ? (await mapQuizRowsForResponse([row]))[0] : null;
    if (!mapped) {
      return NextResponse.json(
        { success: false, error: "Failed to map closed quiz" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        quiz: mapped,
        autoSubmittedCount,
        autoSubmittedAttempts: autoSubmittedCount,
        xpSummary,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to close quiz",
      },
      { status: 500 }
    );
  }
}
