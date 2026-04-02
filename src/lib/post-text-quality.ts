const REPETITIVE_TEXT_MIN_LENGTH = 8;
const REPETITIVE_TEXT_MAX_UNIQUE_CHARS = 2;

export function getPostTextQualityError(input: string): string | null {
  const text = input.trim();
  if (!text) {
    return null;
  }

  if (!/[A-Za-z0-9]/.test(text)) {
    return "Add some meaningful text instead of symbols only.";
  }

  const normalized = text.toLowerCase().replace(/\s+/g, "");
  if (!normalized) {
    return null;
  }

  if (
    normalized.length >= REPETITIVE_TEXT_MIN_LENGTH &&
    new Set(normalized).size <= REPETITIVE_TEXT_MAX_UNIQUE_CHARS
  ) {
    return "Text looks too repetitive. Add a bit more detail.";
  }

  return null;
}
