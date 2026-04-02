import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/Lecturer";
import "@/models/Student";
import "@/models/User";
import "@/models/Enrollment";
import { connectMongoose } from "@/models/mongoose";
import { toAppRoleFromUserRole } from "@/models/rbac";
import { LabAssistantModel } from "@/models/LabAssistant";
import { LecturerModel } from "@/models/Lecturer";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";
import { EnrollmentModel } from "@/models/Enrollment";
import { findIntakeById } from "@/models/intake-store";

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
        { message: "Database connection is required" },
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
    let displayName =
      String(user.fullName ?? "").trim() ||
      String(user.username ?? "User").trim();
    let studentRegistrationNumber = "";
    let facultyCodes: string[] = [];
    let degreeProgramIds: string[] = [];
    let semesterCode = "";
    let stream = "";
    let subgroup = "";
    let intakeId = "";

    const studentRef = String(user.studentRef ?? "").trim();
    if (studentRef) {
      const studentRow = await StudentModel.findById(studentRef)
        .select({ studentId: 1, firstName: 1, lastName: 1 })
        .lean()
        .exec()
        .catch(() => null);
      const student = asObject(studentRow);
      studentRegistrationNumber = String(student?.studentId ?? "")
        .trim()
        .toUpperCase();
      const firstName = String(student?.firstName ?? "").trim();
      const lastName = String(student?.lastName ?? "").trim();
      if (firstName || lastName) {
        displayName = `${firstName} ${lastName}`.trim();
      }

      const enrollmentRow = await EnrollmentModel.findOne({
        studentId: studentRef,
        status: "ACTIVE",
      })
        .sort({ updatedAt: -1 })
        .select({
          facultyId: 1,
          degreeProgramId: 1,
          intakeId: 1,
          stream: 1,
          subgroup: 1,
        })
        .lean()
        .exec()
        .catch(() => null);

      const enrollment = asObject(enrollmentRow);
      if (enrollment) {
        const facultyCode = String(enrollment.facultyId ?? "")
          .trim()
          .toUpperCase();
        const degreeCode = String(enrollment.degreeProgramId ?? "")
          .trim()
          .toUpperCase();
        const intakeCode = String(enrollment.intakeId ?? "").trim();
        const streamCode = String(enrollment.stream ?? "").trim().toUpperCase();
        const subgroupCode = String(enrollment.subgroup ?? "").trim();

        facultyCodes = facultyCode ? [facultyCode] : [];
        degreeProgramIds = degreeCode ? [degreeCode] : [];
        intakeId = intakeCode;
        stream = streamCode === "WEEKDAY" || streamCode === "WEEKEND" ? streamCode : "";
        subgroup = subgroupCode;

        if (intakeCode) {
          const intake = findIntakeById(intakeCode);
          semesterCode = String(intake?.currentTerm ?? "")
            .trim()
            .toUpperCase();
        }
      }
    }

    if (!studentRef) {
      const lecturerRef = String(user.lecturerRef ?? "").trim();
      if (lecturerRef) {
        const lecturerRow = await LecturerModel.findById(lecturerRef)
          .select({ fullName: 1, facultyIds: 1, degreeProgramIds: 1 })
          .lean()
          .exec()
          .catch(() => null);
        const lecturer = asObject(lecturerRow);
        const fullName = String(lecturer?.fullName ?? "").trim();
        if (fullName) {
          displayName = fullName;
        }

        facultyCodes = Array.isArray(lecturer?.facultyIds)
          ? (lecturer?.facultyIds as unknown[])
              .map((value) => String(value ?? "").trim().toUpperCase())
              .filter(Boolean)
          : [];
        degreeProgramIds = Array.isArray(lecturer?.degreeProgramIds)
          ? (lecturer?.degreeProgramIds as unknown[])
              .map((value) => String(value ?? "").trim().toUpperCase())
              .filter(Boolean)
          : [];
      }

      const labAssistantRef = String(user.labAssistantRef ?? "").trim();
      if (labAssistantRef) {
        const labAssistantRow = await LabAssistantModel.findById(labAssistantRef)
          .select({ fullName: 1, facultyIds: 1, degreeProgramIds: 1 })
          .lean()
          .exec()
          .catch(() => null);
        const labAssistant = asObject(labAssistantRow);
        const fullName = String(labAssistant?.fullName ?? "").trim();
        if (fullName) {
          displayName = fullName;
        }

        facultyCodes = Array.isArray(labAssistant?.facultyIds)
          ? (labAssistant?.facultyIds as unknown[])
              .map((value) => String(value ?? "").trim().toUpperCase())
              .filter(Boolean)
          : facultyCodes;
        degreeProgramIds = Array.isArray(labAssistant?.degreeProgramIds)
          ? (labAssistant?.degreeProgramIds as unknown[])
              .map((value) => String(value ?? "").trim().toUpperCase())
              .filter(Boolean)
          : degreeProgramIds;
      }
    }

    return NextResponse.json({
      user: {
        id: String(user._id ?? ""),
        role,
        name: displayName || "User",
        username: String(user.username ?? "").trim(),
        email: String(user.email ?? "").trim().toLowerCase(),
        studentRef: studentRef || undefined,
        studentRegistrationNumber: studentRegistrationNumber || undefined,
        mustChangePassword: Boolean(user.mustChangePassword),
        facultyCodes,
        degreeProgramIds,
        semesterCode: semesterCode || undefined,
        stream: stream || undefined,
        subgroup: subgroup || undefined,
        intakeId: intakeId || undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to login" },
      { status: 500 }
    );
  }
}

