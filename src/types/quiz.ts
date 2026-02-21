export type QuizStatus = "Draft" | "Published" | "Closed";

export type Quiz = {
  id: string;
  title: string;
  duration: number;
  status: QuizStatus;
  totalMarks: number;
};
