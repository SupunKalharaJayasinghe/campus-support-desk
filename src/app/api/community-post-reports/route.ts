import { connectDB } from "@/lib/mongodb";
import { resolveCommunityActorId } from "@/lib/community-user";
import {
  buildStoredReportReason,
  isCommunityPostReportReasonKey,
  type CommunityPostReportReasonKey,
} from "@/lib/community-post-report-reasons";
import CommunityPost from "@/models/communityPost";
import CommunityPostReport from "@/models/communityPostReport";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { postId, userId, username, email, name, reason, reasonKey, details } = body;

    if (!postId || !userId) {
      return Response.json(
        { error: "postId and userId are required" },
        { status: 400 }
      );
    }

    let normalizedReason = "";
    let resolvedReasonKey: CommunityPostReportReasonKey | undefined;

    const rawReasonKey = typeof reasonKey === "string" ? reasonKey : "";
    if (rawReasonKey && isCommunityPostReportReasonKey(rawReasonKey)) {
      resolvedReasonKey = rawReasonKey;
      normalizedReason = buildStoredReportReason(rawReasonKey, details);
    } else if (reason !== undefined && reason !== null && String(reason).trim()) {
      normalizedReason = String(reason).trim();
    }

    if (!normalizedReason) {
      return Response.json(
        { error: "A report reason is required (choose a category or enter details for Other)." },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return Response.json({ error: "Invalid postId" }, { status: 400 });
    }

    const validUserId = await resolveCommunityActorId({
      userId,
      username,
      email,
      name,
    });
    if (!validUserId) {
      return Response.json(
        { error: "Only logged-in users can report posts" },
        { status: 401 }
      );
    }

    const postExists = await CommunityPost.exists({ _id: postId });
    if (!postExists) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    const detailsTrimmed =
      details !== undefined && details !== null ? String(details).trim().slice(0, 2000) : undefined;

    const report = await CommunityPostReport.create({
      postId,
      userId: validUserId,
      reason: normalizedReason,
      ...(resolvedReasonKey
        ? {
            reasonKey: resolvedReasonKey,
            ...(resolvedReasonKey === "other" && detailsTrimmed ? { details: detailsTrimmed } : {}),
          }
        : {}),
      status: "OPEN",
    });

    return Response.json(report, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return Response.json(
        { error: "You have already reported this post" },
        { status: 409 }
      );
    }

    console.error("community-post-reports POST failed", error);
    return Response.json({ error: "Failed to report post" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const statusFilter =
      status === "OPEN" ||
      status === "REVIEWED" ||
      status === "AGREED" ||
      status === "DISMISSED"
        ? { status }
        : {};

    const reports = await CommunityPostReport.find(statusFilter)
      .sort({ createdAt: -1 })
      .populate({
        path: "postId",
        select: "title description category authorDisplayName",
      })
      .populate({ path: "userId", select: "username email" })
      .lean();

    return Response.json(reports);
  } catch (error) {
    console.error("community-post-reports GET failed", error);
    return Response.json(
      { error: "Failed to fetch post reports" },
      { status: 500 }
    );
  }
}
