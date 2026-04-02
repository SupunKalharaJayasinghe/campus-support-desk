import { NextResponse } from "next/server";
import "@/models/Counter";
import { connectMongoose } from "@/models/mongoose";
import {
  buildStudentEmail,
  buildStudentId,
  getStudentIdStartSeed,
  resolveStudentPrefix,
} from "@/models/student-registration";
import { CounterModel } from "@/models/Counter";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);
  const intakeId = String(searchParams.get("intakeId") ?? "").trim();

  if (!intakeId) {
    return NextResponse.json({ message: "intakeId is required" }, { status: 400 });
  }

    if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  try {
    const { prefixKey } = resolveStudentPrefix(intakeId);
    const seed = getStudentIdStartSeed();
    const counter = (await CounterModel.findOne({ key: prefixKey })
      .lean()
      .exec()
      .catch(() => null)) as unknown;
    const counterRow = asObject(counter);
    const currentSeq = Math.floor(Number(counterRow?.seq) || seed - 1);
    const nextSeq = Math.max(seed, currentSeq + 1);
    const studentIdPreview = buildStudentId(prefixKey, nextSeq);

    return NextResponse.json({
      studentIdPreview,
      emailPreview: buildStudentEmail(studentIdPreview),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to generate preview",
      },
      { status: 400 }
    );
  }
}

