import { randomUUID } from "crypto";
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
  type TechnicianUserSort,
  type TechnicianUserStatus,
} from "@/models/technician-user-store";
import {
  getMongoDuplicateField,
  isMongoDuplicateKeyError,
} from "@/models/student-registration";
import { UserModel } from "@/models/User";

interface TechnicianWriteInput {
  fullName: string;
  username: string;
  email: string;
  specialization: string;
  status: TechnicianUserStatus;
  password: string;
}

function parsePageParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parsePageSizeParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const pageSize = Math.floor(parsed);
  if (![10, 25, 50, 100].includes(pageSize)) {
    return fallback;
  }
  return pageSize;
}

function sanitizeSort(value: string | null): TechnicianUserSort {
  if (value === "az" || value === "za" || value === "created") {
    return value;
  }
  return "updated";
}

function sanitizeStatusFilter(value: string | null): "" | TechnicianUserStatus {
  if (value === "ACTIVE" || value === "INACTIVE") {
    return value;
  }
  return "";
}

function buildGeneratedPassword() {
  const configured = String(process.env.ADMIN_DEFAULT_PASSWORD_FALLBACK ?? "").trim();
  if (configured.length >= 8) {
    return configured;
  }
  return `tec-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function toWriteInput(body: Partial<Record<string, unknown>>): TechnicianWriteInput | null {
  const fullName = sanitizeAdminFullName(body.fullName);
  const email = sanitizeAdminEmail(body.email);
  const username = sanitizeAdminUsername(body.username) || email;
  if (!fullName || !email || !username) {
    return null;
  }

  return {
    fullName,
    username,
    email,
    specialization: sanitizeTechnicianSpecialization(body.specialization),
    status: sanitizeAdminStatus(body.status),
    password: sanitizeAdminPassword(body.password),
  };
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);
  const search = String(searchParams.get("search") ?? "").trim();
  const status = sanitizeStatusFilter(searchParams.get("status"));
  const sort = sanitizeSort(searchParams.get("sort"));
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);
  const page = parsePageParam(searchParams.get("page"), 1);

  if (!mongooseConnection) {
    return NextResponse.json({ message: "Database connection is required" }, { status: 503 });
  }

  const query: Record<string, unknown> = {
    role: { $in: ["TECHNICIAN", "TECHNISIAN"] },
  };
  if (status) {
    query.status = status;
  }
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedSearch, "i");
    query.$or = [
      { fullName: searchRegex },
      { username: searchRegex },
      { email: searchRegex },
      { specialization: searchRegex },
    ];
  }

  const total = await UserModel.countDocuments(query).catch(() => 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const skip = (safePage - 1) * pageSize;
  const sortQuery: Record<string, 1 | -1> =
    sort === "az"
      ? { fullName: 1 }
      : sort === "za"
        ? { fullName: -1 }
        : sort === "created"
          ? { createdAt: -1 }
          : { updatedAt: -1 };

  const rows = (await UserModel.find(query)
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
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toTechnicianUserPersistedRecordFromUnknown(row))
    .filter((row): row is NonNullable<ReturnType<typeof toTechnicianUserPersistedRecordFromUnknown>> =>
      Boolean(row)
    );

  return NextResponse.json({
    items,
    total,
    page: safePage,
    pageSize,
  });
}

export async function POST(request: Request) {
  try {
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

    const rawPassword = input.password || buildGeneratedPassword();
    if (rawPassword.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
    }
    const generatedPassword = input.password ? "" : rawPassword;
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json({ message: "Database connection is required" }, { status: 503 });
    }

    const created = await UserModel.create({
      fullName: input.fullName,
      username: input.username,
      email: input.email,
      specialization: input.specialization,
      role: "TECHNICIAN",
      status: input.status,
      passwordHash,
      mustChangePassword: true,
      studentRef: null,
      lecturerRef: null,
      labAssistantRef: null,
    }).catch((error: unknown) => {
      const duplicateField = getMongoDuplicateField(error);
      if (isMongoDuplicateKeyError(error)) {
        if (duplicateField === "email") {
          throw new Error("Email already exists");
        }
        if (duplicateField === "username") {
          throw new Error("Username already exists");
        }
      }
      throw error;
    });

    const parsed = toTechnicianUserPersistedRecordFromUnknown(created?.toObject?.() ?? created);
    if (!parsed) {
      throw new Error("Failed to map technician user");
    }

    return NextResponse.json(
      {
        item: parsed,
        generatedPassword: generatedPassword || undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create technician user";
    if (message === "Email already exists" || message === "Username already exists") {
      return NextResponse.json({ message }, { status: 409 });
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}
