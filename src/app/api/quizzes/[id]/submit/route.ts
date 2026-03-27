import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Quiz";
import "@/models/QuizAttempt";
import { connectMongoose } from "@/lib/mongoose";
import type { IAnswer } from "@/models/QuizAttempt";
import { QuizModel } from "@/models/Quiz";
import { QuizAttemptModel } from "@/models/QuizAttempt";
import { collapseSpaces, readId } from "../../route";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

interface SubmissionAnswerInput {
  questionId: string;
  selectedOptionId?: string;
  answerText?: string;
}

function gradeSubmission(
  quiz: Record<string, unknown>,
  answers: SubmissionAnswerInput[]
) {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const answersByQuestion = new Map<string, SubmissionAnswerInput>();
  const results: Array<{
    questionId: string;
    questionText: string;
    isCorrect: boolean;
    marksAwarded: number;
    questionMarks: number;
    correctAnswer?: string;
    selectedAnswer?: string;
  }> = [];

  answers.forEach((answer) => {
    const questionId = collapseSpaces(answer.questionId);
    if (questionId) {
      answersByQuestion.set(questionId, answer);
    }
  });

  const gradedAnswers: IAnswer[] = questions.map((question) => {
    const questionRow = asObject(question) ?? {};
    const questionId = readId(questionRow._id ?? questionRow.id);
    const questionText = collapseSpaces(questionRow.questionText);
    const questionType = collapseSpaces(questionRow.questionType);
    const questionMarks = Number(questionRow.marks ?? 0);
    const submission = answersByQuestion.get(questionId);
    const optionRows = Array.isArray(questionRow.options) ? questionRow.options : [];

    let isCorrect = false;
    let marksAwarded = 0;
    let selectedOptionId: mongoose.Types.ObjectId | undefined;
    const answerText = collapseSpaces(submission?.answerText);
    let selectedAnswer = "";
    let correctAnswer = "";

    if (questionType === "mcq" || questionType === "true-false") {
      const selectedId = collapseSpaces(submission?.selectedOptionId);
      const selectedOption = optionRows.find((option) => {
        const optionRow = asObject(option);
        return readId(optionRow?._id ?? optionRow?.id) === selectedId;
      });
      const selectedRow = asObject(selectedOption);
      const correctOption = optionRows.find((option) => Boolean(asObject(option)?.isCorrect));
      const correctOptionRow = asObject(correctOption);

      if (selectedId && mongoose.Types.ObjectId.isValid(selectedId)) {
        selectedOptionId = new mongoose.Types.ObjectId(selectedId);
      }

      selectedAnswer = collapseSpaces(selectedRow?.optionText);
      correctAnswer =
        collapseSpaces(correctOptionRow?.optionText) ||
        collapseSpaces(questionRow.correctAnswer);
      isCorrect = Boolean(selectedRow?.isCorrect);
      marksAwarded = isCorrect ? questionMarks : 0;
    } else {
      // Short-answer auto grading is exact-match only. Lecturers can manually re-grade later.
      const normalizedAnswer = answerText.toLowerCase();
      const normalizedCorrect = collapseSpaces(questionRow.correctAnswer).toLowerCase();
      correctAnswer = collapseSpaces(questionRow.correctAnswer);
      selectedAnswer = answerText;
      isCorrect = Boolean(normalizedAnswer) && normalizedAnswer === normalizedCorrect;
      marksAwarded = isCorrect ? questionMarks : 0;
    }

    results.push({
      questionId,
      questionText,
      isCorrect,
      marksAwarded,
      questionMarks,
      correctAnswer,
      selectedAnswer,
    });

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
    results,
  };
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

    const normalizedAnswers = answers
      .map((answer) => {
        const row = asObject(answer);
        if (!row) {
          return null;
        }

        const questionId = collapseSpaces(row.questionId);
        if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
          return null;
        }

        const selectedOptionId = collapseSpaces(row.selectedOptionId);
        return {
          questionId,
          ...(selectedOptionId && mongoose.Types.ObjectId.isValid(selectedOptionId)
            ? { selectedOptionId }
            : {}),
          ...(collapseSpaces(row.answerText)
            ? { answerText: collapseSpaces(row.answerText) }
            : {}),
        };
      })
      .filter((answer): answer is SubmissionAnswerInput => Boolean(answer));

    const quizRow = asObject(quiz) ?? {};
    const grading = gradeSubmission(quizRow, normalizedAnswers);
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

    const showResultsImmediately = Boolean(quizRow.showResultsImmediately);
    const showCorrectAnswers = Boolean(quizRow.showCorrectAnswers);

    return NextResponse.json({
      success: true,
      data: {
        attempt: {
          id: String(attempt._id),
          score: attempt.score,
          totalMarks: attempt.totalMarks,
          percentage: attempt.percentage,
          passed: attempt.passed,
          timeTaken: attempt.timeTaken,
          isOnTime: attempt.isOnTime,
          isWithinTimeLimit: attempt.isWithinTimeLimit,
          status: attempt.status,
        },
        results: showResultsImmediately
          ? {
              answers: grading.results.map((result) => ({
                questionId: result.questionId,
                questionText: result.questionText,
                isCorrect: result.isCorrect,
                marksAwarded: result.marksAwarded,
                questionMarks: result.questionMarks,
                ...(showCorrectAnswers && result.correctAnswer
                  ? { correctAnswer: result.correctAnswer }
                  : {}),
                ...(result.selectedAnswer
                  ? { selectedAnswer: result.selectedAnswer }
                  : {}),
              })),
            }
          : null,
        message: `Quiz submitted successfully! You scored ${attempt.percentage}%.`,
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
