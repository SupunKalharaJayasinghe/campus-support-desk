import nodemailer, { type Transporter } from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  fromName: string;
  auth?: {
    user: string;
    pass: string;
  };
}

export interface NotificationEmailSendInput {
  subject: string;
  text: string;
  html: string;
  recipients: string[];
}

export interface NotificationEmailSendResult {
  sentAddresses: number;
  failedAddresses: number;
  failedEmailList: string[];
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value: unknown) {
  return collapseSpaces(value).toLowerCase();
}

function parseBooleanFlag(value: unknown, fallback = false) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parsePort(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const rounded = Math.floor(parsed);
  if (rounded <= 0 || rounded > 65535) {
    return fallback;
  }
  return rounded;
}

function readSmtpConfig(): SmtpConfig | null {
  const host = collapseSpaces(process.env.SMTP_HOST);
  const from =
    normalizeEmail(process.env.SMTP_FROM_EMAIL) ||
    normalizeEmail(process.env.SMTP_FROM) ||
    "";

  if (!host || !from) {
    return null;
  }

  const user = collapseSpaces(process.env.SMTP_USER);
  const pass = String(process.env.SMTP_PASS ?? "").trim();
  const hasAuth = Boolean(user) && Boolean(pass);
  const secure = parseBooleanFlag(process.env.SMTP_SECURE, false);
  const defaultPort = secure ? 465 : 587;
  const port = parsePort(process.env.SMTP_PORT, defaultPort);
  const fromName = collapseSpaces(process.env.SMTP_FROM_NAME) || "Campus Support Desk";

  return {
    host,
    port,
    secure,
    from: fromName ? `"${fromName}" <${from}>` : from,
    fromName,
    auth: hasAuth ? { user, pass } : undefined,
  };
}

let cachedConfigKey = "";
let cachedTransporter: Transporter | null = null;

function buildConfigKey(config: SmtpConfig) {
  return [
    config.host,
    config.port,
    config.secure ? "secure" : "insecure",
    config.from,
    config.auth?.user ?? "",
  ].join("|");
}

function getTransporter(config: SmtpConfig) {
  const nextKey = buildConfigKey(config);
  if (!cachedTransporter || cachedConfigKey !== nextKey) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
    cachedConfigKey = nextKey;
  }

  return cachedTransporter;
}

function uniqueRecipients(recipients: string[]) {
  return Array.from(
    new Set(
      recipients
        .map((value) => normalizeEmail(value))
        .filter((value) => Boolean(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    )
  );
}

function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

export function isNotificationEmailConfigured() {
  return Boolean(readSmtpConfig());
}

export async function sendNotificationEmails(
  input: NotificationEmailSendInput
): Promise<NotificationEmailSendResult> {
  const config = readSmtpConfig();
  if (!config) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL (or SMTP_FROM)."
    );
  }

  const recipients = uniqueRecipients(input.recipients);
  if (recipients.length === 0) {
    return {
      sentAddresses: 0,
      failedAddresses: 0,
      failedEmailList: [],
    };
  }

  const transporter = getTransporter(config);
  const recipientBatches = chunk(recipients, 50);
  let sentAddresses = 0;
  let failedAddresses = 0;
  const failedEmailList: string[] = [];

  for (const batch of recipientBatches) {
    try {
      await transporter.sendMail({
        from: config.from,
        bcc: batch,
        subject: collapseSpaces(input.subject).slice(0, 220),
        text: String(input.text ?? "").trim(),
        html: String(input.html ?? "").trim(),
      });
      sentAddresses += batch.length;
    } catch {
      failedAddresses += batch.length;
      failedEmailList.push(...batch);
    }
  }

  return {
    sentAddresses,
    failedAddresses,
    failedEmailList,
  };
}
