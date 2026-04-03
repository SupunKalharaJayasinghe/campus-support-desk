export const QUIZ_QUESTION_TYPES = [
  "mcq",
  "true-false",
  "short-answer",
] as const;

export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

export function normalizeQuizQuestionType(
  value: unknown
): QuizQuestionType | null {
  const normalized = String(value ?? "").trim();

  return QUIZ_QUESTION_TYPES.includes(normalized as QuizQuestionType)
    ? (normalized as QuizQuestionType)
    : null;
}

export function isShortAnswerQuizQuestionType(value: unknown): boolean {
  return normalizeQuizQuestionType(value) === "short-answer";
}

export function isChoiceQuizQuestionType(value: unknown): boolean {
  const questionType = normalizeQuizQuestionType(value);

  return questionType === "mcq" || questionType === "true-false";
}
