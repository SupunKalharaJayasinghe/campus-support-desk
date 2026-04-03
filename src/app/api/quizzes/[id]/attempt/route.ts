import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/ModuleOffering";
import "@/models/Quiz";
import "@/models/QuizAttempt";
import "@/models/Student";
import { connectMongoose } from "@/lib/mongoose";
import { EnrollmentModel } from "@/models/Enrollment";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { QuizModel } from "@/models/Quiz";
import { QuizAttemptModel } from "@/models/QuizAttempt";
import { StudentModel } from "@/models/Student";
import { collapseSpaces, readId, sanitizeQuizForStudent } from "../../route";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function shuffleArray<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function buildStudentQuizPayload(quiz: Record<string, unknown>) {
  const sanitizedQuiz = sanitizeQuizForStudent({
    id: readId(quiz._id ?? quiz.id),
    _id: readId(quiz._id ?? quiz.id),
    title: collapseSpaces(quiz.title),
    description: collapseSpaces(quiz.description),
    duration: Number(quiz.duration ?? 0),
    totalMarks: Number(quiz.totalMarks ?? 0),
    questions: Array.isArray(quiz.questions) ? quiz.questions : [],
  });

  const sanitizedRow = asObject(sanitizedQuiz) ?? {};
  const questions = Array.isArray(sanitizedRow.questions)
    ? [...(sanitizedRow.questions as Array<Record<string, unknown>>)].sort(
        (left, right) => Number(left.order ?? 0) - Number(right.order ?? 0)
      )
    : [];

  const maybeShuffledQuestions = quiz.shuffleQuestions ? shuffleArray(questions) : questions;

  return {
    id: readId(sanitizedRow.id ?? sanitizedRow._id),
    title: collapseSpaces(sanitizedRow.title),
    description: collapseSpaces(sanitizedRow.description),
    duration: Number(sanitizedRow.duration ?? 0),
    totalMarks: Number(sanitizedRow.totalMarks ?? 0),
    questions: maybeShuffledQuestions.map((question) => ({
      ...question,
      options:
        quiz.shuffleOptions && Array.isArray(question.options)
          ? shuffleArray(question.options)
          : question.options,
    })),
  };
}

