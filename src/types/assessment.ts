export type AssessmentType =
  | "Lab Test"
  | "Assignment"
  | "Mid Exam"
  | "Final Exam";

export type AssessmentFormat =
  | "MCQ Quiz"
  | "Essay"
  | "File Upload"
  | "Handwritten";

export type AssessmentStatus = "Scheduled" | "Open" | "Closed" | "Draft";

export type Assessment = {
  id: string;
  title: string;
  type: AssessmentType;
  format: AssessmentFormat;
  maxMarks: number;
  status: AssessmentStatus;
  dueDate?: string;
};
