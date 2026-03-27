/** Shared limits for community posts and drafts (composer / #create-post). */
export const COMMUNITY_POST_BODY_LIMITS = {
  titleMax: 200,
  descriptionMax: 20_000,
  authorDisplayNameMax: 50,
  maxTags: 20,
  tagMaxLength: 40,
  maxAttachments: 10,
  attachmentUrlMaxLength: 2048,
} as const;

export function dedupeStringsPreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

type ValidateContentInput = {
  title: string;
  description: string;
  tags: string[];
  attachments: string[];
  /** When set (e.g. published posts), enforced to match CommunityPost.authorDisplayName */
  authorDisplayName?: string;
};

export function validateCommunityPostLikeContent(
  params: ValidateContentInput
): { ok: true } | { ok: false; error: string } {
  if (params.title.length > COMMUNITY_POST_BODY_LIMITS.titleMax) {
    return {
      ok: false,
      error: `Title must be at most ${COMMUNITY_POST_BODY_LIMITS.titleMax} characters`,
    };
  }
  if (params.description.length > COMMUNITY_POST_BODY_LIMITS.descriptionMax) {
    return {
      ok: false,
      error: `Description must be at most ${COMMUNITY_POST_BODY_LIMITS.descriptionMax} characters`,
    };
  }

  if (params.authorDisplayName !== undefined) {
    if (params.authorDisplayName.length > COMMUNITY_POST_BODY_LIMITS.authorDisplayNameMax) {
      return {
        ok: false,
        error: `Display name must be at most ${COMMUNITY_POST_BODY_LIMITS.authorDisplayNameMax} characters`,
      };
    }
  }

  if (params.tags.length > COMMUNITY_POST_BODY_LIMITS.maxTags) {
    return {
      ok: false,
      error: `At most ${COMMUNITY_POST_BODY_LIMITS.maxTags} tags allowed`,
    };
  }
  for (const tag of params.tags) {
    if (tag.length > COMMUNITY_POST_BODY_LIMITS.tagMaxLength) {
      return {
        ok: false,
        error: `Each tag must be at most ${COMMUNITY_POST_BODY_LIMITS.tagMaxLength} characters`,
      };
    }
  }

  if (params.attachments.length > COMMUNITY_POST_BODY_LIMITS.maxAttachments) {
    return {
      ok: false,
      error: `At most ${COMMUNITY_POST_BODY_LIMITS.maxAttachments} attachments allowed`,
    };
  }
  for (const url of params.attachments) {
    if (url.length > COMMUNITY_POST_BODY_LIMITS.attachmentUrlMaxLength) {
      return { ok: false, error: "Each attachment link must be shorter" };
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "Attachments must be http or https links" };
      }
    } catch {
      return { ok: false, error: "Each attachment must be a valid URL" };
    }
  }

  return { ok: true };
}
