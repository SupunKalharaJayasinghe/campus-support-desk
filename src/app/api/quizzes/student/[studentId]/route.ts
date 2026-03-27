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
import { collapseSpaces, loadModuleMetaMap, readId } from "../../route";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function formatTimeUntil(date: Date) {
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) {
    return "Expired";
  }

  const totalHours = Math.floor(diffMs / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diffMs % 3600000) / 60000);

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} ${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ${minutes} min`;
  }

  return `${Math.max(1, minutes)} min`;
}

export async function GET(
  request: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const studentId = String(params.studentId ?? "").trim();
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID format" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = collapseSpaces(searchParams.get("status")) || "available";
    if (!["available", "completed", "all"].includes(statusFilter)) {
      return NextResponse.json(
        { success: false, error: "status must be one of: available, completed, all" },
        { status: 400 }
      );
    }

    const studentExists = Boolean(
      await StudentModel.exists({ _id: studentId }).catch(() => null)
    );
    if (!studentExists) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const enrollments = (await EnrollmentModel.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      status: "ACTIVE",
    })
      .select("facultyId degreeProgramId intakeId")
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    if (enrollments.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          available: [],
          inProgress: [],
          completed: [],
          expired: [],
          summary: {
            totalAvailable: 0,
            totalInProgress: 0,
            totalCompleted: 0,
            totalExpired: 0,
            averageScore: 0,
          },
        },
      });
    }

    const offeringRows = (await ModuleOfferingModel.find({
      $or: enrollments
        .map((enrollment) => asObject(enrollment))
        .filter((row): row is Record<string, unknown> => Boolean(row))
        .map((row) => ({
          facultyId: collapseSpaces(row.facultyId),
          degreeProgramId: collapseSpaces(row.degreeProgramId),
          intakeId: collapseSpaces(row.intakeId),
        })),
    })
      .select("moduleId facultyId degreeProgramId intakeId termCode status")
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const offeringIds = offeringRows
      .map((row) => readId(asObject(row)?._id))
      .filter(Boolean);

    if (offeringIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          available: [],
          inProgress: [],
          completed: [],
          expired: [],
          summary: {
            totalAvailable: 0,
            totalInProgress: 0,
            totalCompleted: 0,
            totalExpired: 0,
            averageScore: 0,
          },
        },
      });
    }

    const quizzes = (await QuizModel.find({
      moduleOfferingId: {
        $in: offeringIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
      status: {
        $in: ["published", "closed"],
      },
    })
      .select(
        "title description moduleOfferingId questions totalMarks deadline startDate duration maxAttempts status"
      )
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const quizIds = quizzes
      .map((row) => readId(asObject(row)?._id))
      .filter(Boolean);
    const attempts = quizIds.length
      ? ((await QuizAttemptModel.find({
          studentId: new mongoose.Types.ObjectId(studentId),
          quizId: {
            $in: quizIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .lean()
          .exec()
          .catch(() => [])) as unknown[])
      : [];

    const moduleMetaMap = await loadModuleMetaMap(
      offeringRows.map((row) => collapseSpaces(asObject(row)?.moduleId))
    );

    const offeringMap = new Map(
      offeringRows
        .map((row) => asObject(row))
        .filter((row): row is Record<string, unknown> => Boolean(row))
        .map((row) => {
          const id = readId(row._id);
          const moduleId = collapseSpaces(row.moduleId);
          const moduleMeta =
            moduleMetaMap.get(moduleId) ?? moduleMetaMap.get(moduleId.toUpperCase());

          return [
            id,
            {
              id,
              moduleCode: moduleMeta?.code ?? moduleId,
              moduleName: moduleMeta?.name ?? moduleId,
            },
          ] as const;
        })
    );

    const attemptsByQuiz = new Map<string, Record<string, unknown>[]>();
    for (const attempt of attempts) {
      const row = asObject(attempt);
      if (!row) {
        continue;
      }

      const quizId = readId(row.quizId);
      const bucket = attemptsByQuiz.get(quizId) ?? [];
      bucket.push(row);
      attemptsByQuiz.set(quizId, bucket);
    }

    const now = new Date();
    const available: Array<{
      quiz: { id: string; title: string; description: string; duration: number; totalMarks: number; deadline: string; questionCount: number };
      module: { code: string; name: string };
      attemptsRemaining: number;
      timeUntilDeadline: string;
    }> = [];
    const inProgress: Array<{
      quiz: { id: string; title: string; duration: number; totalMarks: number; deadline: string };
      module: { code: string; name: string };
      attempt: { id: string; startedAt: string | null; timeRemaining: number };
    }> = [];
    const completed: Array<{
      quiz: { id: string; title: string; totalMarks: number };
      module: { code: string; name: string };
      bestAttempt: { score: number; percentage: number; passed: boolean; submittedAt: string | null };
      totalAttempts: number;
    }> = [];
    const expired: Array<{
      quiz: { id: string; title: string; totalMarks: number; deadline: string };
      module: { code: string; name: string };
    }> = [];

    for (const rawQuiz of quizzes) {
      const quiz = asObject(rawQuiz) ?? {};
      const quizId = readId(quiz._id);
      const offeringId = readId(quiz.moduleOfferingId);
      const moduleInfo = offeringMap.get(offeringId) ?? {
        moduleCode: collapseSpaces(asObject(quiz.moduleOfferingId)?.moduleId),
        moduleName: collapseSpaces(asObject(quiz.moduleOfferingId)?.moduleId),
      };
      const quizAttempts = attemptsByQuiz.get(quizId) ?? [];
      const inProgressAttempt =
        quizAttempts.find((attempt) => collapseSpaces(attempt.status) === "in_progress") ??
        null;
      const completedAttempts = quizAttempts.filter((attempt) =>
        ["submitted", "auto_submitted", "graded"].includes(collapseSpaces(attempt.status))
      );
      const totalAttempts = quizAttempts.length;
      const maxAttempts = Number(quiz.maxAttempts ?? 1);
      const attemptsRemaining = Math.max(0, maxAttempts - totalAttempts);
      const deadline =
        quiz.deadline instanceof Date
          ? quiz.deadline
          : new Date(String(quiz.deadline ?? now.toISOString()));
      const startDate =
        quiz.startDate instanceof Date
          ? quiz.startDate
          : quiz.startDate
            ? new Date(String(quiz.startDate))
            : null;

      const baseQuiz = {
        id: quizId,
        title: collapseSpaces(quiz.title),
        totalMarks: Number(quiz.totalMarks ?? 0),
      };

      if (inProgressAttempt) {
        const startedAt =
          inProgressAttempt.startedAt instanceof Date
            ? inProgressAttempt.startedAt
            : inProgressAttempt.startedAt
              ? new Date(String(inProgressAttempt.startedAt))
              : now;
        const timeByDuration = Math.max(
          0,
          Number(quiz.duration ?? 0) * 60 -
            Math.floor((now.getTime() - startedAt.getTime()) / 1000)
        );
        const timeByDeadline = Math.max(
          0,
          Math.floor((deadline.getTime() - now.getTime()) / 1000)
        );

        inProgress.push({
          quiz: {
            id: quizId,
            title: collapseSpaces(quiz.title),
            duration: Number(quiz.duration ?? 0),
            totalMarks: Number(quiz.totalMarks ?? 0),
            deadline: deadline.toISOString(),
          },
          module: {
            code: moduleInfo.moduleCode,
            name: moduleInfo.moduleName,
          },
          attempt: {
            id: readId(inProgressAttempt._id),
            startedAt: startedAt.toISOString(),
            timeRemaining: Math.min(timeByDuration, timeByDeadline),
          },
        });
        continue;
      }

      if (completedAttempts.length > 0) {
        const bestAttempt = [...completedAttempts].sort((left, right) => {
          const scoreDiff = Number(right.score ?? 0) - Number(left.score ?? 0);
          if (scoreDiff !== 0) {
            return scoreDiff;
          }

          return Number(right.percentage ?? 0) - Number(left.percentage ?? 0);
        })[0];

        completed.push({
          quiz: baseQuiz,
          module: {
            code: moduleInfo.moduleCode,
            name: moduleInfo.moduleName,
          },
          bestAttempt: {
            score: Number(bestAttempt?.score ?? 0),
            percentage: Number(bestAttempt?.percentage ?? 0),
            passed: Boolean(bestAttempt?.passed),
            submittedAt:
              bestAttempt?.submittedAt instanceof Date
                ? bestAttempt.submittedAt.toISOString()
                : bestAttempt?.submittedAt
                  ? String(bestAttempt.submittedAt)
                  : null,
          },
          totalAttempts: completedAttempts.length,
        });
        continue;
      }

      const isExpired =
        collapseSpaces(quiz.status) === "closed" ||
        deadline <= now ||
        (startDate !== null && Number.isNaN(startDate.getTime()) === false && startDate > deadline);

      if (isExpired || attemptsRemaining <= 0) {
        expired.push({
          quiz: {
            ...baseQuiz,
            deadline: deadline.toISOString(),
          },
          module: {
            code: moduleInfo.moduleCode,
            name: moduleInfo.moduleName,
          },
        });
        continue;
      }

      if (!startDate || startDate <= now) {
        available.push({
          quiz: {
            id: quizId,
            title: collapseSpaces(quiz.title),
            description: collapseSpaces(quiz.description),
            duration: Number(quiz.duration ?? 0),
            totalMarks: Number(quiz.totalMarks ?? 0),
            deadline: deadline.toISOString(),
            questionCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
          },
          module: {
            code: moduleInfo.moduleCode,
            name: moduleInfo.moduleName,
          },
          attemptsRemaining,
          timeUntilDeadline: formatTimeUntil(deadline),
        });
      }
    }

    const averageScore =
      completed.length > 0
        ? Math.round(
            ((completed.reduce(
              (sum, item) => sum + Number(item.bestAttempt.percentage ?? 0),
              0
            ) /
              completed.length +
              Number.EPSILON) *
              100) /
              100
          )
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        available: statusFilter === "available" || statusFilter === "all" ? available : [],
        inProgress: statusFilter === "available" || statusFilter === "all" ? inProgress : [],
        completed: statusFilter === "completed" || statusFilter === "all" ? completed : [],
        expired: statusFilter === "all" ? expired : [],
        summary: {
          totalAvailable: available.length,
          totalInProgress: inProgress.length,
          totalCompleted: completed.length,
          totalExpired: expired.length,
          averageScore,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch student quizzes",
      },
      { status: 500 }
    );
  }
}
