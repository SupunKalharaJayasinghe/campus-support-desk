import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import "@/models/Student";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import {
  getMongoDuplicateField,
  sanitizeNicNumber,
} from "@/models/student-registration";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const studentRecordId = String(params.id ?? "").trim();
    if (!studentRecordId) {
      return NextResponse.json({ message: "Student id is required" }, { status: 400 });
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
        if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const studentRow = await StudentModel.findById(studentRecordId)
      .lean()
      .exec()
      .catch(() => null);
    if (!studentRow) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    const student = asObject(studentRow);
    const nicNumber = sanitizeNicNumber(student?.nicNumber);
    const studentId = String(student?.studentId ?? "").trim().toUpperCase();
    const email = String(student?.email ?? "").trim().toLowerCase();

    if (!nicNumber) {
      return NextResponse.json(
        { message: "Student NIC number is missing" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(nicNumber, 10);
    const updated = await UserModel.findOneAndUpdate(
      { studentRef: studentRecordId },
      {
        $set: {
          passwordHash,
          mustChangePassword: true,
          status: "ACTIVE",
        },
      },
      { new: true }
    ).exec();

    if (!updated) {
      if (!studentId || !email) {
        return NextResponse.json(
          { message: "Student credentials are incomplete" },
          { status: 400 }
        );
      }

      try {
        await UserModel.create({
          username: studentId,
          email,
          role: "STUDENT",
          passwordHash,
          mustChangePassword: true,
          status: "ACTIVE",
          studentRef: studentRecordId,
        });
      } catch (error) {
        const duplicateField = getMongoDuplicateField(error);
        if (duplicateField) {
          return NextResponse.json(
            { message: "Student login account already exists with conflicting data" },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Password reset to NIC number",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to reset password",
      },
      { status: 500 }
    );
  }
}
