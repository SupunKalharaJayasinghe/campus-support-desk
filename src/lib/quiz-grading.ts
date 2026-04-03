import mongoose from "mongoose";
import type { IAnswer } from "@/models/QuizAttempt";
import {
  isChoiceQuizQuestionType,
  normalizeQuizQuestionType,
  type QuizQuestionType,
} from "@/lib/quiz-question-types";

export interface QuizSubmissionAnswerInput {
  questionId: string;
  selectedOptionId?: string;
  answerText?: string;
}

export interface QuizQuestionResult {
  questionId: string;
  questionText: string;
  questionType: QuizQuestionType | "";
  isCorrect: boolean;
  marksAwarded: number;
  questionMarks: number;
  correctAnswer?: string;
  selectedAnswer?: string;
}

export interface QuizGradingResult {
  gradedAnswers: IAnswer[];
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  results: QuizQuestionResult[];
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function readId(value: unknown) {
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

export function normalizeQuizSubmissionAnswers(
  rawAnswers: unknown[]
): QuizSubmissionAnswerInput[] {
  return rawAnswers
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
        ...(selectedOptionId &&
        mongoose.Types.ObjectId.isValid(selectedOptionId)
          ? { selectedOptionId }
          : {}),
        ...(collapseSpaces(row.answerText)
          ? { answerText: collapseSpaces(row.answerText) }
          : {}),
      };
    })
    .filter((answer): answer is QuizSubmissionAnswerInput => Boolean(answer));
}

export function gradeQuizSubmission(
  quiz: Record<string, unknown>,
  answers: QuizSubmissionAnswerInput[]
): QuizGradingResult {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const answersByQuestion = new Map<string, QuizSubmissionAnswerInput>();

  answers.forEach((answer) => {
    const questionId = collapseSpaces(answer.questionId);
    if (questionId) {
      answersByQuestion.set(questionId, answer);
    }
  });

  const results: QuizQuestionResult[] = [];
  const gradedAnswers: IAnswer[] = questions.map((question) => {
    const questionRow = asObject(question) ?? {};
    const questionId = readId(questionRow._id ?? questionRow.id);
    const questionText = collapseSpaces(questionRow.questionText);
    const questionType = normalizeQuizQuestionType(questionRow.questionType);
    const questionMarks = Number(questionRow.marks ?? 0);
    const submission = answersByQuestion.get(questionId);
    const optionRows = Array.isArray(questionRow.options)
      ? questionRow.options
      : [];

    let isCorrect = false;
    let marksAwarded = 0;
    let selectedOptionId: mongoose.Types.ObjectId | undefined;
    const answerText = collapseSpaces(submission?.answerText);
    let selectedAnswer = "";
    let correctAnswer = "";

    if (isChoiceQuizQuestionType(questionType)) {
      const selectedId = collapseSpaces(submission?.selectedOptionId);
      const selectedOption = optionRows.find((option) => {
        const optionRow = asObject(option);

        return readId(optionRow?._id ?? optionRow?.id) === selectedId;
      });
      const selectedRow = asObject(selectedOption);
      const correctOption = optionRows.find((option) =>
        Boolean(asObject(option)?.isCorrect)
      );
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
      // Short-answer auto grading remains exact-match only.
      const normalizedAnswer = answerText.toLowerCase();
      const normalizedCorrect = collapseSpaces(
        questionRow.correctAnswer
      ).toLowerCase();

      correctAnswer = collapseSpaces(questionRow.correctAnswer);
      selectedAnswer = answerText;
      isCorrect =
        Boolean(normalizedAnswer) && normalizedAnswer === normalizedCorrect;
      marksAwarded = isCorrect ? questionMarks : 0;
    }

    results.push({
      questionId,
      questionText,
      questionType: questionType ?? "",
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

  const score = gradedAnswers.reduce(
    (sum, answer) => sum + answer.marksAwarded,
    0
  );
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
