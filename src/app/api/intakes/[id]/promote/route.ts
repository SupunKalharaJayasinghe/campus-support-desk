import { NextResponse } from "next/server";
import { persistIntakeRecords } from "@/models/intake-record-persistence";
import { connectMongoose } from "@/models/mongoose";
import {
  promoteIntake,
  sanitizeIntakeId,
  snapshotIntakes,
  sanitizeToggle,
} from "@/models/intake-store";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
        if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }
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
    await persistIntakeRecords(snapshotIntakes({ includeDeleted: true }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "Failed to promote intake." },
      { status: 500 }
    );
  }
}
