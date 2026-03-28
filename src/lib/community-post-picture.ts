/** Upper bound for stored picture payload (data URLs or URLs). ~2.5M chars. */
export const COMMUNITY_POST_PICTURE_MAX_CHARS = 2_500_000;

export type PictureNormalizeResult =
  | { ok: true; value: string | undefined }
  | { ok: false; error: string };

export function normalizeOptionalPictureUrl(raw: unknown): PictureNormalizeResult {
  if (raw === undefined || raw === null) {
    return { ok: true, value: undefined };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "pictureUrl must be a string" };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }
  if (trimmed.length > COMMUNITY_POST_PICTURE_MAX_CHARS) {
    return {
      ok: false,
      error: "Image is too large. Use a smaller file or an image link (max ~2 MB).",
    };
  }
  const isDataImage = trimmed.startsWith("data:image/");
  const isHttp =
    trimmed.startsWith("https://") || trimmed.startsWith("http://");
  if (!isDataImage && !isHttp) {
    return {
      ok: false,
      error: "pictureUrl must be an http(s) link or an uploaded image",
    };
  }
  return { ok: true, value: trimmed };
}
