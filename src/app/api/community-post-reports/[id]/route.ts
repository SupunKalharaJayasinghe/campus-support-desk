import { connectDB } from "@/lib/mongodb";
import CommunityPostReport from "@/models/communityPostReport";
import mongoose from "mongoose";

function parseAdminReviewAcknowledged(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === undefined || value === null) return false;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  }
  return false;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid report id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      saveAdminReview?: unknown;
      status?: unknown;
      adminReviewAcknowledged?: unknown;
      reviewComment?: unknown;
    };

    const saveAdminReview =
      body.saveAdminReview === true ||
      body.saveAdminReview === "true" ||
      body.saveAdminReview === 1;

    if (saveAdminReview) {
      const acknowledged = parseAdminReviewAcknowledged(body.adminReviewAcknowledged);
      const commentRaw =
        body.reviewComment !== undefined && body.reviewComment !== null
          ? String(body.reviewComment).trim()
          : "";

      if (!acknowledged) {
        return Response.json(
          {
            error:
              "Confirm the checkbox: as community admin you must acknowledge reviewing this post before saving your admin review.",
          },
          { status: 400 }
        );
      }
      if (!commentRaw) {
        return Response.json(
          { error: "A review comment is required before saving your admin review." },
          { status: 400 }
        );
      }

      const existingDoc = await CommunityPostReport.findById(params.id).lean();
      if (!existingDoc || Array.isArray(existingDoc)) {
        return Response.json({ error: "Report not found" }, { status: 404 });
      }

      const existingSave = existingDoc as { status?: string };
      const existingStatusNorm =
        existingSave.status === undefined ||
        existingSave.status === null ||
        existingSave.status === ""
          ? "OPEN"
          : String(existingSave.status).trim().toUpperCase();

      const $set: Record<string, unknown> = {
        adminReviewAcknowledged: true,
        reviewComment: commentRaw.slice(0, 4000),
      };
      if (existingStatusNorm === "OPEN") {
        $set.status = "REVIEWED";
      }

      const updated = await CommunityPostReport.findByIdAndUpdate(
        params.id,
        { $set },
        { new: true }
      ).lean();

      if (!updated) {
        return Response.json({ error: "Report not found" }, { status: 404 });
      }

      return Response.json(updated);
    }

    const raw = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    const status =
      raw === "OPEN" ||
      raw === "REVIEWED" ||
      raw === "AGREED" ||
      raw === "DISMISSED"
        ? raw
        : null;

    if (!status) {
      return Response.json(
        { error: "status must be OPEN, REVIEWED, AGREED, or DISMISSED" },
        { status: 400 }
      );
    }

    const existingDoc = await CommunityPostReport.findById(params.id).lean();
    if (!existingDoc || Array.isArray(existingDoc)) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }
    const existing = existingDoc as { status?: string; reviewComment?: unknown };

    const closing =
      status === "REVIEWED" || status === "AGREED" || status === "DISMISSED";

    const acknowledged = parseAdminReviewAcknowledged(body.adminReviewAcknowledged);
    const commentRaw =
      body.reviewComment !== undefined && body.reviewComment !== null
        ? String(body.reviewComment).trim()
        : "";

    const rawExistingStatus = existing.status;
    const existingStatusNorm =
      rawExistingStatus === undefined ||
      rawExistingStatus === null ||
      rawExistingStatus === ""
        ? "OPEN"
        : String(rawExistingStatus).trim().toUpperCase();
    const wasOpen = existingStatusNorm === "OPEN";

    const existingComment =
      existing.reviewComment !== undefined && existing.reviewComment !== null
        ? String(existing.reviewComment).trim()
        : "";

    const movingToFinalDecision =
      existingStatusNorm === "REVIEWED" &&
      (status === "AGREED" || status === "DISMISSED");

    if (wasOpen && closing) {
      if (!acknowledged) {
        return Response.json(
          {
            error:
              "Confirm the checkbox: as community admin you must acknowledge reviewing this post before applying a decision.",
          },
          { status: 400 }
        );
      }
      if (!commentRaw) {
        return Response.json(
          { error: "A review comment is required before you can close this report." },
          { status: 400 }
        );
      }
    }

    if (movingToFinalDecision) {
      if (!acknowledged) {
        return Response.json(
          {
            error:
              "Confirm the checkbox: as community admin you must acknowledge this outcome before accepting or dismissing the report.",
          },
          { status: 400 }
        );
      }
      const merged = (commentRaw || existingComment).trim();
      if (!merged) {
        return Response.json(
          {
            error:
              "A review comment is required (add one above or save your admin review first) before accepting or dismissing.",
          },
          { status: 400 }
        );
      }
    }

    const $set: Record<string, unknown> = { status };
    if (wasOpen && closing) {
      $set.adminReviewAcknowledged = true;
      $set.reviewComment = commentRaw.slice(0, 4000);
    } else if (!wasOpen && closing) {
      if (movingToFinalDecision) {
        const merged = (commentRaw || existingComment).trim();
        $set.adminReviewAcknowledged = true;
        $set.reviewComment = merged.slice(0, 4000);
      } else if (acknowledged && commentRaw) {
        // Still REVIEWED (or same closing status): backfill / update comment.
        $set.adminReviewAcknowledged = true;
        $set.reviewComment = commentRaw.slice(0, 4000);
      }
    }

    if (status === "REVIEWED") {
      const setComment =
        typeof $set.reviewComment === "string" ? $set.reviewComment.trim() : "";
      if (!setComment && !existingComment) {
        return Response.json(
          {
            error:
              "Admin review comment is required and must be saved when marking a report as Reviewed.",
          },
          { status: 400 }
        );
      }
      const persistedComment = setComment || existingComment;
      if (persistedComment.trim().length > 0) {
        $set.adminReviewAcknowledged = true;
      }
    }

    const updated = await CommunityPostReport.findByIdAndUpdate(
      params.id,
      { $set },
      { new: true }
    ).lean();

    if (!updated) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("community-post-reports PATCH failed", error);
    return Response.json({ error: "Failed to update report" }, { status: 500 });
  }
}
