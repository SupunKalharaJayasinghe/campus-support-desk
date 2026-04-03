import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import "@/models/User";
import { UserModel } from "@/models/User";
import { connectDB } from "@/models/db";
import { getMongoDuplicateField } from "@/models/student-registration";

const ROLES = [
  "ADMIN",
  "LECTURER",
  "LAB_ASSISTANT",
  "STUDENT",
  "COMMUNITY_ADMIN",
] as const;

type UserRole = (typeof ROLES)[number];

function parseRole(value: unknown): UserRole | null {
  if (typeof value !== "string") {
    return null;
  }

  return ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return NextResponse.json(
      {
        message:
          "Demo mode is enabled. Set NEXT_PUBLIC_DEMO_MODE=false and restart the server to persist users in MongoDB.",
      },
      { status: 400 }
    );
  }

  try {
    await connectDB();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database connection failed.";
    return NextResponse.json({ message }, { status: 503 });
  }

  const rawBody = (await request.json().catch(() => null)) as
    | Partial<Record<string, unknown>>
    | null;
  const body = rawBody ?? {};

  const username = String(body.username ?? "").trim();
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const role = parseRole(body.role);
  const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const mustChangePassword = body.mustChangePassword !== false;

  if (!username || !email || !password) {
    return NextResponse.json(
      { message: "Username, email, and password are required." },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { message: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  if (!role) {
    return NextResponse.json({ message: "Select a valid role." }, { status: 400 });
  }

  const enumValues = (UserModel.schema.path("role") as unknown as { enumValues?: unknown })
    ?.enumValues;
  if (Array.isArray(enumValues) && !enumValues.includes(role)) {
    return NextResponse.json(
      {
        message: `Role '${role}' is not allowed by server schema.`,
        allowedRoles: enumValues,
      },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const doc = await UserModel.create({
      username,
      email,
      passwordHash,
      role,
      mustChangePassword,
      status,
    });

    return NextResponse.json(
      {
        id: String(doc._id),
        username: doc.username,
        email: doc.email,
        role: doc.role,
        status: doc.status,
      },
      { status: 201 }
    );
  } catch (error) {
    const duplicateField = getMongoDuplicateField(error);
    if (duplicateField === "username" || duplicateField === "email") {
      return NextResponse.json(
        {
          message:
            duplicateField === "username"
              ? "That username is already in use."
              : "That email is already registered.",
        },
        { status: 409 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: unknown }).name === "ValidationError"
    ) {
      const message =
        "message" in error && typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Validation failed.";
      return NextResponse.json({ message }, { status: 400 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to create user.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
