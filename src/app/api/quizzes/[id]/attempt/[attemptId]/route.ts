import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Quiz";
import "@/models/QuizAttempt";
import "@/models/Student";
import { connectMongoose } from "@/lib/mongoose";
import { normalizeQuizQuestionType } from "@/lib/quiz-question-types";
import { QuizAttemptModel } from "@/models/QuizAttempt";
import { buildStudentName, collapseSpaces, readId, sanitizeQuizForStudent } from "../../../route";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collectOptionIds(values: unknown[]) {
  return Array.from(
    new Set(values.map((value) => readId(value)).filter(Boolean))
  );
}

function joinOptionTexts(values: Array<Record<string, unknown>>) {
  return values
    .map((value) => collapseSpaces(value.optionText))
    .filter(Boolean)
    .join(", ");
}

function buildAttemptResults(
  quiz: Record<string, unknown>,
  attempt: Record<string, unknown>
) {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
  const questionMap = new Map(
    questions.map((question) => {
      const row = asObject(question) ?? {};
      return [readId(row._id ?? row.id), row] as const;
    })
  );

  return answers.map((answer) => {
    const answerRow = asObject(answer) ?? {};
    const question = questionMap.get(readId(answerRow.questionId)) ?? null;
    const questionRow = asObject(question) ?? {};
    const options = Array.isArray(questionRow.options) ? questionRow.options : [];
    const optionRows = options
      .map((option) => asObject(option))
      .filter((optionRow): optionRow is Record<string, unknown> => Boolean(optionRow));
    const selectedOptionIds = collectOptionIds([
      ...(Array.isArray(answerRow.selectedOptionIds) ? answerRow.selectedOptionIds : []),
      answerRow.selectedOptionId,
    ]);
    const selectedOptions = optionRows.filter((optionRow) =>
      selectedOptionIds.includes(readId(optionRow._id ?? optionRow.id))
    );
    const correctOptions = optionRows.filter((optionRow) => Boolean(optionRow.isCorrect));

    return {
      questionId: readId(answerRow.questionId),
      questionText: collapseSpaces(questionRow.questionText),
      questionType: normalizeQuizQuestionType(questionRow.questionType) ?? "",
      isCorrect: Boolean(answerRow.isCorrect),
      marksAwarded: Number(answerRow.marksAwarded ?? 0),
      questionMarks: Number(answerRow.questionMarks ?? 0),
      correctAnswer:
        joinOptionTexts(correctOptions) ||
        collapseSpaces(questionRow.correctAnswer),
      selectedAnswer:
        joinOptionTexts(selectedOptions) ||
        collapseSpaces(answerRow.answerText),
    };
  });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string; attemptId: string } }
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
    const attemptId = String(params.attemptId ?? "").trim();

    if (!mongoose.Types.ObjectId.isValid(quizId) || !mongoose.Types.ObjectId.isValid(attemptId)) {
      return NextResponse.json(
        { success: false, error: "Attempt not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = collapseSpaces(searchParams.get("studentId"));
    if (studentId && !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid studentId filter" },
        { status: 400 }
      );
    }

    const attempt = await QuizAttemptModel.findById(attemptId)
      .populate({
        path: "quizId",
        select:
          "title description questions totalMarks passingMarks duration deadline status showResultsImmediately showCorrectAnswers",
      })
      .populate({
        path: "studentId",
        select: "studentId firstName lastName",
      })
      .lean()
      .exec()
      .catch(() => null);

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Attempt not found" },
        { status: 404 }
      );
    }

    const attemptRow = asObject(attempt) ?? {};
    if (readId(attemptRow.quizId) !== quizId) {
      return NextResponse.json(
        { success: false, error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (studentId && readId(attemptRow.studentId) !== studentId) {
      return NextResponse.json(
        { success: false, error: "This attempt belongs to a different student" },
        { status: 403 }
      );
    }

    const quiz = asObject(attemptRow.quizId) ?? {};
    const student = asObject(attemptRow.studentId) ?? {};
    const attemptStatus = collapseSpaces(attemptRow.status);
    const showResultsImmediately = Boolean(quiz.showResultsImmediately);
    const showCorrectAnswers = Boolean(quiz.showCorrectAnswers);
    const showAnswerDetails = showResultsImmediately || showCorrectAnswers;

    if (attemptStatus === "in_progress") {
      return NextResponse.json({
        success: true,
        data: {
          attempt: {
            id: attemptId,
            attemptNumber: Number(attemptRow.attemptNumber ?? 0),
            status: attemptStatus,
            startedAt:
              attemptRow.startedAt instanceof Date
                ? attemptRow.startedAt.toISOString()
                : attemptRow.startedAt ?? null,
            submittedAt: null,
            score: Number(attemptRow.score ?? 0),
            percentage: Number(attemptRow.percentage ?? 0),
          },
          quiz: sanitizeQuizForStudent({
            id: readId(quiz._id ?? quiz.id),
            _id: readId(quiz._id ?? quiz.id),
            title: collapseSpaces(quiz.title),
            description: collapseSpaces(quiz.description),
            duration: Number(quiz.duration ?? 0),
            totalMarks: Number(quiz.totalMarks ?? 0),
            questions: Array.isArray(quiz.questions) ? quiz.questions : [],
          }),
          student: {
            id: readId(student._id ?? student.id),
            name: buildStudentName(student),
            registrationNumber: collapseSpaces(student.studentId),
          },
          results: null,
        },
      });
    }

    const results = buildAttemptResults(quiz, attemptRow);

    return NextResponse.json({
      success: true,
      data: {
        attempt: {
          id: attemptId,
          attemptNumber: Number(attemptRow.attemptNumber ?? 0),
          status: attemptStatus,
          startedAt:
            attemptRow.startedAt instanceof Date
              ? attemptRow.startedAt.toISOString()
              : attemptRow.startedAt ?? null,
          submittedAt:
            attemptRow.submittedAt instanceof Date
              ? attemptRow.submittedAt.toISOString()
              : attemptRow.submittedAt ?? null,
          ...(showResultsImmediately
            ? {
                score: Number(attemptRow.score ?? 0),
                totalMarks: Number(attemptRow.totalMarks ?? 0),
                percentage: Number(attemptRow.percentage ?? 0),
                passed: Boolean(attemptRow.passed),
              }
            : {}),
          isOnTime: Boolean(attemptRow.isOnTime),
          isWithinTimeLimit: Boolean(attemptRow.isWithinTimeLimit),
          timeTaken: Number(attemptRow.timeTaken ?? 0),
          feedback: collapseSpaces(attemptRow.feedback) || null,
        },
        quiz: {
          id: readId(quiz._id ?? quiz.id),
          title: collapseSpaces(quiz.title),
          description: collapseSpaces(quiz.description),
          totalMarks: Number(quiz.totalMarks ?? 0),
          passingMarks: Number(quiz.passingMarks ?? 0),
          duration: Number(quiz.duration ?? 0),
          deadline:
            quiz.deadline instanceof Date ? quiz.deadline.toISOString() : quiz.deadline ?? null,
        },
        student: {
          id: readId(student._id ?? student.id),
          name: buildStudentName(student),
          registrationNumber: collapseSpaces(student.studentId),
        },
        results: showAnswerDetails
          ? {
              answers: results.map((result) => ({
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
                ...(result.selectedAnswer ? { selectedAnswer: result.selectedAnswer } : {}),
              })),
            }
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch quiz attempt",
      },
      { status: 500 }
    );
  }
}
