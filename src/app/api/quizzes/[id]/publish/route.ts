import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import "@/models/Quiz";
import "@/models/User";
import { connectMongoose } from "@/lib/mongoose";
import { QuizModel } from "@/models/Quiz";
import { mapQuizRowsForResponse } from "../../route";

export async function POST(
  _request: Request,
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

    const quiz = await QuizModel.findById(quizId).exec();
    if (!quiz) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    if (quiz.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Only draft quizzes can be published" },
        { status: 400 }
      );
    }

    if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Quiz must have at least one question before publishing" },
        { status: 400 }
      );
    }

    if (!quiz.deadline || quiz.deadline <= new Date()) {
      return NextResponse.json(
        { success: false, error: "Quiz deadline must be in the future before publishing" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(Number(quiz.duration)) || Number(quiz.duration) < 1) {
      return NextResponse.json(
        { success: false, error: "Quiz duration must be at least 1 minute" },
        { status: 400 }
      );
    }

    quiz.status = "published";
    await quiz.save();

    const row = await QuizModel.findById(quizId)
      .populate({
        path: "moduleOfferingId",
        select: "moduleId intakeId termCode status degreeProgramId facultyId",
      })
      .populate({
        path: "createdBy",
        select: "username email role",
      })
      .lean()
      .exec()
      .catch(() => null);

    const mapped = row ? (await mapQuizRowsForResponse([row]))[0] : null;
    if (!mapped) {
      return NextResponse.json(
        { success: false, error: "Failed to map published quiz" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mapped,
      message: "Quiz published successfully. Students can now access it.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to publish quiz",
      },
      { status: 500 }
    );
  }
}
