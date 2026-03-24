export type GradeLetter =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D+"
  | "D"
  | "F";

export type GradeStatus = "pass" | "fail" | "pro-rata" | "repeat";

export interface CalculatedGrade {
  totalMarks: number;
  gradeLetter: GradeLetter;
  gradePoint: number;
  status: GradeStatus;
}

const GRADE_POINTS: Record<GradeLetter, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  F: 0.0,
};

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTotalMarks(caMarks: number, finalExamMarks: number): number {
  return roundToTwo(caMarks * 0.4 + finalExamMarks * 0.6);
}

export function determineGradeLetter(totalMarks: number): GradeLetter {
  if (totalMarks >= 90) return "A+";
  if (totalMarks >= 85) return "A";
  if (totalMarks >= 80) return "A-";
  if (totalMarks >= 75) return "B+";
  if (totalMarks >= 70) return "B";
  if (totalMarks >= 65) return "B-";
  if (totalMarks >= 60) return "C+";
  if (totalMarks >= 55) return "C";
  if (totalMarks >= 50) return "C-";
  if (totalMarks >= 45) return "D+";
  if (totalMarks >= 40) return "D";
  return "F";
}

export function determineGradePoint(gradeLetter: string): number {
  const normalized = gradeLetter as GradeLetter;
  return GRADE_POINTS[normalized] ?? 0;
}

export function determineStatus(
  caMarks: number,
  finalExamMarks: number,
  gradeLetter: string
): GradeStatus {
  if (caMarks < 45 && finalExamMarks < 45) {
    return "pro-rata";
  }

  if (caMarks >= 45 && finalExamMarks < 45) {
    return "repeat";
  }

  if (caMarks >= 45 && finalExamMarks >= 45 && gradeLetter !== "F") {
    return "pass";
  }

  return "fail";
}

export function calculateFullGrade(
  caMarks: number,
  finalExamMarks: number
): CalculatedGrade {
  const totalMarks = calculateTotalMarks(caMarks, finalExamMarks);
  const gradeLetter = determineGradeLetter(totalMarks);
  const gradePoint = determineGradePoint(gradeLetter);
  const status = determineStatus(caMarks, finalExamMarks, gradeLetter);

  return {
    totalMarks,
    gradeLetter,
    gradePoint,
    status,
  };
}
