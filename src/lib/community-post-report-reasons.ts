export const COMMUNITY_POST_REPORT_REASONS = [
    { key: "spam", label: "Spam or misleading" },
    { key: "harassment", label: "Harassment or hate" },
    { key: "misinformation", label: "False or harmful information" },
    { key: "inappropriate", label: "Inappropriate content" },
    { key: "copyright", label: "Copyright or intellectual property" },
    { key: "other", label: "Other" },
] as const;

export type CommunityPostReportReasonKey = (typeof COMMUNITY_POST_REPORT_REASONS)[number]["key"];

const REASON_KEY_SET = new Set<string>(COMMUNITY_POST_REPORT_REASONS.map((r) => r.key));

export function isCommunityPostReportReasonKey(value: string): value is CommunityPostReportReasonKey {
    return REASON_KEY_SET.has(value);
}

export function getReportReasonLabel(key: CommunityPostReportReasonKey): string {
    const row = COMMUNITY_POST_REPORT_REASONS.find((r) => r.key === key);
    return row?.label ?? key;
}

/** Full text stored on the report and shown to moderators. */
export function buildStoredReportReason(reasonKey: CommunityPostReportReasonKey, details?: string): string {
    if (reasonKey === "other") {
        const trimmed = (details ?? "").trim();
        return trimmed.length > 0 ? `Other: ${trimmed}` : "";
    }
    return getReportReasonLabel(reasonKey);
}
