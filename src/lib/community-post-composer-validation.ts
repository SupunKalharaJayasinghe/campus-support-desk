import { COMMUNITY_POST_BODY_LIMITS } from "@/lib/validate-community-post-body";
import { getPostTextQualityError } from "@/lib/post-text-quality";

export function isValidCommunityTag(raw: string): boolean {
    const t = raw.trim();
    return t.startsWith("#") && t.slice(1).trim().length > 0;
}

export function getComposerTitleError(
    title: string,
    showRequiredIfEmpty: boolean
): string | null {
    const t = title.trim();
    if (!t) return showRequiredIfEmpty ? "Title is required." : null;
    const quality = getPostTextQualityError(title);
    if (quality) return quality;
    if (t.length > COMMUNITY_POST_BODY_LIMITS.titleMax) {
        return `Title must be at most ${COMMUNITY_POST_BODY_LIMITS.titleMax} characters.`;
    }
    return null;
}

export function getComposerDescriptionError(
    description: string,
    showRequiredIfEmpty: boolean
): string | null {
    const t = description.trim();
    if (!t) return showRequiredIfEmpty ? "Details are required." : null;
    const quality = getPostTextQualityError(description);
    if (quality) return quality;
    if (t.length > COMMUNITY_POST_BODY_LIMITS.descriptionMax) {
        return `Details must be at most ${COMMUNITY_POST_BODY_LIMITS.descriptionMax.toLocaleString()} characters.`;
    }
    return null;
}

export function getComposerTagsError(tags: string[]): string | null {
    if (tags.length > COMMUNITY_POST_BODY_LIMITS.maxTags) {
        return `At most ${COMMUNITY_POST_BODY_LIMITS.maxTags} tags allowed.`;
    }
    for (const tag of tags) {
        if (!isValidCommunityTag(tag)) {
            return "Every tag must start with # and include text after it (e.g. #study).";
        }
        if (tag.length > COMMUNITY_POST_BODY_LIMITS.tagMaxLength) {
            return `Each tag must be at most ${COMMUNITY_POST_BODY_LIMITS.tagMaxLength} characters.`;
        }
    }
    return null;
}

/** Validates one attachment URL string (trimmed). */
export function getSingleAttachmentUrlError(url: string): string | null {
    const t = url.trim();
    if (!t) return null;
    if (t.length > COMMUNITY_POST_BODY_LIMITS.attachmentUrlMaxLength) {
        return "That link is too long.";
    }
    try {
        const parsed = new URL(t);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return "Use an http or https link.";
        }
    } catch {
        return "Enter a valid URL (e.g. https://…).";
    }
    return null;
}

export function getComposerAttachmentsError(attachments: string[]): string | null {
    if (attachments.length > COMMUNITY_POST_BODY_LIMITS.maxAttachments) {
        return `At most ${COMMUNITY_POST_BODY_LIMITS.maxAttachments} attachment links allowed.`;
    }
    for (const url of attachments) {
        const err = getSingleAttachmentUrlError(url);
        if (err) return err;
    }
    return null;
}

/** Strict check for enabling Post / Save (no “attempted” flag). */
export function isCommunityPostComposerValid(input: {
    title: string;
    description: string;
    tags: string[];
    attachments: string[];
}): boolean {
    return (
        !getComposerTitleError(input.title, true) &&
        !getComposerDescriptionError(input.description, true) &&
        !getComposerTagsError(input.tags) &&
        !getComposerAttachmentsError(input.attachments)
    );
}
