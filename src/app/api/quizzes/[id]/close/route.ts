import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import "@/models/Quiz";
import "@/models/QuizAttempt";
import "@/models/User";
import { awardPointsForQuizAttempt } from "@/lib/points-engine";
import {
  gradeQuizSubmission,
  normalizeQuizSubmissionAnswers,
} from "@/lib/quiz-grading";
import { connectMongoose } from "@/lib/mongoose";
import { QuizModel } from "@/models/Quiz";
import { QuizAttemptModel } from "@/models/QuizAttempt";
import { mapQuizRowsForResponse } from "../../route";

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
      const submission = gradeQuizSubmission(
        quiz.toObject() as unknown as Record<string, unknown>,
        normalizeQuizSubmissionAnswers(
          Array.isArray(attempt.answers) ? attempt.answers : []
        )
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
