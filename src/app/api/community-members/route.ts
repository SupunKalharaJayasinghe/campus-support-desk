import mongoose from "mongoose";
import { NextResponse } from "next/server";
import CommunityPost from "@/models/communityPost";
import CommunityReply from "@/models/communityReply";
import { UserModel } from "@/models/User";
import { connectMongoose } from "@/lib/mongoose";

function formatJoinedAt(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "";
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) {
    return s.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

export async function GET() {
  const conn = await connectMongoose().catch(() => null);
  if (!conn) {
    return NextResponse.json({ items: [] satisfies unknown[] });
  }

  type UserRow = {
    _id: mongoose.Types.ObjectId;
    username?: string;
    email?: string;
    status?: string;
    createdAt?: Date;
  };

  const users = (await UserModel.find({ role: "STUDENT" })
    .select("_id username email status createdAt")
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as UserRow[];

  const userIds = users.map((row) => row._id);

  let postGroups: { _id: mongoose.Types.ObjectId; count: number }[] = [];
  let replyGroups: { _id: mongoose.Types.ObjectId; count: number }[] = [];

  if (userIds.length > 0) {
    [postGroups, replyGroups] = await Promise.all([
      CommunityPost.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { author: { $in: userIds } } },
        { $group: { _id: "$author", count: { $sum: 1 } } },
      ]).exec(),
      CommunityReply.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { author: { $in: userIds } } },
        { $group: { _id: "$author", count: { $sum: 1 } } },
      ]).exec(),
    ]);
  }

  const postCountByUser = new Map(postGroups.map((g) => [String(g._id), g.count]));
  const replyCountByUser = new Map(replyGroups.map((g) => [String(g._id), g.count]));

  const items = users.map((userRow) => {
    const uid = String(userRow._id);
    const username = String(userRow.username ?? "").trim();
    const posts = postCountByUser.get(uid) ?? 0;
    const replies = replyCountByUser.get(uid) ?? 0;
    const accountInactive = userRow.status === "INACTIVE";
    return {
      id: username || uid,
      name: username || uid,
      email: String(userRow.email ?? "").trim().toLowerCase(),
      role: "Student" as const,
      joinedAt: formatJoinedAt(userRow.createdAt),
      contributions: posts + replies,
      status: accountInactive ? ("Suspended" as const) : ("Active" as const),
    };
  });

  return NextResponse.json({ items });
}
