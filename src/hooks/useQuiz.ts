import { useMemo } from "react";
import type { Quiz } from "@/types";

const mockQuizzes: Quiz[] = [
  { id: "Q-01", title: "Week 5 Quiz", duration: 30, status: "Published", totalMarks: 20 },
  { id: "Q-02", title: "Final Review", duration: 40, status: "Draft", totalMarks: 25 }
];

export function useQuiz() {
  const quizzes = useMemo(() => mockQuizzes, []);
  return {
    quizzes,
    loading: false
  };
}
