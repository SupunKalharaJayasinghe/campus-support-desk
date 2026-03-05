import { NextResponse } from "next/server";
import { connectMongoose } from "@/lib/mongoose";
import {
  promoteIntake,
  sanitizeIntakeId,
  sanitizeToggle,
} from "@/lib/intake-store";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongoose().catch(() => null);
    const targetId = sanitizeIntakeId(params.id);
    const body = (await request.json().catch(() => ({}))) as Partial<{
      notifyStudents: boolean;
      lockPreviousTerm: boolean;
    }>;

    if (!targetId) {
      return NextResponse.json(
        { message: "Intake id is required" },
        { status: 400 }
      );
    }

    const result = promoteIntake(targetId, {
      lockPreviousTerm: sanitizeToggle(body.lockPreviousTerm),
      notifyStudents: sanitizeToggle(body.notifyStudents),
    });

    if (!result) {
      return NextResponse.json(
        { message: "Intake not found" },
        { status: 404 }
      );
    }

    if (!result.nextTerm) {
      return NextResponse.json(
        { message: "Intake is already in the final term" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "Failed to promote intake." },
      { status: 500 }
    );
  }
}
