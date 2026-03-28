import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { UserModel } from "@/models/User";

type ResolveActorInput = {
  userId?: unknown;
  username?: unknown;
  email?: unknown;
  name?: unknown;
};

function toSafeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(username: string, email: string, name: string) {
  if (email) {
    return email.toLowerCase();
  }
  if (username) {
    return `${username.toLowerCase()}@demo.local`;
  }
  return `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")}@demo.local`;
}

function leanDocId(doc: unknown): string | undefined {
  if (doc == null || Array.isArray(doc) || typeof doc !== "object") {
    return undefined;
  }
  const id = (doc as { _id?: unknown })._id;
  return id != null ? String(id) : undefined;
}

function normalizeUsername(username: string, email: string, name: string) {
  if (username) {
    return username.toUpperCase();
  }
  if (email) {
    return email.split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "") || "USER";
  }
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "") || "USER";
}

async function createUniqueUsername(base: string) {
  let candidate = base.slice(0, 20) || "USER";
  let suffix = 1;
  while (await UserModel.exists({ username: candidate })) {
    const suffixText = String(suffix);
    const allowedBaseLength = Math.max(1, 20 - suffixText.length);
    candidate = `${base.slice(0, allowedBaseLength)}${suffixText}`;
    suffix += 1;
  }
  return candidate;
}

export async function resolveCommunityActorId(input: ResolveActorInput) {
  const userId = toSafeString(input.userId);
  const username = toSafeString(input.username);
  const email = toSafeString(input.email).toLowerCase();
  const name = toSafeString(input.name) || "Current User";

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const exists = await UserModel.exists({ _id: userId, status: "ACTIVE" });
    if (exists) {
      return userId;
    }
  }

  if (email) {
    const byEmail = await UserModel.findOne({ email, status: "ACTIVE" })
      .select({ _id: 1 })
      .lean();
    const byEmailId = leanDocId(byEmail);
    if (byEmailId) {
      return byEmailId;
    }
  }

  if (username) {
    const byUsername = await UserModel.findOne({
      username: username.toUpperCase(),
      status: "ACTIVE",
    })
      .select({ _id: 1 })
      .lean();
    const byUsernameId = leanDocId(byUsername);
    if (byUsernameId) {
      return byUsernameId;
    }
  }

  const normalizedEmail = normalizeEmail(username, email, name);
  const existingByNormalizedEmail = await UserModel.findOne({
    email: normalizedEmail,
    status: "ACTIVE",
  })
    .select({ _id: 1 })
    .lean();
  const existingId = leanDocId(existingByNormalizedEmail);
  if (existingId) {
    return existingId;
  }

  const baseUsername = normalizeUsername(username, normalizedEmail, name);
  const uniqueUsername = await createUniqueUsername(baseUsername);

  const created = await UserModel.create({
    username: uniqueUsername,
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(`temp-${Date.now()}`, 10),
    role: "STUDENT",
    status: "ACTIVE",
    mustChangePassword: false,
  });

  return String(created._id);
}