async function checkStudentEnrollmentForOffering(
  studentId: string,
  offeringId: string
) {
  if (
    !mongoose.Types.ObjectId.isValid(studentId) ||
    !mongoose.Types.ObjectId.isValid(offeringId)
  ) {
    return false;
  }

  const enrollments = (await EnrollmentModel.find({
    studentId: new mongoose.Types.ObjectId(studentId),
    status: "ACTIVE",
  })
    .select("facultyId degreeProgramId intakeId")
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const enrollmentSelectors = enrollments
    .map((row) => asObject(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => ({
      facultyId: collapseSpaces(row.facultyId),
      degreeProgramId: collapseSpaces(row.degreeProgramId),
      intakeId: collapseSpaces(row.intakeId),
    }))
    .filter(
      (row) => row.facultyId && row.degreeProgramId && row.intakeId
    );

  if (enrollmentSelectors.length === 0) {
    return false;
  }

  return Boolean(
    await ModuleOfferingModel.exists({
      _id: new mongoose.Types.ObjectId(offeringId),
      $or: enrollmentSelectors,
    }).catch(() => null)
  );
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
    const studentId = collapseSpaces(body.studentId);

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Valid studentId is required" },
        { status: 400 }
      );
    }

    const [student, quiz] = await Promise.all([
      StudentModel.findById(studentId).select("_id").lean().exec().catch(() => null),
      QuizModel.findById(quizId)
        .populate({
          path: "moduleOfferingId",
          select: "moduleId intakeId termCode status degreeProgramId facultyId",
        })
        .lean()
        .exec()
        .catch(() => null),
    ]);

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    const quizRow = asObject(quiz) ?? {};
    const now = new Date();
    const deadline = quizRow.deadline instanceof Date ? quizRow.deadline : new Date(quizRow.deadline as string);
    const startDate =
      quizRow.startDate instanceof Date
        ? quizRow.startDate
        : quizRow.startDate
          ? new Date(String(quizRow.startDate))
          : null;

    if (collapseSpaces(quizRow.status) !== "published") {
      return NextResponse.json(
        { success: false, error: "Quiz is not currently published" },
        { status: 400 }
      );
    }

    if (!(deadline instanceof Date) || Number.isNaN(deadline.getTime()) || deadline <= now) {
      return NextResponse.json(
        { success: false, error: "Quiz deadline has passed" },
        { status: 400 }
      );
    }

    if (startDate && startDate > now) {
      return NextResponse.json(
        { success: false, error: "Quiz is not available yet" },
        { status: 400 }
      );
    }

    const enrolled = await checkStudentEnrollmentForOffering(
      studentId,
      readId(quizRow.moduleOfferingId)
    );

    if (!enrolled) {
      return NextResponse.json(
        {
          success: false,
          error: "Student is not enrolled in this module offering",
        },
        { status: 403 }
      );
    }

    const existingAttempt = await QuizAttemptModel.findOne({
      quizId: new mongoose.Types.ObjectId(quizId),
      studentId: new mongoose.Types.ObjectId(studentId),
      status: "in_progress",
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec()
      .catch(() => null);

    if (existingAttempt) {
      return NextResponse.json({
        success: true,
        data: {
          attempt: {
            id: readId((existingAttempt as Record<string, unknown>)._id),
            attemptNumber: Number(
              (existingAttempt as Record<string, unknown>).attemptNumber ?? 1
            ),
            startedAt:
              (existingAttempt as Record<string, unknown>).startedAt instanceof Date
                ? ((existingAttempt as Record<string, unknown>).startedAt as Date).toISOString()
                : (existingAttempt as Record<string, unknown>).startedAt,
            timeLimit: Number(quizRow.duration ?? 0),
            deadline: deadline.toISOString(),
          },
          quiz: buildStudentQuizPayload(quizRow),
        },
      });
    }

    const attemptCount = await QuizAttemptModel.getAttemptCount(
      new mongoose.Types.ObjectId(studentId),
      new mongoose.Types.ObjectId(quizId)
    ).catch(() => 0);

    if (attemptCount >= Number(quizRow.maxAttempts ?? 1)) {
      return NextResponse.json(
        { success: false, error: "Maximum attempts reached" },
        { status: 403 }
      );
    }

    const startedAt = new Date();
    const created = await QuizAttemptModel.create({
      quizId: new mongoose.Types.ObjectId(quizId),
      studentId: new mongoose.Types.ObjectId(studentId),
      answers: [],
      score: 0,
      totalMarks: Number(quizRow.totalMarks ?? 0),
      percentage: 0,
      passed: false,
      startedAt,
      submittedAt: startedAt,
      timeTaken: 0,
      isOnTime: true,
      isWithinTimeLimit: true,
      attemptNumber: attemptCount + 1,
      status: "in_progress",
      moduleOfferingId: mongoose.Types.ObjectId.isValid(readId(quizRow.moduleOfferingId))
        ? new mongoose.Types.ObjectId(readId(quizRow.moduleOfferingId))
        : undefined,
      academicYear: collapseSpaces(quizRow.academicYear) || undefined,
      semester:
        Number(quizRow.semester) === 1 || Number(quizRow.semester) === 2
          ? (Number(quizRow.semester) as 1 | 2)
          : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          attempt: {
            id: String(created._id),
            attemptNumber: created.attemptNumber,
            startedAt: created.startedAt.toISOString(),
            timeLimit: Number(quizRow.duration ?? 0),
            deadline: deadline.toISOString(),
          },
          quiz: buildStudentQuizPayload(quizRow),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start quiz attempt",
      },
      { status: 500 }
    );
  }
}
