import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import {
  createAdminUserInMemory,
  listAdminUsersInMemory,
  sanitizeAdminEmail,
  sanitizeAdminFullName,
  sanitizeAdminPassword,
  sanitizeAdminRole,
  sanitizeAdminStatus,
  sanitizeAdminUsername,
  toAdminUserPersistedRecordFromUnknown,
  type AdminUserRole,
  type AdminUserSort,
  type AdminUserStatus,
} from "@/models/admin-user-store";
import {
  getMongoDuplicateField,
  isMongoDuplicateKeyError,
} from "@/models/student-registration";
import { UserModel } from "@/models/User";

const ADMIN_ROLES: AdminUserRole[] = ["ADMIN", "LOST_ITEM_ADMIN"];

interface AdminUserWriteInput {
  fullName: string;
  username: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
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

function sanitizeSort(value: string | null): AdminUserSort {
  if (value === "az" || value === "za" || value === "created") {
    return value;
  }
  return "updated";
}

function sanitizeRoleFilter(value: string | null): "" | AdminUserRole {
  if (value === "ADMIN" || value === "LOST_ITEM_ADMIN") {
    return value;
  }
  return "";
}

function sanitizeStatusFilter(value: string | null): "" | AdminUserStatus {
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
  return `adm-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function toWriteInput(body: Partial<Record<string, unknown>>): AdminUserWriteInput | null {
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
    role: sanitizeAdminRole(body.role),
    status: sanitizeAdminStatus(body.status),
    password: sanitizeAdminPassword(body.password),
  };
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);
  const search = String(searchParams.get("search") ?? "").trim();
  const role = sanitizeRoleFilter(searchParams.get("role"));
  const status = sanitizeStatusFilter(searchParams.get("status"));
  const sort = sanitizeSort(searchParams.get("sort"));
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);
  const page = parsePageParam(searchParams.get("page"), 1);

  if (!mongooseConnection) {
    const allItems = listAdminUsersInMemory({ search, role, status, sort });
    const total = allItems.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;

    return NextResponse.json({
      items: allItems.slice(start, start + pageSize),
      total,
      page: safePage,
      pageSize,
    });
  }

  const query: Record<string, unknown> = {
    role: { $in: ADMIN_ROLES },
  };
  if (role) {
    query.role = role;
  }
  if (status) {
    query.status = status;
  }
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedSearch, "i");
    query.$or = [{ fullName: searchRegex }, { username: searchRegex }, { email: searchRegex }];
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
    .map((row) => toAdminUserPersistedRecordFromUnknown(row))
    .filter((row): row is NonNullable<ReturnType<typeof toAdminUserPersistedRecordFromUnknown>> =>
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
      return NextResponse.json(
        { message: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    const generatedPassword = input.password ? "" : rawPassword;
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      try {
        const created = createAdminUserInMemory({
          fullName: input.fullName,
          username: input.username,
          email: input.email,
          role: input.role,
          status: input.status,
          passwordHash,
          mustChangePassword: true,
        });
        return NextResponse.json(
          {
            item: created,
            generatedPassword: generatedPassword || undefined,
          },
          { status: 201 }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create admin user";
        if (message === "Email already exists" || message === "Username already exists") {
          return NextResponse.json({ message }, { status: 409 });
        }
        throw error;
      }
    }

    const created = await UserModel.create({
      fullName: input.fullName,
      username: input.username,
      email: input.email,
      role: input.role,
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

    const parsed = toAdminUserPersistedRecordFromUnknown(created?.toObject?.() ?? created);
    if (!parsed) {
      throw new Error("Failed to map admin user");
    }

    return NextResponse.json(
      {
        item: parsed,
        generatedPassword: generatedPassword || undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create admin user";
    if (message === "Email already exists" || message === "Username already exists") {
      return NextResponse.json({ message }, { status: 409 });
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}
