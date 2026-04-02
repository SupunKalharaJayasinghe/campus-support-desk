function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function getPostTextQualityError(value: string): string | null {
  const text = collapseWhitespace(value);
  if (!text) {
    return null;
  }

  const compact = text.replace(/\s+/g, "");
  if (compact.length < 3) {
    return "Please add a little more detail.";
  }

  if (/^(.)\1{5,}$/u.test(compact)) {
    return "Please avoid repeated characters only.";
  }

  if (!/[A-Za-z0-9]/u.test(text)) {
    return "Please enter meaningful text.";
  }

  return null;
}
