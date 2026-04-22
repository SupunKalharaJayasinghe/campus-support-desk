import { connectDB } from "@/lib/mongodb";
import { sendNotificationEmails } from "@/lib/notification-email";
import "@/models/User";
import CommunityPost from "@/models/communityPost";
import CommunityPostLike from "@/models/communityPostLike";
import CommunityPostReport from "@/models/communityPostReport";
import CommunityReply from "@/models/communityReply";
import { UserModel } from "@/models/User";
import mongoose from "mongoose";

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function buildPostDeletionEmail(args: {
  ownerName: string;
  postTitle: string;
  reportReason?: string;
  adminReviewComment?: string;
  deletedAtIso: string;
}) {
  const safeName = args.ownerName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeTitle = args.postTitle
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeReason = String(args.reportReason ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeReviewComment = String(args.adminReviewComment ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const reasonLine = String(args.reportReason ?? "").trim();
  const reviewLine = String(args.adminReviewComment ?? "").trim();

  const subject = "[Campus Support Desk] Your community post was removed";
  const text = [
    `Hello ${args.ownerName},`,
    "",
    `Your community post "${args.postTitle}" was removed by a community admin after a report review.`,
    reasonLine ? `Primary report reason: ${reasonLine}` : "",
    reviewLine ? `Admin review note: ${reviewLine}` : "",
    "",
    "If you think this was a mistake, please contact support.",
    "",
    `Deleted at: ${args.deletedAtIso}`,
  ].join("\n");
  const html = `
    <div style="background:#f4f7fb;padding:24px;font-family:Arial,sans-serif;line-height:1.55;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:14px;overflow:hidden;">
        <div style="background:#0b4fc8;padding:14px 18px;color:#ffffff;">
          <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Campus Support Desk</p>
        </div>
        <div style="padding:20px 18px;">
          <p style="margin:0 0 12px;">Hello ${safeName},</p>
          <p style="margin:0 0 12px;">
            Your community post "<strong>${safeTitle}</strong>" was removed by a community admin
            after a report review.
          </p>
          ${
            reasonLine
              ? `<p style="margin:0 0 10px;"><strong>Primary report reason:</strong> ${safeReason}</p>`
              : ""
          }
          ${
            reviewLine
              ? `<p style="margin:0 0 12px;"><strong>Admin review note:</strong> ${safeReviewComment}</p>`
              : ""
          }
          <p style="margin:0 0 12px;">If you think this was a mistake, please contact support.</p>
          <p style="margin:0;font-size:12px;color:#475569;">Deleted at: ${args.deletedAtIso}</p>
        </div>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid post id" }, { status: 400 });
    }

    const post = await CommunityPost.findById(params.id);

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    return Response.json(post);
  } catch (error) {
    console.error("community-posts/[id] GET failed", error);
    return Response.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid post id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const userIdRaw = searchParams.get("userId");
    const userId = typeof userIdRaw === "string" ? userIdRaw.trim() : "";

    const filter: { _id: string; author?: string } = { _id: params.id };
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return Response.json({ error: "Valid userId is required" }, { status: 400 });
      }
      filter.author = userId;
    }

    const deleted = await CommunityPost.findOneAndDelete(filter);

    if (!deleted) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    const latestAgreedReport = await CommunityPostReport.findOne({
      postId: params.id,
      status: "AGREED",
    })
      .sort({ updatedAt: -1 })
      .select({ reason: 1, reviewComment: 1 })
      .lean()
      .catch(() => null);

    await Promise.all([
      CommunityPostReport.deleteMany({ postId: params.id }),
      CommunityPostLike.deleteMany({ postId: params.id }),
      CommunityReply.deleteMany({ postId: params.id }),
    ]);

    const ownerId = String(deleted.author ?? "").trim();
    const owner = ownerId
      ? await UserModel.findById(ownerId).select({ fullName: 1, username: 1, email: 1 }).lean()
      : null;
    const ownerRecord = asRecord(owner);
    const latestAgreedReportRecord = asRecord(latestAgreedReport);
    const ownerEmail = normalizeEmail(ownerRecord?.email);
    let ownerEmailNotified = false;
    if (ownerEmail) {
      const ownerNameRaw =
        ownerRecord
          ? String(ownerRecord.fullName || ownerRecord.username || "Community member").trim()
          : "Community member";
      const ownerName = ownerNameRaw || "Community member";
      const postTitle = String(deleted.title ?? "").trim() || "Untitled post";
      const deletedAtIso = new Date().toISOString();
      const emailContent = buildPostDeletionEmail({
        ownerName,
        postTitle,
        reportReason: String(latestAgreedReportRecord?.reason ?? "").trim(),
        adminReviewComment: String(latestAgreedReportRecord?.reviewComment ?? "").trim(),
        deletedAtIso,
      });
      await sendNotificationEmails({
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        recipients: [ownerEmail],
      })
        .then((result) => {
          ownerEmailNotified = result.sentAddresses > 0;
        })
        .catch((emailError) => {
          console.error("community-posts/[id] DELETE email failed", emailError);
        });
    }

    return Response.json({
      message: "Post deleted",
      ownerEmailNotified,
    });
  } catch (error) {
    console.error("community-posts/[id] DELETE failed", error);
    return Response.json({ error: "Failed to delete post" }, { status: 500 });
  }
}

type UpdatePostPayload = {
  status?: unknown;
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return Response.json({ error: "Invalid post id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as UpdatePostPayload;
    const nextStatus = typeof body.status === "string" ? body.status.trim() : "";

    if (!["open", "resolved", "archived"].includes(nextStatus)) {
      return Response.json(
        { error: "Valid status is required" },
        { status: 400 }
      );
    }

    const updated = await CommunityPost.findByIdAndUpdate(
      params.id,
      { $set: { status: nextStatus } },
      { new: true }
    );

    if (!updated) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("community-posts/[id] PATCH failed", error);
    return Response.json({ error: "Failed to update post" }, { status: 500 });
  }
}
