import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/Lecturer";
import "@/models/Student";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import { toAppRoleFromUserRole } from "@/models/rbac";
import { LabAssistantModel } from "@/models/LabAssistant";
import { LecturerModel } from "@/models/Lecturer";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const body = rawBody ?? {};
    const identifier = String(body.identifier ?? "").trim();
    const password = String(body.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json(
        { message: "Identifier and password are required" },
        { status: 400 }
      );
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Authentication service is unavailable" },
        { status: 503 }
      );
    }

    const normalizedIdentifier = identifier.toLowerCase();
    const userRow = await UserModel.findOne({
      status: "ACTIVE",
      $or: [
        { username: identifier },
        { username: identifier.toUpperCase() },
        { email: normalizedIdentifier },
      ],
    })
      .lean()
      .exec()
      .catch(() => null);

    const user = asObject(userRow);
    if (!user) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const passwordHash = String(user.passwordHash ?? "");
    if (!passwordHash) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const role = toAppRoleFromUserRole(user.role);
    let displayName = String(user.username ?? "User").trim();

    const studentRef = String(user.studentRef ?? "").trim();
    if (studentRef) {
      const studentRow = await StudentModel.findById(studentRef)
        .select({ firstName: 1, lastName: 1 })
        .lean()
        .exec()
        .catch(() => null);
      const student = asObject(studentRow);
      const firstName = String(student?.firstName ?? "").trim();
      const lastName = String(student?.lastName ?? "").trim();
      if (firstName || lastName) {
        displayName = `${firstName} ${lastName}`.trim();
      }
    }

    if (!studentRef) {
      const lecturerRef = String(user.lecturerRef ?? "").trim();
      if (lecturerRef) {
        const lecturerRow = await LecturerModel.findById(lecturerRef)
          .select({ fullName: 1 })
          .lean()
          .exec()
          .catch(() => null);
        const lecturer = asObject(lecturerRow);
        const fullName = String(lecturer?.fullName ?? "").trim();
        if (fullName) {
          displayName = fullName;
        }
      }

      const labAssistantRef = String(user.labAssistantRef ?? "").trim();
      if (labAssistantRef) {
        const labAssistantRow = await LabAssistantModel.findById(labAssistantRef)
          .select({ fullName: 1 })
          .lean()
          .exec()
          .catch(() => null);
        const labAssistant = asObject(labAssistantRow);
        const fullName = String(labAssistant?.fullName ?? "").trim();
        if (fullName) {
          displayName = fullName;
        }
      }
    }

    return NextResponse.json({
      user: {
        id: String(user._id ?? ""),
        role,
        name: displayName || "User",
        username: String(user.username ?? "").trim(),
        email: String(user.email ?? "").trim().toLowerCase(),
        mustChangePassword: Boolean(user.mustChangePassword),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to login" },
      { status: 500 }
    );
  }
}

