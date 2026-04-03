import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Quiz";
import "@/models/QuizAttempt";
import { awardPointsForQuizAttempt } from "@/lib/points-engine";
import {
  gradeQuizSubmission,
  normalizeQuizSubmissionAnswers,
} from "@/lib/quiz-grading";
import { connectMongoose } from "@/lib/mongoose";
import { QuizModel } from "@/models/Quiz";
import { QuizAttemptModel } from "@/models/QuizAttempt";
import { collapseSpaces, readId } from "../../route";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export async function POST(
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
    const attemptId = collapseSpaces(body.attemptId);
    const studentId = collapseSpaces(body.studentId);
    const answers = Array.isArray(body.answers) ? body.answers : null;

    if (!attemptId || !mongoose.Types.ObjectId.isValid(attemptId)) {
      return NextResponse.json(
        { success: false, error: "Valid attemptId is required" },
        { status: 400 }
      );
    }

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Valid studentId is required" },
        { status: 400 }
      );
    }

    if (!answers) {
      return NextResponse.json(
        { success: false, error: "answers must be an array" },
        { status: 400 }
      );
    }

    const [attempt, quiz] = await Promise.all([
      QuizAttemptModel.findById(attemptId).exec().catch(() => null),
      QuizModel.findById(quizId).lean().exec().catch(() => null),
    ]);

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (readId(attempt.quizId) !== quizId) {
      return NextResponse.json(
        { success: false, error: "Attempt does not belong to this quiz" },
        { status: 400 }
      );
    }

    if (readId(attempt.studentId) !== studentId) {
      return NextResponse.json(
        { success: false, error: "This attempt belongs to a different student" },
        { status: 403 }
      );
    }

    if (attempt.status !== "in_progress") {
      return NextResponse.json(
        { success: false, error: "This attempt has already been submitted" },
        { status: 400 }
      );
    }

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    const normalizedAnswers = normalizeQuizSubmissionAnswers(answers);

    const quizRow = asObject(quiz) ?? {};
    const grading = gradeQuizSubmission(quizRow, normalizedAnswers);
    const submittedAt = new Date();
    const startedAt = attempt.startedAt instanceof Date ? attempt.startedAt : submittedAt;
    const timeTaken = Math.max(
      0,
      Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000)
    );
    const deadline =
      quizRow.deadline instanceof Date
        ? quizRow.deadline
        : new Date(String(quizRow.deadline ?? submittedAt.toISOString()));

    attempt.answers = grading.gradedAnswers;
    attempt.score = grading.score;
    attempt.totalMarks = grading.totalMarks;
    attempt.percentage = grading.percentage;
    attempt.passed = grading.passed;
    attempt.submittedAt = submittedAt;
    attempt.timeTaken = timeTaken;
    attempt.isOnTime = submittedAt <= deadline;
    attempt.isWithinTimeLimit = timeTaken <= Number(quizRow.duration ?? 0) * 60;
    attempt.status = "submitted";
    attempt.ipAddress =
      collapseSpaces(request.headers.get("x-forwarded-for")) ||
      collapseSpaces(request.headers.get("x-real-ip")) ||
      attempt.ipAddress;
    await attempt.save();

    let xpAwarded: {
      totalXP: number;
      actions: Array<{ action: string; xpPoints: number; reason: string }>;
      milestonesUnlocked: string[];
      newTotalXP: number;
    } | null = null;

    try {
      const awardResult = await awardPointsForQuizAttempt(String(attempt._id));
      if (awardResult.errors.length > 0) {
        console.error("quiz submit XP award errors", awardResult.errors);
      }
      if (awardResult.totalPointsAwarded > 0 || awardResult.milestonesUnlocked.length > 0) {
        xpAwarded = {
          totalXP: awardResult.totalPointsAwarded,
          actions: awardResult.pointsAwarded,
          milestonesUnlocked: awardResult.milestonesUnlocked,
          newTotalXP: awardResult.newTotalXP,
        };
      }
    } catch (xpError) {
      console.error("quiz submit XP award error", xpError);
    }

    const showResultsImmediately = Boolean(quizRow.showResultsImmediately);
    const showCorrectAnswers = Boolean(quizRow.showCorrectAnswers);
    const showAnswerDetails = showResultsImmediately || showCorrectAnswers;
    const message = showResultsImmediately
      ? xpAwarded && xpAwarded.totalXP > 0
        ? `Quiz submitted successfully! You scored ${attempt.percentage}% and earned ${xpAwarded.totalXP} XP!`
        : `Quiz submitted successfully! You scored ${attempt.percentage}%.`
      : xpAwarded && xpAwarded.totalXP > 0
        ? `Quiz submitted successfully. Your results will be available later. You earned ${xpAwarded.totalXP} XP.`
        : "Quiz submitted successfully. Your results will be available later.";

    return NextResponse.json({
      success: true,
      data: {
        attempt: {
          id: String(attempt._id),
          ...(showResultsImmediately
            ? {
                score: attempt.score,
                totalMarks: attempt.totalMarks,
                percentage: attempt.percentage,
                passed: attempt.passed,
              }
            : {}),
          timeTaken: attempt.timeTaken,
          isOnTime: attempt.isOnTime,
          isWithinTimeLimit: attempt.isWithinTimeLimit,
          status: attempt.status,
        },
        results: showAnswerDetails
          ? {
              answers: grading.results.map((result) => ({
                questionId: result.questionId,
                questionText: result.questionText,
                questionType: result.questionType,
                ...(showResultsImmediately
                  ? {
                      isCorrect: result.isCorrect,
                      marksAwarded: result.marksAwarded,
                      questionMarks: result.questionMarks,
                    }
                  : {}),
                ...(showCorrectAnswers && result.correctAnswer
                  ? { correctAnswer: result.correctAnswer }
                  : {}),
                ...(result.selectedAnswer
                  ? { selectedAnswer: result.selectedAnswer }
                  : {}),
              })),
            }
          : null,
        xpAwarded,
        message,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit quiz",
      },
      { status: 500 }
    );
  }
}
