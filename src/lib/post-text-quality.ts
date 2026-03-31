/** Lightweight heuristic checks for obviously low-quality post text.
 *
 * Returns a human-readable error message when the text should be improved,
 * or null when it looks acceptable.
 */
export function getPostTextQualityError(text: string): string | null {
  const value = String(text ?? "").trim();
  if (!value) {
    return null;
  }

  // Very short content is usually not helpful.
  if (value.length < 5) {
    return "Please add a bit more detail.";
  }

  // Detect content made of a single repeated character (e.g. "aaaaaa", "??????").
  const uniqueChars = new Set(value.replace(/\s+/g, "").split(""));
  if (uniqueChars.size === 1 && value.length >= 10) {
    return "Please describe your post in clearer words.";
  }

  // Excessive punctuation like "!!!!!????" without enough real words.
  const lettersCount = (value.match(/[A-Za-z]/g) || []).length;
  const punctuationCount = (value.match(/[!?.,]/g) || []).length;
  if (lettersCount > 0 && punctuationCount > lettersCount * 3) {
    return "Please reduce excessive punctuation and clarify your message.";
  }

  return null;
}

