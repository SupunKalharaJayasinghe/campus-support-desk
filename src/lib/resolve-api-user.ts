import mongoose from "mongoose";
import { UserModel } from "@/models/User";

export type ApiRequestUser = { id: string; role: string };

export async function resolveActiveApiUser(request: Request): Promise<ApiRequestUser | null> {
  const userId = String(request.headers.get("x-user-id") ?? "").trim();
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const doc = await UserModel.findOne({ _id: userId, status: "ACTIVE" })
    .select({ role: 1 })
    .lean();
  if (!doc) {
    return null;
  }

  const role = String((doc as { role?: string }).role ?? "");
  return { id: userId, role };
}

export function isCommunityAdminRole(role: string) {
  return role === "COMMUNITY_ADMIN";
}
