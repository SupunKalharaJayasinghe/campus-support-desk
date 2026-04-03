import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import { UserModel } from "@/models/User";
import {
  isNotificationEmailConfigured,
  sendNotificationEmails,
} from "@/lib/notification-email";
import { toAppRoleFromUserRole } from "@/models/rbac";

interface DeliveryRecipientInput {
  userId: string;
  name: string;
  emailTargets: string[];
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value: unknown) {
  return collapseSpaces(value).toLowerCase();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseRecipients(value: unknown): DeliveryRecipientInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: DeliveryRecipientInput[] = [];
  value.forEach((item) => {
    const row = asObject(item);
    if (!row) {
      return;
    }
    const userId = collapseSpaces(row.userId);
    const name = collapseSpaces(row.name) || "User";
    const emailTargets = Array.isArray(row.emailTargets)
      ? Array.from(
          new Set(
            row.emailTargets
              .map((email) => normalizeEmail(email))
              .filter((email) => Boolean(email))
          )
        )
      : [];

    if (!userId) {
      return;
    }

    rows.push({
      userId,
      name,
      emailTargets,
    });
  });

  return rows;
}

async function authorizeAdmin(request: Request) {
  const headerUserId = collapseSpaces(request.headers.get("x-user-id"));
  if (!headerUserId || !mongoose.Types.ObjectId.isValid(headerUserId)) {
    return null;
  }

  const user = (await UserModel.findById(headerUserId)
    .select({ _id: 1, role: 1, status: 1 })
    .lean()
    .exec()
    .catch(() => null)) as Record<string, unknown> | null;

  if (!user || collapseSpaces(user.status).toUpperCase() !== "ACTIVE") {
    return null;
  }

  const appRole = toAppRoleFromUserRole(user.role);
  if (appRole !== "SUPER_ADMIN") {
    return null;
  }

  return {
    userId: collapseSpaces(user._id),
    appRole,
  };
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function buildEmailHtml(input: {
  title: string;
  message: string;
  targetLabel: string;
  sentAt: string;
}) {
  const escapedTitle = input.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const escapedMessage = input.message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
  const escapedTarget = input.targetLabel
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
      <h2 style="margin: 0 0 12px;">${escapedTitle}</h2>
      <p style="margin: 0 0 14px;">${escapedMessage}</p>
      <p style="margin: 0; font-size: 12px; color: #555;">
        Audience: ${escapedTarget}<br />
        Sent at: ${input.sentAt}
      </p>
    </div>
  `.trim();
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const authorized = await authorizeAdmin(request);
    if (!authorized) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isNotificationEmailConfigured()) {
      return NextResponse.json(
        {
          message:
            "Email delivery is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL (or SMTP_FROM).",
        },
        { status: 503 }
      );
    }

    const payload = (await request.json().catch(() => null)) as
      | {
          title?: unknown;
          message?: unknown;
          targetLabel?: unknown;
          recipients?: unknown;
        }
      | null;

    const title = collapseSpaces(payload?.title).slice(0, 180);
    const message = collapseSpaces(payload?.message).slice(0, 3000);
    const targetLabel = collapseSpaces(payload?.targetLabel || "All Users").slice(0, 180);
    const recipients = parseRecipients(payload?.recipients);

    if (!title || !message) {
      return NextResponse.json(
        { message: "Title and message are required" },
        { status: 400 }
      );
    }

    if (recipients.length === 0) {
      return NextResponse.json({
        sentRecipients: 0,
        totalRecipients: 0,
        totalAddresses: 0,
        sentAddresses: 0,
        failedAddresses: 0,
        failedEmailList: [],
        message: "No recipients resolved for email delivery.",
      });
    }

    const uniqueAddressList = Array.from(
      new Set(recipients.flatMap((recipient) => recipient.emailTargets.map((email) => normalizeEmail(email))))
    ).filter(Boolean);

    if (uniqueAddressList.length === 0) {
      return NextResponse.json({
        sentRecipients: 0,
        totalRecipients: recipients.length,
        totalAddresses: 0,
        sentAddresses: 0,
        failedAddresses: 0,
        failedEmailList: [],
        message: "No valid recipient email addresses found.",
      });
    }

    const sentAt = new Date().toISOString();
    const textBody = `${title}\n\n${message}\n\nAudience: ${targetLabel}\nSent at: ${sentAt}`;
    const htmlBody = buildEmailHtml({
      title,
      message,
      targetLabel,
      sentAt,
    });

    const sendResult = await sendNotificationEmails({
      subject: `[Campus Support Desk] ${title}`,
      text: stripHtml(textBody),
      html: htmlBody,
      recipients: uniqueAddressList,
    });

    const messageLine =
      sendResult.failedAddresses > 0
        ? `Delivered to ${sendResult.sentAddresses}/${uniqueAddressList.length} email addresses.`
        : `Delivered to ${sendResult.sentAddresses} email addresses.`;

    const statusCode =
      sendResult.sentAddresses === 0 && sendResult.failedAddresses > 0 ? 502 : 200;

    return NextResponse.json(
      {
        sentRecipients: recipients.filter((recipient) =>
          recipient.emailTargets.some((email) =>
            !sendResult.failedEmailList.includes(normalizeEmail(email))
          )
        ).length,
        totalRecipients: recipients.length,
        totalAddresses: uniqueAddressList.length,
        sentAddresses: sendResult.sentAddresses,
        failedAddresses: sendResult.failedAddresses,
        failedEmailList: sendResult.failedEmailList,
        message: messageLine,
      },
      { status: statusCode }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to send notification emails",
      },
      { status: 500 }
    );
  }
}
