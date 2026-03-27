import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Quiz";
import "@/models/QuizAttempt";
import "@/models/Student";
import { connectMongoose } from "@/lib/mongoose";
import { QuizModel } from "@/models/Quiz";
import { QuizAttemptModel } from "@/models/QuizAttempt";
import { buildStudentName, collapseSpaces, readId } from "../../route";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export async function GET(
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

    const quiz = await QuizModel.findById(quizId)
      .select("title totalMarks passingMarks questions deadline")
      .lean()
      .exec()
      .catch(() => null);
    if (!quiz) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    const [summary, attemptRows] = await Promise.all([
      QuizAttemptModel.getQuizResults(new mongoose.Types.ObjectId(quizId)),
      QuizAttemptModel.find({ quizId: new mongoose.Types.ObjectId(quizId) })
        .populate({
          path: "studentId",
          select: "studentId firstName lastName",
        })
        .sort({ percentage: -1, submittedAt: -1 })
        .lean()
        .exec()
        .catch(() => []),
    ]);

    const attempts = (attemptRows as unknown[]).map((row) => {
      const attempt = asObject(row) ?? {};
      const student = asObject(attempt.studentId);

      return {
        student: {
          id: readId(student?._id ?? student?.id) || null,
          name: buildStudentName(student),
          registrationNumber: collapseSpaces(student?.studentId),
        },
        score: Number(attempt.score ?? 0),
        percentage: Number(attempt.percentage ?? 0),
        passed: Boolean(attempt.passed),
        isOnTime: Boolean(attempt.isOnTime),
        timeTaken: Number(attempt.timeTaken ?? 0),
        submittedAt:
          attempt.submittedAt instanceof Date
            ? attempt.submittedAt.toISOString()
            : attempt.submittedAt ?? null,
        attemptNumber: Number(attempt.attemptNumber ?? 0),
        status: collapseSpaces(attempt.status),
      };
    });

    const quizRow = asObject(quiz);

    return NextResponse.json({
      success: true,
      data: {
        quiz: {
          id: quizId,
          title: collapseSpaces(quizRow?.title),
          totalMarks: Number(quizRow?.totalMarks ?? 0),
          passingMarks: Number(quizRow?.passingMarks ?? 0),
          questionCount: Array.isArray(quizRow?.questions) ? quizRow.questions.length : 0,
          deadline:
            quizRow?.deadline instanceof Date
              ? quizRow.deadline.toISOString()
              : quizRow?.deadline ?? null,
        },
        summary,
        attempts,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch quiz results",
      },
      { status: 500 }
    );
  }
}
