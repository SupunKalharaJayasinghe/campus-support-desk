import { COMMUNITY_POST_BODY_LIMITS } from "@/lib/validate-community-post-body";
import { getPostTextQualityError } from "@/lib/post-text-quality";
import {
    isTrivialRepeatingPan,
    parseCardExpiry,
} from "@/lib/community-urgent-card-payment-utils";

/** Display format: four groups of four digits, single spaces (e.g. 4111 1111 1111 1111). */
const URGENT_CARD_DISPLAY_PATTERN = /^\d{4} \d{4} \d{4} \d{4}$/;

export function getUrgentCardNumberFormatError(cardNumber: string): string | null {
    const t = cardNumber.trim();
    if (!t) {
        return "Enter the card number as four groups of four digits (e.g. 4111 1111 1111 1111).";
    }
    if (!URGENT_CARD_DISPLAY_PATTERN.test(t)) {
        return "Card number must look like 4111 1111 1111 1111 — spaces only between the four groups.";
    }
    const digits = t.replace(/\s/g, "");
    if (isTrivialRepeatingPan(digits)) {
        return "That number repeats the same digit group (for example 2323… or 1111…). Enter a more varied 16-digit card number.";
    }
    return null;
}

export function getUrgentCardExpiryDisplayError(expiry: string): string | null {
    const t = expiry.trim().replace(/\s+/g, "");
    if (!t) {
        return "Enter expiry as MM/YY (e.g. 12/28).";
    }
    if (!/^\d{2}\/\d{2}$/.test(t)) {
        return "Expiry must use MM/YY (two digits, slash, two digits).";
    }
    const parsed = parseCardExpiry(t);
    if (!parsed) {
        return "Expiry must be a valid month/year in the future.";
    }
    return null;
}

export function getUrgentCardCvcThreeDigitsError(cvc: string): string | null {
    const t = cvc.replace(/\s+/g, "");
    if (!t) {
        return "Enter the 3-digit CVC.";
    }
    if (!/^\d{3}$/.test(t)) {
        return "CVC must be exactly 3 digits.";
    }
    return null;
}

/**
 * When urgent + card: require valid formatted fields unless payment is already on file and all fields are empty.
 */
export function getUrgentComposerCardFieldsError(input: {
    cardNumber: string;
    cardExpiry: string;
    cardCvc: string;
    hasCardPaymentOnFile: boolean;
}): string | null {
    const n = input.cardNumber.trim();
    const e = input.cardExpiry.trim();
    const c = input.cardCvc.trim();
    const anyFilled = Boolean(n || e || c);
    if (!anyFilled && input.hasCardPaymentOnFile) {
        return null;
    }
    if (!anyFilled && !input.hasCardPaymentOnFile) {
        return "Enter card number (4111 1111 1111 1111), MM/YY, and 3-digit CVC to save.";
    }
    return (
        getUrgentCardNumberFormatError(n) ||
        getUrgentCardExpiryDisplayError(e) ||
        getUrgentCardCvcThreeDigitsError(c)
    );
}

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
