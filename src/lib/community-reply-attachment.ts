import { COMMUNITY_POST_PICTURE_MAX_CHARS } from "@/lib/community-post-picture";

export type ReplyAttachmentNormalizeResult =
  | { ok: true; value: string | undefined }
  | { ok: false; error: string };

function isAllowedReplyAttachmentUrl(trimmed: string): boolean {
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return true;
  }
  if (!trimmed.startsWith("data:")) {
    return false;
  }
  const semi = trimmed.indexOf(";");
  const comma = trimmed.indexOf(",");
  if (semi === -1 || comma === -1 || comma < semi) {
    return false;
  }
  const mime = trimmed.slice(5, semi).toLowerCase();
  return (
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime.startsWith("application/vnd.openxmlformats-officedocument") ||
    mime === "text/plain"
  );
}

/**
 * Optional reply document: https link or data URL (image, PDF, Word, plain text).
 */
export function normalizeOptionalReplyAttachmentUrl(
  raw: unknown
): ReplyAttachmentNormalizeResult {
  if (raw === undefined || raw === null) {
    return { ok: true, value: undefined };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Attachment must be a string" };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }
  if (trimmed.length > COMMUNITY_POST_PICTURE_MAX_CHARS) {
    return {
      ok: false,
      error: "Attachment is too large. Use a smaller file or a document link.",
    };
  }
  if (!isAllowedReplyAttachmentUrl(trimmed)) {
    return {
      ok: false,
      error:
        "Attachment must be an http(s) link or an uploaded document (PDF, image, Word, or text).",
    };
  }
  return { ok: true, value: trimmed };
}

const ATTACHMENT_NAME_MAX = 200;

export function normalizeReplyAttachmentName(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().slice(0, ATTACHMENT_NAME_MAX);
  return t || undefined;
}
