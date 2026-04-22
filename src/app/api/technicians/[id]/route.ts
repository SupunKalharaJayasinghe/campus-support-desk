import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import {
  sanitizeAdminEmail,
  sanitizeAdminFullName,
  sanitizeAdminPassword,
  sanitizeAdminStatus,
  sanitizeAdminUsername,
} from "@/models/admin-user-store";
import {
  sanitizeTechnicianSpecialization,
  toTechnicianUserPersistedRecordFromUnknown,
} from "@/models/technician-user-store";
import { getMongoDuplicateField } from "@/models/student-registration";
import { UserModel } from "@/models/User";

interface TechnicianWriteInput {
  fullName: string;
  username: string;
  email: string;
  specialization: string;
  status: "ACTIVE" | "INACTIVE";
  password: string;
  mustChangePassword?: boolean;
}

function toWriteInput(body: Partial<Record<string, unknown>>): TechnicianWriteInput | null {
  const fullName = sanitizeAdminFullName(body.fullName);
  const email = sanitizeAdminEmail(body.email);
  const username = sanitizeAdminUsername(body.username) || email;
  if (!fullName || !email || !username) {
    return null;
  }

  const mustChangePassword =
    typeof body.mustChangePassword === "boolean" ? body.mustChangePassword : undefined;

  return {
    fullName,
    username,
    email,
    specialization: sanitizeTechnicianSpecialization(body.specialization),
    status: sanitizeAdminStatus(body.status),
    password: sanitizeAdminPassword(body.password),
    mustChangePassword,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const userId = String(params.id ?? "").trim();
  if (!userId) {
    return NextResponse.json({ message: "Technician user id is required" }, { status: 400 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json({ message: "Database connection is required" }, { status: 503 });
  }

  const row = await UserModel.findOne({
    _id: userId,
    role: { $in: ["TECHNICIAN", "TECHNISIAN"] },
  })
    .select({
      fullName: 1,
      username: 1,
      email: 1,
      specialization: 1,
      role: 1,
      status: 1,
      mustChangePassword: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .lean()
    .exec()
    .catch(() => null);
  if (!row) {
    return NextResponse.json({ message: "Technician user not found" }, { status: 404 });
  }

  const parsed = toTechnicianUserPersistedRecordFromUnknown(row);
  if (!parsed) {
    return NextResponse.json({ message: "Failed to map technician user" }, { status: 500 });
  }

  return NextResponse.json(parsed);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = String(params.id ?? "").trim();
    if (!userId) {
      return NextResponse.json({ message: "Technician user id is required" }, { status: 400 });
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};
    const input = toWriteInput(body);
    if (!input) {
      return NextResponse.json(
        { message: "Full name, username, and email are required" },
        { status: 400 }
      );
    }

    if (input.password && input.password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json({ message: "Database connection is required" }, { status: 503 });
    }

    const row = await UserModel.findOne({
      _id: userId,
      role: { $in: ["TECHNICIAN", "TECHNISIAN"] },
    }).exec();
    if (!row) {
      return NextResponse.json({ message: "Technician user not found" }, { status: 404 });
    }

    row.fullName = input.fullName;
    row.username = input.username;
    row.email = input.email;
    row.specialization = input.specialization;
    row.status = input.status;
    if (input.password) {
      row.passwordHash = await bcrypt.hash(input.password, 10);
      row.mustChangePassword = true;
    } else if (input.mustChangePassword !== undefined) {
      row.mustChangePassword = Boolean(input.mustChangePassword);
    }

    try {
      await row.save();
    } catch (error) {
      const duplicateField = getMongoDuplicateField(error);
      if (duplicateField === "email") {
        return NextResponse.json({ message: "Email already exists" }, { status: 409 });
      }
      if (duplicateField === "username") {
        return NextResponse.json({ message: "Username already exists" }, { status: 409 });
      }
      throw error;
    }

    const parsed = toTechnicianUserPersistedRecordFromUnknown(row.toObject());
    if (!parsed) {
      return NextResponse.json({ message: "Failed to map technician user" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update technician user",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = String(params.id ?? "").trim();
    if (!userId) {
      return NextResponse.json({ message: "Technician user id is required" }, { status: 400 });
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json({ message: "Database connection is required" }, { status: 503 });
    }

    const deletedRow = await UserModel.findOneAndDelete({
      _id: userId,
      role: { $in: ["TECHNICIAN", "TECHNISIAN"] },
    })
      .lean()
      .exec()
      .catch(() => null);
    if (!deletedRow) {
      return NextResponse.json({ message: "Technician user not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to delete technician user",
      },
      { status: 500 }
    );
  }
}
