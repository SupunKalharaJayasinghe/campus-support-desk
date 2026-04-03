"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Paperclip, Plus, Send, Tag, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { readStoredUser } from "@/lib/rbac";
import { readCommunityProfileSettings } from "@/lib/community-profile";
import { getUrgentConfig, URGENT_LEVELS, type UrgentLevel, type UrgentPaymentMethod } from "@/lib/community-urgent";
import { COMMUNITY_POST_BODY_LIMITS } from "@/lib/validate-community-post-body";
import {
    getComposerAttachmentsError,
    getComposerDescriptionError,
    getComposerTagsError,
    getComposerTitleError,
    getSingleAttachmentUrlError,
    getUrgentComposerCardFieldsError,
    isCommunityPostComposerValid,
    isValidCommunityTag,
} from "@/lib/community-post-composer-validation";
import UrgentPaymentDoneDialog from "@/components/community/UrgentPaymentDoneDialog";
import { COMMUNITY_URGENT_CARD_PAYMENT_DONE_SESSION_KEY } from "@/lib/community-urgent-payment-done-ui";

const MAX_IMAGE_FILE_BYTES = 2 * 1024 * 1024;

const CATEGORY_OPTIONS = [
    { label: "Lost Item", value: "lost_item" },
    { label: "Study Material", value: "study_material" },
    { label: "Academic Question", value: "academic_question" },
];

function cn(...classes: Array<string | undefined | false>) {
    return classes.filter(Boolean).join(" ");
}

/** Keeps urgent card input as "NNNN NNNN NNNN NNNN" (max 16 digits). */
function formatUrgentCardDisplayInput(value: string): string {
    const d = value.replace(/\D/g, "").slice(0, 16);
    const parts: string[] = [];
    for (let i = 0; i < d.length; i += 4) {
        parts.push(d.slice(i, i + 4));
    }
    return parts.join(" ");
}

/** Normalizes expiry to MM/YY as the user types. */
function formatUrgentExpiryInput(value: string): string {
    const d = value.replace(/\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export type CommunityPostComposerProps = {
    className?: string;
    /** Tighter header when embedded on profile */
    compact?: boolean;
    resetAfterDraftSave?: boolean;
    draftToEdit?: CommunityPostDraft | null;
    onDraftSaved?: (
        draft: CommunityPostDraftInput
    ) => Promise<CommunityPostDraft | null> | CommunityPostDraft | null;
    onDraftDeleted?: (draftId: string) => void;
    /** Called when user cancels editing — clears form without deleting the draft in storage */
    onDraftEditCancel?: () => void;
    onPostSuccess?: (draftId?: string) => void;
    /**
     * When set with `onDraftSaved`, shows **Done** on the urgent panel: saves the draft to the DB
     * then navigates. Use `#section-id` to smooth-scroll on the current page, or a path like
     * `/community/profile#draft-posts` to open the drafts area after saving.
     */
    urgentDoneNavigatesTo?: string;
};

export type CommunityPostDraftInput = {
    id?: string;
    title: string;
    description: string;
    category: "lost_item" | "study_material" | "academic_question";
    tags: string[];
    attachments: string[];
    pictureUrl?: string;
    status: "open" | "resolved";
    isUrgent: boolean;
    urgentLevel: UrgentLevel | null;
    urgentPaymentMethod: UrgentPaymentMethod | null;
    urgentCardLast4?: string;
    urgentPrepayId?: string | null;
};

export type CommunityPostDraft = {
    id: string;
    title: string;
    description: string;
    category: "lost_item" | "study_material" | "academic_question";
    tags: string[];
    attachments: string[];
    pictureUrl: string;
    status: "open" | "resolved";
    isUrgent: boolean;
    urgentLevel: UrgentLevel | null;
    urgentFeePoints?: number | null;
    /** INR urgent fee when draft was saved with card payment (server-stored). */
    urgentFeeRs?: number | null;
    urgentPaymentMethod: UrgentPaymentMethod | null;
    urgentPrepayId?: string | null;
    /** Last 4 digits when draft was saved with urgent + card (used when posting without re-entering the full number). */
    urgentCardLast4?: string | null;
    /** Linked CommunityUrgentCardPayment row after full card checkout is recorded. */
    urgentCardPaymentRecordId?: string | null;
    createdAt: string;
    updatedAt: string;
};

export default function CommunityPostComposer({
    className,
    compact,
    resetAfterDraftSave,
    draftToEdit,
    onDraftSaved,
    onDraftDeleted,
    onDraftEditCancel,
    onPostSuccess,
    urgentDoneNavigatesTo,
}: CommunityPostComposerProps) {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("study_material");
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [tagError, setTagError] = useState("");
    const [attachments, setAttachments] = useState<string[]>([]);
    const [attachmentInput, setAttachmentInput] = useState("");
    const [pictureUrl, setPictureUrl] = useState("");
    const [pictureError, setPictureError] = useState("");
    const pictureInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<"open" | "resolved">("open");
    const [draftId, setDraftId] = useState<string | null>(null);

    const [isUrgent, setIsUrgent] = useState(false);
    const [urgentLevel, setUrgentLevel] = useState<UrgentLevel>("2days");
    const [urgentPaymentMethod, setUrgentPaymentMethod] = useState<UrgentPaymentMethod>("points");
    const urgentCfg = getUrgentConfig(urgentLevel);

    const [communityPoints, setCommunityPoints] = useState<number | null>(null);
    const [pointsLoading, setPointsLoading] = useState(false);
    const [pointsError, setPointsError] = useState("");

    const [cardNumber, setCardNumber] = useState("");
    const [cardExpiry, setCardExpiry] = useState("");
    const [cardCvc, setCardCvc] = useState("");
    const [cardError, setCardError] = useState("");
    /** From server when editing a draft saved with card — allows posting without re-entering full PAN. */
    const [urgentCardLast4FromDraft, setUrgentCardLast4FromDraft] = useState<string | null>(null);
    const [urgentCardPaymentRecordId, setUrgentCardPaymentRecordId] = useState<string | null>(null);

    const [isDraftSaved, setIsDraftSaved] = useState(false);

    /** Set after successful Pay — must be sent when posting urgent + points (points deducted at Pay). */
    const [urgentPrepayId, setUrgentPrepayId] = useState<string | null>(null);
    const [payingUrgent, setPayingUrgent] = useState(false);
    const [payError, setPayError] = useState("");
    const [urgentDoneBusy, setUrgentDoneBusy] = useState(false);
    const urgentPrepayIdRef = useRef<string | null>(null);
    urgentPrepayIdRef.current = urgentPrepayId;

    /** After points or card payment is tied to this draft, urgent cannot change (non-refundable). */
    const urgentSectionLocked = useMemo(() => {
        if (!isUrgent) return false;
        if (urgentCardPaymentRecordId) return true;
        if (urgentPrepayId) return true;
        if (draftToEdit?.urgentCardPaymentRecordId) return true;
        if (draftToEdit?.urgentPrepayId) return true;
        return false;
    }, [
        isUrgent,
        urgentCardPaymentRecordId,
        urgentPrepayId,
        draftToEdit?.urgentCardPaymentRecordId,
        draftToEdit?.urgentPrepayId,
    ]);

    /**
     * Update draft modal: urgent tier and payment method are fixed once the draft was saved as urgent
     * (user can still complete points/card payment if not yet paid).
     */
    const urgentPlanLockedOnDraftUpdate = Boolean(draftToEdit?.id && draftToEdit.isUrgent);

    const urgentCoreControlsDisabled = urgentSectionLocked || urgentPlanLockedOnDraftUpdate;
    /** After a draft is saved as urgent, payment method and card details cannot be changed (one-time choice). */
    const urgentCardFieldsLocked = urgentSectionLocked || urgentPlanLockedOnDraftUpdate;

    /** Draft + state: used so Pay label/disabled/handler stay in sync (avoids “Pay” showing while disabled). */
    const pointsFeeReserved = Boolean(
        urgentPrepayId || (draftToEdit?.urgentPrepayId && String(draftToEdit.urgentPrepayId).length > 0)
    );
    /** Card fee already captured: pending payment row and/or draft shows last4 + card method. */
    const cardUrgentPaymentActive = Boolean(
        urgentCardPaymentRecordId ||
            (draftToEdit?.urgentCardPaymentRecordId &&
                String(draftToEdit.urgentCardPaymentRecordId).length > 0) ||
            (Boolean(draftToEdit?.isUrgent) &&
                draftToEdit?.urgentPaymentMethod === "card" &&
                typeof draftToEdit?.urgentCardLast4 === "string" &&
                /^\d{4}$/.test(draftToEdit.urgentCardLast4))
    );

    /** Same non-refundable Done acknowledgement as card, once per points prepay id. */
    const pointsNonRefundAckPrepayIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!urgentPrepayId) {
            pointsNonRefundAckPrepayIdRef.current = null;
        }
    }, [urgentPrepayId]);

    const cancelUrgentPrepay = useCallback(async () => {
        const id = urgentPrepayIdRef.current;
        if (!id) return;
        const storedUser = readStoredUser();
        if (!storedUser?.id) {
            setUrgentPrepayId(null);
            return;
        }
        try {
            const res = await fetch("/api/community-urgent-prepay/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: storedUser.id,
                    username: storedUser.username ?? "",
                    email: storedUser.email ?? "",
                    name: storedUser.name ?? "",
                    prepayId: id,
                }),
            });
            const data = (await res.json().catch(() => null)) as
                | { newPoints?: number }
                | null;
            if (res.ok && typeof data?.newPoints === "number" && Number.isFinite(data.newPoints)) {
                setCommunityPoints(data.newPoints);
            }
        } catch {
            // ignore
        } finally {
            setUrgentPrepayId(null);
        }
    }, []);

    /** Refresh points after a successful Post (server awards +2 on publish). */
    const refreshCommunityPointsFromServer = useCallback(async () => {
        const userId = readStoredUser()?.id;
        if (!userId) return;
        try {
            const res = await fetch(
                `/api/community-profile?userId=${encodeURIComponent(userId)}`
            );
            const body = (await res.json().catch(() => null)) as
                | { points?: number; message?: string }
                | null;
            if (res.status === 404) {
                setCommunityPoints(0);
                setPointsError("");
                return;
            }
            if (!res.ok) return;
            const pts = Number(body?.points);
            if (Number.isFinite(pts)) {
                setCommunityPoints(pts);
                setPointsError("");
            }
        } catch {
            // leave existing points on screen
        }
    }, []);

    useEffect(() => {
        // Load current community points for payment choice UX.
        const user = readStoredUser();
        const userId = user?.id;
        if (!userId) {
            setCommunityPoints(null);
            return;
        }
        let cancelled = false;
        setPointsLoading(true);
        setPointsError("");
        fetch(`/api/community-profile?userId=${encodeURIComponent(userId)}`)
            .then(async (res) => {
                const body = (await res.json().catch(() => null)) as { points?: number; message?: string } | null;
                // No CommunityProfile document yet — treat as 0 points (same as new users).
                if (res.status === 404) {
                    if (!cancelled) {
                        setCommunityPoints(0);
                        setPointsError("");
                    }
                    return;
                }
                if (!res.ok) throw new Error(body?.message || "Failed to load points");
                const pts = Number(body?.points);
                if (!cancelled) setCommunityPoints(Number.isFinite(pts) ? pts : 0);
            })
            .catch((err) => {
                if (!cancelled) {
                    setCommunityPoints(null);
                    setPointsError(err instanceof Error ? err.message : "Failed to load points");
                }
            })
            .finally(() => {
                if (!cancelled) setPointsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useLayoutEffect(() => {
        if (!draftToEdit) return;
        setDraftId(draftToEdit.id);
        setTitle(draftToEdit.title);
        setDescription(draftToEdit.description);
        setCategory(draftToEdit.category);
        setTags(draftToEdit.tags);
        setTagInput("");
        setTagError("");
        setAttachments(draftToEdit.attachments);
        setAttachmentInput("");
        setPictureUrl(
            typeof draftToEdit.pictureUrl === "string"
                ? draftToEdit.pictureUrl
                : ""
        );
        setPictureError("");
        setStatus(draftToEdit.status);
        setIsUrgent(Boolean(draftToEdit.isUrgent));
        setUrgentLevel(draftToEdit.urgentLevel ?? "2days");
        setUrgentPaymentMethod(draftToEdit.urgentPaymentMethod ?? "points");
        setUrgentPrepayId(draftToEdit.urgentPrepayId ?? null);
        const dLast4 = draftToEdit.urgentCardLast4;
        setUrgentCardLast4FromDraft(
            typeof dLast4 === "string" && /^\d{4}$/.test(dLast4) ? dLast4 : null
        );
        setUrgentCardPaymentRecordId(draftToEdit.urgentCardPaymentRecordId ?? null);
        setCardNumber("");
        setCardExpiry("");
        setCardCvc("");
        setCardError("");
        setIsDraftSaved(true);
        setSubmitError("");
        setValidationAttempted(false);
        setAttachmentInputError("");
        setPayError("");
    }, [
        draftToEdit,
        draftToEdit?.id,
        draftToEdit?.updatedAt,
        draftToEdit?.pictureUrl,
    ]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [postConfirmOpen, setPostConfirmOpen] = useState(false);
    const [urgentNonRefundableOpen, setUrgentNonRefundableOpen] = useState(false);
    const [urgentPaymentDoneDialogOpen, setUrgentPaymentDoneDialogOpen] = useState(false);
    const afterUrgentPaymentAckRef = useRef<(() => void) | null>(null);
    /** After Save/Post click, show required-field and full client-side validation messages. */
    const [validationAttempted, setValidationAttempted] = useState(false);
    const [attachmentInputError, setAttachmentInputError] = useState("");

    const dismissUrgentPaymentDoneDialog = useCallback(() => {
        setUrgentPaymentDoneDialogOpen(false);
        try {
            sessionStorage.removeItem(COMMUNITY_URGENT_CARD_PAYMENT_DONE_SESSION_KEY);
        } catch {
            // ignore
        }
        const fn = afterUrgentPaymentAckRef.current;
        afterUrgentPaymentAckRef.current = null;
        fn?.();
    }, []);

    const addTag = () => {
        const trimmed = tagInput.trim();
        if (!trimmed) {
            setTagInput("");
            return;
        }
        if (tags.length >= COMMUNITY_POST_BODY_LIMITS.maxTags) {
            setTagError(`At most ${COMMUNITY_POST_BODY_LIMITS.maxTags} tags allowed.`);
            return;
        }
        if (trimmed.length > COMMUNITY_POST_BODY_LIMITS.tagMaxLength) {
            setTagError(`Each tag must be at most ${COMMUNITY_POST_BODY_LIMITS.tagMaxLength} characters.`);
            return;
        }
        if (!isValidCommunityTag(trimmed)) {
            setTagError("Each tag must start with # and include text after it (e.g. #study).");
            return;
        }
        if (tags.includes(trimmed)) {
            setTagError("That tag is already added.");
            return;
        }
        setTagError("");
        setTags((prev) => [...prev, trimmed]);
        setIsDraftSaved(false);
        setTagInput("");
    };

    const removeTag = (tag: string) => {
        setTags((prev) => prev.filter((t) => t !== tag));
        setTagError("");
        setIsDraftSaved(false);
    };

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTag();
        }
    };

    const addAttachment = () => {
        const trimmed = attachmentInput.trim();
        if (!trimmed) {
            setAttachmentInput("");
            return;
        }
        if (attachments.length >= COMMUNITY_POST_BODY_LIMITS.maxAttachments) {
            setAttachmentInputError(
                `At most ${COMMUNITY_POST_BODY_LIMITS.maxAttachments} attachment links allowed.`
            );
            return;
        }
        const urlErr = getSingleAttachmentUrlError(trimmed);
        if (urlErr) {
            setAttachmentInputError(urlErr);
            return;
        }
        if (attachments.includes(trimmed)) {
            setAttachmentInput("");
            setAttachmentInputError("");
            return;
        }
        setAttachmentInputError("");
        setAttachments((prev) => [...prev, trimmed]);
        setIsDraftSaved(false);
        setAttachmentInput("");
    };

    const removeAttachment = (url: string) => {
        setAttachments((prev) => prev.filter((a) => a !== url));
        setAttachmentInputError("");
        setIsDraftSaved(false);
    };

    const handlePictureSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setPictureError("");
        if (!file.type.startsWith("image/")) {
            setPictureError("Please choose an image file.");
            return;
        }
        if (file.size > MAX_IMAGE_FILE_BYTES) {
            setPictureError("Image must be 2 MB or smaller.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === "string") {
                setPictureUrl(result);
                setIsDraftSaved(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const clearPicture = () => {
        setPictureUrl("");
        setPictureError("");
        setIsDraftSaved(false);
    };

    const handleAttachmentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addAttachment();
        }
    };

    const handleSaveDraft = async (opts?: { rethrow?: boolean }): Promise<boolean> => {
        if (!isCommunityPostComposerValid({ title, description, tags, attachments })) {
            if (opts?.rethrow) {
                throw new Error("Add a title and details (and fix any tag/link errors) before saving.");
            }
            return false;
        }

        if (isUrgent && urgentPaymentMethod === "card") {
            const cardFieldErr = getUrgentComposerCardFieldsError({
                cardNumber,
                cardExpiry,
                cardCvc,
                hasCardPaymentOnFile: cardUrgentPaymentActive,
            });
            if (cardFieldErr) {
                setCardError(cardFieldErr);
                if (opts?.rethrow) {
                    throw new Error(cardFieldErr);
                }
                return false;
            }
        }

        const nextDraft: CommunityPostDraftInput = {
            id: draftId ?? undefined,
            title: title.trim(),
            description: description.trim(),
            category: category as CommunityPostDraft["category"],
            tags,
            attachments,
            pictureUrl: pictureUrl.trim() || undefined,
            status,
            isUrgent,
            urgentLevel: isUrgent ? urgentLevel : null,
            urgentPaymentMethod: isUrgent ? urgentPaymentMethod : null,
            urgentCardLast4:
                isUrgent && urgentPaymentMethod === "card"
                    ? (() => {
                          const fromInput = cardNumber.replace(/\s+/g, "").slice(-4);
                          if (/^\d{4}$/.test(fromInput)) return fromInput;
                          if (urgentCardLast4FromDraft && /^\d{4}$/.test(urgentCardLast4FromDraft)) {
                              return urgentCardLast4FromDraft;
                          }
                          return undefined;
                      })()
                    : undefined,
            urgentPrepayId:
                isUrgent && urgentPaymentMethod === "points"
                    ? urgentPrepayIdRef.current
                    : null,
        };

        let savedDraft: CommunityPostDraft | null = null;
        try {
            savedDraft = (await onDraftSaved?.(nextDraft)) ?? null;
        } catch (e) {
            if (opts?.rethrow) throw e;
            return false;
        }

        if (onDraftSaved && !savedDraft?.id) {
            if (opts?.rethrow) {
                throw new Error("Draft did not save. Try again or check that you are logged in.");
            }
            return false;
        }

        if (savedDraft?.id) {
            setDraftId(savedDraft.id);
        }
        if (savedDraft?.urgentPrepayId) {
            setUrgentPrepayId(String(savedDraft.urgentPrepayId));
        }
        if (savedDraft?.urgentCardPaymentRecordId) {
            setUrgentCardPaymentRecordId(String(savedDraft.urgentCardPaymentRecordId));
        }
        const sLast4 = savedDraft?.urgentCardLast4;
        if (typeof sLast4 === "string" && /^\d{4}$/.test(sLast4)) {
            setUrgentCardLast4FromDraft(sLast4);
        }
        if (isUrgent && urgentPaymentMethod === "card" && savedDraft?.id) {
            const rawDigits = cardNumber.replace(/\s+/g, "");
            if (rawDigits.length === 16 && cardExpiry.trim() && cardCvc.trim()) {
                const storedUser = readStoredUser();
                const profileSettings = readCommunityProfileSettings();
                const displayName =
                    profileSettings.displayName.trim() ||
                    storedUser?.name?.trim() ||
                    "Current User";
                if (storedUser?.id) {
                    try {
                        const payRes = await fetch("/api/community-urgent-card-payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                userId: storedUser.id,
                                username: storedUser.username ?? "",
                                email: storedUser.email ?? "",
                                name: storedUser.name ?? displayName,
                                authorDisplayName: displayName,
                                draftId: savedDraft.id,
                                urgentLevel,
                                cardNumber: rawDigits,
                                cardExpiry: cardExpiry.trim(),
                                cardCvc: cardCvc.trim(),
                            }),
                        });
                        const payData = (await payRes.json().catch(() => null)) as
                            | { id?: string; error?: string }
                            | null;
                        if (!payRes.ok) {
                            throw new Error(payData?.error || "Could not save card payment details.");
                        }
                        if (payData?.id) {
                            setUrgentCardPaymentRecordId(String(payData.id));
                            try {
                                sessionStorage.setItem(
                                    COMMUNITY_URGENT_CARD_PAYMENT_DONE_SESSION_KEY,
                                    "1"
                                );
                            } catch {
                                // ignore
                            }
                            afterUrgentPaymentAckRef.current = null;
                            setUrgentPaymentDoneDialogOpen(true);
                        }
                    } catch (e) {
                        if (opts?.rethrow) throw e;
                        setSubmitError(
                            e instanceof Error ? e.message : "Could not save card payment details."
                        );
                        return false;
                    }
                }
            }
        }
        if (resetAfterDraftSave) {
            /** If the draft in MongoDB still holds a points prepay, do not cancel — that would refund and delete the prepay. */
            const prepayPersistedOnDraft =
                savedDraft?.urgentPaymentMethod === "points" &&
                Boolean(savedDraft?.urgentPrepayId);
            if (!prepayPersistedOnDraft) {
                void cancelUrgentPrepay();
            } else {
                setUrgentPrepayId(null);
            }
            setDraftId(null);
            setTitle("");
            setDescription("");
            setCategory("study_material");
            setTags([]);
            setTagInput("");
            setTagError("");
            setAttachments([]);
            setAttachmentInput("");
            setPictureUrl("");
            setPictureError("");
            setStatus("open");
            setIsUrgent(false);
            setUrgentLevel("2days");
            setUrgentPaymentMethod("points");
            setCardNumber("");
            setCardExpiry("");
            setCardCvc("");
            setCardError("");
            setUrgentCardLast4FromDraft(null);
            setUrgentCardPaymentRecordId(null);
            setIsDraftSaved(false);
            setSubmitError("");
            setValidationAttempted(false);
            setAttachmentInputError("");
            setPayError("");
            return true;
        }
        setIsDraftSaved(true);
        return true;
    };

    const goToDraftsAfterUrgentDone = () => {
        const target = urgentDoneNavigatesTo?.trim();
        if (!target) return;
        if (target.startsWith("#")) {
            const id = target.slice(1);
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }
        router.push(target);
    };

    const runUrgentDoneSaveAndNavigate = async () => {
        setUrgentDoneBusy(true);
        try {
            await handleSaveDraft({ rethrow: true });
            goToDraftsAfterUrgentDone();
        } catch (e) {
            setSubmitError(e instanceof Error ? e.message : "Could not save draft.");
        } finally {
            setUrgentDoneBusy(false);
        }
    };

    const handleUrgentDoneClick = async () => {
        if (!urgentDoneNavigatesTo?.trim() || !onDraftSaved) return;
        setValidationAttempted(true);
        setSubmitError("");
        setCardError("");
        if (!isCommunityPostComposerValid({ title, description, tags, attachments })) {
            setSubmitError("Add a title and details before finishing urgent setup.");
            return;
        }
        if (isUrgent && urgentPaymentMethod === "points" && !urgentPrepayId) {
            setSubmitError("Click Pay to deduct points for urgent, or choose card payment.");
            return;
        }
        if (isUrgent && urgentPaymentMethod === "points" && urgentPrepayId) {
            const prepayAlreadyOnDraft =
                Boolean(draftToEdit?.urgentPrepayId) &&
                String(draftToEdit.urgentPrepayId) === String(urgentPrepayId);
            if (
                !prepayAlreadyOnDraft &&
                pointsNonRefundAckPrepayIdRef.current !== urgentPrepayId
            ) {
                setUrgentNonRefundableOpen(true);
                return;
            }
        }
        if (isUrgent && urgentPaymentMethod === "card") {
            if (urgentSectionLocked) {
                await runUrgentDoneSaveAndNavigate();
                return;
            }
            const cardFieldErr = getUrgentComposerCardFieldsError({
                cardNumber,
                cardExpiry,
                cardCvc,
                hasCardPaymentOnFile: cardUrgentPaymentActive,
            });
            if (cardFieldErr) {
                setCardError(cardFieldErr);
                return;
            }
            setUrgentNonRefundableOpen(true);
            return;
        }

        await runUrgentDoneSaveAndNavigate();
    };

    const confirmUrgentDoneAfterNonRefundAck = async () => {
        if (urgentPaymentMethod === "points" && urgentPrepayId) {
            pointsNonRefundAckPrepayIdRef.current = urgentPrepayId;
        }
        setUrgentNonRefundableOpen(false);
        await runUrgentDoneSaveAndNavigate();
    };

    const handleComposerCancel = () => {
        void cancelUrgentPrepay();
        setUrgentNonRefundableOpen(false);
        setDraftId(null);
        setTitle("");
        setDescription("");
        setCategory("study_material");
        setTags([]);
        setTagInput("");
        setTagError("");
        setAttachments([]);
        setAttachmentInput("");
        setPictureUrl("");
        setPictureError("");
        setStatus("open");
        setIsUrgent(false);
        setUrgentLevel("2days");
        setUrgentPaymentMethod("points");
        setCardNumber("");
        setCardExpiry("");
        setCardCvc("");
        setCardError("");
        setUrgentCardLast4FromDraft(null);
        setUrgentCardPaymentRecordId(null);
        setIsDraftSaved(false);
        setSubmitError("");
        setValidationAttempted(false);
        setAttachmentInputError("");
        setPayError("");
        onDraftEditCancel?.();
    };

    const handleDeleteDraft = () => {
        if (draftId) {
            onDraftDeleted?.(draftId);
        }
        handleComposerCancel();
    };

    const titleFieldError = getComposerTitleError(title, validationAttempted);
    const descriptionFieldError = getComposerDescriptionError(description, validationAttempted);
    const tagsListError = getComposerTagsError(tags);
    const attachmentsListError = getComposerAttachmentsError(attachments);
    const isFormValid = isCommunityPostComposerValid({
        title,
        description,
        tags,
        attachments,
    });
    const saveDraftLabel = draftId ? "Update Draft" : "Save Draft";

    const requestSaveDraft = () => {
        setValidationAttempted(true);
        void handleSaveDraft();
    };

    const openPostConfirm = () => {
        setValidationAttempted(true);
        if (isSubmitting) return;
        if (!isCommunityPostComposerValid({ title, description, tags, attachments })) return;
        if (isUrgent && urgentPaymentMethod === "points" && !pointsFeeReserved) {
            // For existing drafts, user may have already paid (prepay exists) even if current balance is 0.
            // Don't block here; the server will validate/consume the prepay on publish.
            if (!draftToEdit?.id && communityPoints !== null && communityPoints < urgentCfg.feePoints) {
                setSubmitError(
                    "Not enough points for urgent — pay with card or use Pay after you have enough points."
                );
                return;
            }
        }
        if (isUrgent && urgentPaymentMethod === "card") {
            const postCardErr = getUrgentComposerCardFieldsError({
                cardNumber,
                cardExpiry,
                cardCvc,
                hasCardPaymentOnFile: cardUrgentPaymentActive,
            });
            if (postCardErr) {
                setSubmitError(postCardErr);
                setCardError(postCardErr);
                return;
            }
        }
        setPostConfirmOpen(true);
    };

    const handleUrgentPay = async () => {
        if (!isUrgent || urgentPaymentMethod !== "points") {
            if (isUrgent && urgentPaymentMethod !== "points") {
                setPayError("Choose points as the payment method to pay with points.");
            }
            return;
        }
        if (pointsFeeReserved) {
            return;
        }
        if (cardUrgentPaymentActive) {
            setPayError("This draft is set up for card urgent payment. You cannot pay with points.");
            return;
        }
        if (!title.trim() || !description.trim()) {
            setValidationAttempted(true);
            setPayError("Please fill Title and Details before paying.");
            return;
        }
        const storedUser = readStoredUser();
        if (!storedUser?.id) {
            setPayError("Log in to pay with points.");
            return;
        }
        if (communityPoints !== null && communityPoints < urgentCfg.feePoints) {
            setPayError("Not enough points for this fee.");
            return;
        }
        setPayingUrgent(true);
        setPayError("");
        try {
            const res = await fetch("/api/community-urgent-prepay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: storedUser.id,
                    username: storedUser.username ?? "",
                    email: storedUser.email ?? "",
                    name: storedUser.name ?? "",
                    urgentLevel,
                }),
            });
            const data = (await res.json().catch(() => null)) as
                | { error?: string; prepayId?: string; newPoints?: number }
                | null;
            if (!res.ok) {
                throw new Error(data?.error || "Payment failed.");
            }
            if (data?.prepayId) {
                const pid = String(data.prepayId);
                // Ensure the prepay id is immediately available for draft save in this same tick.
                urgentPrepayIdRef.current = pid;
                setUrgentPrepayId(pid);
            }
            if (typeof data?.newPoints === "number" && Number.isFinite(data.newPoints)) {
                setCommunityPoints(data.newPoints);
            }
            setIsDraftSaved(false);
            // After paying, persist draft so urgentPrepayId is stored in MongoDB (draft links to prepay).
            setValidationAttempted(true);
            const savedOk = await handleSaveDraft();
            if (!savedOk) {
                setPayError(
                    "Points were deducted. Click Save Draft or Done so your prepayment is stored on the draft."
                );
            }
        } catch (e) {
            setPayError(e instanceof Error ? e.message : "Payment failed.");
        } finally {
            setPayingUrgent(false);
        }
    };

    const executePost = async () => {
        if (!isCommunityPostComposerValid({ title, description, tags, attachments })) return;

        const storedUserEarly = readStoredUser();
        const clientRequestId = draftId ?? (globalThis.crypto?.randomUUID?.() ?? `post-${Date.now()}`);

        let urgentCardLast4Resolved: string | null = null;
        let urgentCardPaymentRecordIdOut: string | null =
            urgentCardPaymentRecordId ||
            (draftToEdit?.urgentCardPaymentRecordId
                ? String(draftToEdit.urgentCardPaymentRecordId)
                : null);
        let didSubmitFreshCardPayment = false;
        if (isUrgent && urgentPaymentMethod === "card") {
            const raw = cardNumber.replace(/\s+/g, "");
            const postCardErr = getUrgentComposerCardFieldsError({
                cardNumber,
                cardExpiry,
                cardCvc,
                hasCardPaymentOnFile: cardUrgentPaymentActive,
            });
            if (postCardErr) {
                setCardError(postCardErr);
                return;
            }
            if (raw.length === 16 && /^\d{4}$/.test(raw.slice(-4))) {
                urgentCardLast4Resolved = raw.slice(-4);
            } else if (urgentCardLast4FromDraft && /^\d{4}$/.test(urgentCardLast4FromDraft)) {
                urgentCardLast4Resolved = urgentCardLast4FromDraft;
            }
            if (!urgentCardLast4Resolved) {
                setCardError(
                    "Enter the full card number (2434 2424 2424 2424), or use the card already saved on this draft."
                );
                return;
            }
            if (raw.length === 16 && cardExpiry.trim() && cardCvc.trim()) {
                if (!storedUserEarly?.id) {
                    setCardError("Log in to complete card payment.");
                    return;
                }
                const profileSettings = readCommunityProfileSettings();
                const displayName =
                    profileSettings.displayName.trim() ||
                    storedUserEarly.name?.trim() ||
                    "Current User";
                const payRes = await fetch("/api/community-urgent-card-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: storedUserEarly.id,
                        username: storedUserEarly.username ?? "",
                        email: storedUserEarly.email ?? "",
                        name: storedUserEarly.name ?? displayName,
                        authorDisplayName: displayName,
                        draftId: draftId ?? undefined,
                        urgentLevel,
                        cardNumber: raw,
                        cardExpiry: cardExpiry.trim(),
                        cardCvc: cardCvc.trim(),
                    }),
                });
                const payData = (await payRes.json().catch(() => null)) as
                    | { id?: string; error?: string }
                    | null;
                if (!payRes.ok) {
                    setCardError(payData?.error || "Could not verify card payment.");
                    return;
                }
                if (payData?.id) {
                    didSubmitFreshCardPayment = true;
                    urgentCardPaymentRecordIdOut = String(payData.id);
                    setUrgentCardPaymentRecordId(urgentCardPaymentRecordIdOut);
                }
            }
            if (!urgentCardPaymentRecordIdOut && !urgentCardLast4Resolved) {
                setCardError(
                    "Card payment is not on file. Use Done / Save draft with full card details, or enter full card, expiry, and CVC."
                );
                return;
            }
            setCardError("");
        }

        if (isUrgent && urgentPaymentMethod === "points" && !urgentPrepayId) {
            if (communityPoints !== null && communityPoints < urgentCfg.feePoints) {
                setSubmitError(
                    "Not enough points for urgent — switch to card payment or earn more points."
                );
                return;
            }
        }

        setPostConfirmOpen(false);
        setIsSubmitting(true);
        setSubmitError("");

        try {
            const storedUser = readStoredUser();
            const profileSettings = readCommunityProfileSettings();
            const authorDisplayName =
                profileSettings.displayName.trim() || storedUser?.name?.trim() || "Current User";
            const res = await fetch("/api/community-posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    category,
                    tags,
                    attachments,
                    pictureUrl: pictureUrl.trim() || undefined,
                    status,
                    author: storedUser?.id,
                    authorName: authorDisplayName,
                    authorUsername: storedUser?.username ?? "",
                    authorEmail: storedUser?.email ?? "",
                    authorDisplayName,
                    clientRequestId,
                    isUrgent,
                    urgentLevel: isUrgent ? urgentLevel : null,
                    urgentPaymentMethod: isUrgent ? urgentPaymentMethod : null,
                    urgentCardLast4:
                        isUrgent && urgentPaymentMethod === "card" && urgentCardLast4Resolved
                            ? urgentCardLast4Resolved
                            : null,
                    urgentPrepayId:
                        isUrgent && urgentPaymentMethod === "points"
                            ? urgentPrepayId || (draftToEdit?.urgentPrepayId ?? null)
                            : null,
                    urgentCardPaymentRecordId:
                        isUrgent && urgentPaymentMethod === "card" && urgentCardPaymentRecordIdOut
                            ? urgentCardPaymentRecordIdOut
                            : null,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setSubmitError(data?.error ?? "Failed to create post.");
                // If points are insufficient, encourage switching to card.
                const msg = String(data?.error ?? "");
                if (msg.toLowerCase().includes("card")) {
                    setUrgentPaymentMethod("card");
                }
                return;
            }

            void refreshCommunityPointsFromServer();

            if (didSubmitFreshCardPayment) {
                try {
                    sessionStorage.setItem(
                        COMMUNITY_URGENT_CARD_PAYMENT_DONE_SESSION_KEY,
                        "1"
                    );
                } catch {
                    // ignore
                }
                afterUrgentPaymentAckRef.current = () => {
                    router.push("/community");
                    onPostSuccess?.(draftId ?? undefined);
                };
                setUrgentPaymentDoneDialogOpen(true);
                setIsSubmitting(false);
                return;
            }

            router.push("/community");
            onPostSuccess?.(draftId ?? undefined);
        } catch {
            setSubmitError("Unable to connect to the server.");
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (!postConfirmOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isSubmitting) {
                setPostConfirmOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [postConfirmOpen, isSubmitting]);

    useEffect(() => {
        if (!urgentPaymentDoneDialogOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                dismissUrgentPaymentDoneDialog();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [urgentPaymentDoneDialogOpen, dismissUrgentPaymentDoneDialog]);

    useEffect(() => {
        if (!urgentNonRefundableOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !urgentDoneBusy) {
                setUrgentNonRefundableOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [urgentNonRefundableOpen, urgentDoneBusy]);

    return (
        <>
        <Card
            className={cn(
                "rounded-2xl border border-blue-100 bg-white/95 p-5 shadow-none sm:p-6",
                className
            )}
        >
            <div className={cn("border-b border-blue-100", compact ? "mb-4 pb-3" : "mb-6 pb-4")}>
                <h2 className={cn("font-semibold text-slate-800", compact ? "text-lg" : "text-xl")}>
                    Share with the Community
                </h2>
                <p className={cn("mt-1 text-slate-600", compact ? "text-xs" : "text-sm")}>
                    Post a question, resource, or announcement for your peers.
                </p>
            </div>

            <form
                noValidate
                onSubmit={(e) => e.preventDefault()}
                className="space-y-5"
            >
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Title <span className="text-red-500">*</span>
                    </label>
                    <Input
                        placeholder="What's on your mind?"
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            setIsDraftSaved(false);
                        }}
                        autoFocus={!compact}
                        aria-invalid={titleFieldError ? true : undefined}
                        aria-describedby={titleFieldError ? "title-field-error" : undefined}
                        className={cn(
                            "border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200",
                            !!titleFieldError &&
                                "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-200"
                        )}
                    />
                    {titleFieldError ? (
                        <p
                            id="title-field-error"
                            className="mt-2 text-xs font-medium text-red-600"
                            role="alert"
                        >
                            {titleFieldError}
                        </p>
                    ) : null}
                </div>

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Category <span className="text-red-500">*</span>
                    </label>
                    <select
                        className="w-full rounded-2xl border border-blue-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        value={category}
                        onChange={(e) => {
                            setCategory(e.target.value);
                            setIsDraftSaved(false);
                        }}
                    >
                        {CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Details <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                        placeholder="Share the details here..."
                        rows={compact ? 3 : 4}
                        value={description}
                        onChange={(e) => {
                            setDescription(e.target.value);
                            setIsDraftSaved(false);
                        }}
                        aria-invalid={descriptionFieldError ? true : undefined}
                        aria-describedby={descriptionFieldError ? "description-field-error" : undefined}
                        className={cn(
                            "min-h-[100px] border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200 sm:min-h-[120px]",
                            !!descriptionFieldError &&
                                "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-200"
                        )}
                    />
                    {descriptionFieldError ? (
                        <p
                            id="description-field-error"
                            className="mt-2 text-xs font-medium text-red-600"
                            role="alert"
                        >
                            {descriptionFieldError}
                        </p>
                    ) : null}
                </div>

                <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <ImagePlus size={14} />
                        Picture <span className="text-xs font-normal text-slate-500">(optional)</span>
                    </label>
                    <input
                        ref={pictureInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handlePictureSelected}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="primary"
                            className="rounded-xl border border-blue-200 bg-blue-700 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-800"
                            onClick={() => pictureInputRef.current?.click()}
                        >
                            Choose image
                        </Button>
                        {pictureUrl ? (
                            <Button
                                type="button"
                                className="rounded-xl border border-slate-200 bg-gray-500 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-600"
                                onClick={clearPicture}
                            >
                                Remove
                            </Button>
                        ) : null}
                    </div>
                    {pictureError ? (
                        <p className="mt-2 text-xs font-medium text-red-600">{pictureError}</p>
                    ) : (
                        <p className="mt-1 text-xs text-slate-500">
                            JPEG, PNG, GIF, WebP — up to 2 MB. Stored with your post.
                        </p>
                    )}
                    {pictureUrl ? (
                        <div className="relative mt-3 overflow-hidden rounded-xl border border-blue-100 bg-slate-50">
                            {/* eslint-disable-next-line @next/next/no-img-element -- data URLs from user uploads */}
                            <img
                                src={pictureUrl}
                                alt=""
                                className="max-h-48 w-full object-contain"
                            />
                        </div>
                    ) : null}
                </div>

                <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <Tag size={14} />
                        Tags
                    </label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="#study — add a tag and press Enter"
                            value={tagInput}
                            onChange={(e) => {
                                setTagInput(e.target.value);
                                setTagError("");
                            }}
                            onKeyDown={handleTagKeyDown}
                            aria-invalid={tagError ? true : undefined}
                            aria-describedby={tagError ? "tag-input-error" : undefined}
                            className={cn(
                                "flex-1 border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200",
                                !!tagError &&
                                    "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-200"
                            )}
                        />
                        <Button
                            type="button"
                            variant="primary"
                            className="shrink-0 rounded-xl bg-blue-700 px-3 text-white hover:bg-blue-800"
                            onClick={addTag}
                            disabled={!tagInput.trim()}
                        >
                            <Plus size={16} />
                        </Button>
                    </div>
                    {tagError ? (
                        <p id="tag-input-error" className="mt-2 text-xs font-medium text-red-600" role="alert">
                            {tagError}
                        </p>
                    ) : null}
                    {!tagError && !tagsListError ? (
                        <p className="mt-1 text-xs text-slate-500">
                            Tags must start with # (for example #lost-and-found). Up to{" "}
                            {COMMUNITY_POST_BODY_LIMITS.maxTags} tags,{" "}
                            {COMMUNITY_POST_BODY_LIMITS.tagMaxLength} characters each.
                        </p>
                    ) : null}
                    {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                                >
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => removeTag(tag)}
                                        className="ml-0.5 rounded-full hover:text-blue-900"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    {tags.length > 0 && tagsListError ? (
                        <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                            {tagsListError}
                        </p>
                    ) : null}
                </div>

                <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <Paperclip size={14} />
                        Attachments <span className="text-xs font-normal text-slate-500">(URLs)</span>
                    </label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="https://…"
                            value={attachmentInput}
                            onChange={(e) => {
                                setAttachmentInput(e.target.value);
                                setAttachmentInputError("");
                            }}
                            onKeyDown={handleAttachmentKeyDown}
                            aria-invalid={attachmentInputError ? true : undefined}
                            aria-describedby={attachmentInputError ? "attachment-input-error" : undefined}
                            className={cn(
                                "flex-1 border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200",
                                !!attachmentInputError &&
                                    "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-200"
                            )}
                        />
                        <Button
                            type="button"
                            variant="primary"
                            className="shrink-0 rounded-xl bg-blue-700 px-3 text-white hover:bg-blue-800"
                            onClick={addAttachment}
                            disabled={!attachmentInput.trim()}
                        >
                            <Plus size={16} />
                        </Button>
                    </div>
                    {attachmentInputError ? (
                        <p id="attachment-input-error" className="mt-2 text-xs font-medium text-red-600" role="alert">
                            {attachmentInputError}
                        </p>
                    ) : attachmentsListError ? (
                        <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                            {attachmentsListError}
                        </p>
                    ) : (
                        <p className="mt-1 text-xs text-slate-500">
                            Http or https links only. Up to {COMMUNITY_POST_BODY_LIMITS.maxAttachments} links.
                        </p>
                    )}
                    {attachments.length > 0 && (
                        <ul className="mt-2 space-y-1">
                            {attachments.map((url) => (
                                <li
                                    key={url}
                                    className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-1.5 text-xs text-slate-700"
                                >
                                    <span className="max-w-[90%] truncate">{url}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(url)}
                                        className="ml-2 shrink-0 text-red-500 hover:text-red-700"
                                    >
                                        <X size={13} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                    <div className="flex gap-4">
                        {(["open"] as const).map((s) => (
                            <label key={s} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="radio"
                                    name="status"
                                    value={s}
                                    checked={status === s}
                                    onChange={() => {
                                        setStatus(s);
                                        setIsDraftSaved(false);
                                    }}
                                    className="accent-blue-700"
                                />
                                <span className="capitalize">{s}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                            <input
                                type="checkbox"
                                checked={isUrgent}
                                disabled={urgentCoreControlsDisabled}
                                onChange={(e) => {
                                    const next = e.target.checked;
                                    if (!next && urgentPrepayIdRef.current) {
                                        void cancelUrgentPrepay();
                                    }
                                    if (!next) {
                                        setUrgentCardLast4FromDraft(null);
                                    }
                                    setIsUrgent(next);
                                    setIsDraftSaved(false);
                                    setSubmitError("");
                                }}
                                className="h-4 w-4 accent-red-600 disabled:opacity-60"
                            />
                            Mark as urgent{" "}
                            <span className="font-normal text-slate-500">(optional)</span>
                        </label>
                        <div className="text-xs text-slate-600">
                            {pointsLoading ? (
                                "Loading points…"
                            ) : pointsError ? (
                                <span className="text-red-600">{pointsError}</span>
                            ) : communityPoints === null ? (
                                "Login to use points"
                            ) : (
                                <>
                                    Your points:{" "}
                                    <span className="font-semibold text-slate-800">{communityPoints}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {urgentSectionLocked ? (
                        <p className="mt-2 text-xs font-medium text-amber-800">
                            Urgent fee is already paid for this draft. Duration, payment method, and card details
                            cannot be changed — there is no refund. You can still edit the rest of the post and save.
                        </p>
                    ) : urgentPlanLockedOnDraftUpdate ? (
                        <p className="mt-2 text-xs font-medium text-amber-800">
                            This draft was saved as urgent: duration and payment type (points vs card) are fixed. You
                            can still complete payment (Pay or card) if it is not finished yet, then save or post.
                        </p>
                    ) : draftToEdit?.id && !draftToEdit.isUrgent ? (
                        <p className="mt-2 text-xs text-slate-600">
                            This draft was not urgent. You can turn on urgent once; after you save with urgent enabled,
                            you will not be able to change duration or payment type.
                        </p>
                    ) : null}

                    {isUrgent ? (
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                    Urgent duration
                                </label>
                                <select
                                    className="w-full rounded-2xl border border-blue-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                                    value={urgentLevel}
                                    disabled={urgentCoreControlsDisabled}
                                    onChange={async (e) => {
                                        const v = e.target.value as UrgentLevel;
                                        if (v === "2days" || v === "5days" || v === "7days") {
                                            if (v !== urgentLevel && urgentPrepayIdRef.current) {
                                                await cancelUrgentPrepay();
                                            }
                                            setUrgentLevel(v);
                                            setPayError("");
                                            setIsDraftSaved(false);
                                        }
                                    }}
                                >
                                    {URGENT_LEVELS.map((opt) => (
                                        <option key={opt.level} value={opt.level}>
                                            {urgentPaymentMethod === "card"
                                                ? `${opt.label} — ${opt.feeCardRs} rs`
                                                : `${opt.label} — ${opt.feePoints} points`}
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-slate-500">
                                    {urgentPaymentMethod === "card" ? (
                                        <>
                                            Urgent fee:{" "}
                                            <span className="font-semibold text-slate-800">
                                                {urgentCfg.feeCardRs}
                                            </span>{" "}
                                            rs (demo checkout)
                                        </>
                                    ) : (
                                        <>
                                            Urgent fee:{" "}
                                            <span className="font-semibold text-slate-800">
                                                {urgentCfg.feePoints}
                                            </span>{" "}
                                            points
                                        </>
                                    )}
                                </p>
                                {urgentPaymentMethod === "points" ? (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="primary"
                                            disabled={
                                                payingUrgent ||
                                                pointsFeeReserved ||
                                                cardUrgentPaymentActive ||
                                                (communityPoints !== null &&
                                                    communityPoints < urgentCfg.feePoints)
                                            }
                                            onClick={() => void handleUrgentPay()}
                                            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                        >
                                            {payingUrgent ? (
                                                <>
                                                    <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                                                    Paying…
                                                </>
                                            ) : pointsFeeReserved ? (
                                                "Paid"
                                            ) : (
                                                `Pay ${urgentCfg.feePoints} points`
                                            )}
                                        </Button>
                                        {pointsFeeReserved ? (
                                            <span className="text-xs font-medium text-green-700">
                                                Fee deducted from your profile — you can post.
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-500">
                                                Pay now to deduct points early, or post later — points are deducted when
                                                you publish if you have enough.
                                            </span>
                                        )}
                                    </div>
                                ) : null}
                                {payError ? (
                                    <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                                        {payError}
                                    </p>
                                ) : null}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                    Payment method
                                </label>
                                <p className="mb-2 text-xs text-slate-600">
                                    Use <span className="font-medium text-slate-800">points</span> or{" "}
                                    <span className="font-medium text-slate-800">card</span> — card does not deduct
                                    your community points (demo checkout; only last 4 digits are stored).
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    {(["points", "card"] as const).map((m) => {
                                        const insufficient =
                                            m === "points" &&
                                            communityPoints !== null &&
                                            communityPoints < urgentCfg.feePoints;
                                        return (
                                            <label
                                                key={m}
                                                className={cn(
                                                    "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm",
                                                    urgentCoreControlsDisabled &&
                                                        "pointer-events-none cursor-not-allowed opacity-70",
                                                    urgentPaymentMethod === m
                                                        ? "border-blue-400 bg-white text-slate-800"
                                                        : "border-blue-100 bg-white/70 text-slate-700"
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name="urgent-payment-method"
                                                    value={m}
                                                    disabled={urgentCoreControlsDisabled}
                                                    checked={urgentPaymentMethod === m}
                                                    onChange={() => {
                                                        if (m === "card" && urgentPrepayIdRef.current) {
                                                            void cancelUrgentPrepay();
                                                        }
                                                        setUrgentPaymentMethod(m);
                                                        if (m === "points") {
                                                            setUrgentCardLast4FromDraft(null);
                                                            setUrgentCardPaymentRecordId(null);
                                                        }
                                                        setIsDraftSaved(false);
                                                        setCardError("");
                                                    }}
                                                    className="accent-blue-700 disabled:opacity-60"
                                                />
                                                <span className="capitalize">{m}</span>
                                                {insufficient ? (
                                                    <span className="ml-1 text-xs text-amber-700">
                                                        (balance low — pay with card or earn points before posting)
                                                    </span>
                                                ) : null}
                                            </label>
                                        );
                                    })}
                                </div>
                                {communityPoints !== null && communityPoints < urgentCfg.feePoints ? (
                                    <p className="mt-2 text-xs text-slate-600">
                                        Your balance is below the urgent points fee — use card for urgent, or post
                                        without urgent, or earn points before you publish with points.
                                    </p>
                                ) : null}
                            </div>

                            {urgentPaymentMethod === "card" ? (
                                <div className="sm:col-span-2">
                                    {urgentCardLast4FromDraft ? (
                                        <p className="text-xs font-medium text-emerald-800">
                                            Card on file: ending in {urgentCardLast4FromDraft}
                                            {urgentCardFieldsLocked
                                                ? " — locked for this draft."
                                                : " — enter a new card below to replace, or post with this card."}
                                        </p>
                                    ) : null}
                                    <p className="mt-1 text-xs text-slate-600">
                                        Card number must be{" "}
                                        <span className="font-medium text-slate-800">four groups of four digits</span>{" "}
                                        with spaces (e.g. 4111 1111 1111 1111), expiry{" "}
                                        <span className="font-medium text-slate-800">MM/YY</span> in the future, and a{" "}
                                        <span className="font-medium text-slate-800">3-digit</span> CVC. Details are
                                        saved for admin review; full card number is encrypted when{" "}
                                        <span className="font-medium">COMMUNITY_URGENT_PAYMENT_KEY</span> is set. CVC is
                                        verified but never stored.
                                    </p>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                        <Input
                                            placeholder="2434 2424 2424 2424"
                                            inputMode="numeric"
                                            autoComplete="cc-number"
                                            value={cardNumber}
                                            onChange={(e) => {
                                                setCardNumber(formatUrgentCardDisplayInput(e.target.value));
                                                setUrgentCardPaymentRecordId(null);
                                                setCardError("");
                                                setIsDraftSaved(false);
                                            }}
                                            disabled={urgentCardFieldsLocked}
                                            className="border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200 disabled:bg-slate-100"
                                        />
                                        <Input
                                            placeholder="MM/YY"
                                            inputMode="numeric"
                                            autoComplete="cc-exp"
                                            maxLength={5}
                                            value={cardExpiry}
                                            onChange={(e) => {
                                                setCardExpiry(formatUrgentExpiryInput(e.target.value));
                                                setUrgentCardPaymentRecordId(null);
                                                setCardError("");
                                                setIsDraftSaved(false);
                                            }}
                                            disabled={urgentCardFieldsLocked}
                                            className="border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200 disabled:bg-slate-100"
                                        />
                                        <Input
                                            placeholder="123"
                                            inputMode="numeric"
                                            autoComplete="cc-csc"
                                            maxLength={3}
                                            value={cardCvc}
                                            onChange={(e) => {
                                                setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 3));
                                                setUrgentCardPaymentRecordId(null);
                                                setCardError("");
                                                setIsDraftSaved(false);
                                            }}
                                            disabled={urgentCardFieldsLocked}
                                            className="border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200 disabled:bg-slate-100"
                                        />
                                    </div>
                                    {cardError ? (
                                        <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                                            {cardError}
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}

                            {isUrgent && urgentDoneNavigatesTo?.trim() && onDraftSaved ? (
                                <div className="sm:col-span-2 mt-1 flex justify-end border-t border-blue-100 pt-3">
                                    <Button
                                        type="button"
                                        variant="primary"
                                        className="rounded-full bg-blue-700 px-6 text-white hover:bg-blue-800 disabled:cursor-not-allowed"
                                        disabled={urgentDoneBusy}
                                        onClick={() => void handleUrgentDoneClick()}
                                    >
                                        {urgentDoneBusy ? (
                                            <>
                                                <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                                                Saving…
                                            </>
                                        ) : (
                                            "Done"
                                        )}
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="border-t border-blue-100 pt-4">
                    {!isDraftSaved ? (
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <Button
                                    type="button"
                                    variant="primary"
                                    className="rounded-full bg-blue-700 px-6 text-white hover:bg-blue-800"
                                    onClick={requestSaveDraft}
                                    disabled={isSubmitting}
                                >
                                    {saveDraftLabel}
                                </Button>
                                <Button
                                    type="button"
                                    className="inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                                    disabled={isSubmitting}
                                    onClick={openPostConfirm}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                            Posting…
                                        </>
                                    ) : (
                                        <>
                                            <Send className="h-4 w-4 shrink-0" aria-hidden />
                                            Post
                                        </>
                                    )}
                                </Button>
                            </div>
                            <Button
                                type="button"
                                className="rounded-full border border-slate-300 bg-white px-6 text-slate-700 hover:bg-slate-100 sm:self-auto"
                                onClick={handleComposerCancel}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <div className="flex w-full flex-nowrap items-center justify-between gap-2 overflow-x-auto sm:gap-3">
                            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                                <Button
                                    type="button"
                                    className="rounded-full bg-red-600 px-4 text-white hover:bg-red-700 sm:px-6"
                                    onClick={handleDeleteDraft}
                                    disabled={isSubmitting}
                                >
                                    Delete
                                </Button>
                                <Button
                                    type="button"
                                    variant="primary"
                                    className="rounded-full bg-blue-700 px-4 text-white hover:bg-blue-800 sm:px-6"
                                    onClick={requestSaveDraft}
                                    disabled={isSubmitting}
                                >
                                    {saveDraftLabel}
                                </Button>
                            </div>
                            <div className="flex min-w-0 flex-1 justify-center px-1">
                                <Button
                                    type="button"
                                    className="inline-flex min-w-[9rem] shrink-0 items-center justify-center gap-2 rounded-full bg-emerald-600 px-8 py-2.5 text-base font-semibold text-white hover:bg-emerald-700 sm:min-w-[12rem] sm:px-14"
                                    disabled={isSubmitting}
                                    onClick={openPostConfirm}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                                            Posting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="h-5 w-5 shrink-0" aria-hidden />
                                            Post
                                        </>
                                    )}
                                </Button>
                            </div>
                            <div className="shrink-0">
                                <Button
                                    type="button"
                                    className="rounded-full bg-gray-600 px-4 text-white hover:bg-red-700 sm:px-6"
                                    onClick={handleComposerCancel}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {validationAttempted && !isFormValid ? (
                    <p className="text-sm text-red-700" role="status" aria-live="polite">
                        Please fix the highlighted fields before saving or posting.
                    </p>
                ) : null}
                {submitError && <p className="text-sm font-medium text-red-700">{submitError}</p>}
            </form>
        </Card>

            <UrgentPaymentDoneDialog
                open={urgentPaymentDoneDialogOpen}
                onDismiss={dismissUrgentPaymentDoneDialog}
            />

            {urgentNonRefundableOpen && (
                <div
                    className="fixed inset-0 z-[205] flex items-center justify-center p-4"
                    role="presentation"
                >
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
                        aria-label="Dismiss"
                        disabled={urgentDoneBusy}
                        onClick={() => !urgentDoneBusy && setUrgentNonRefundableOpen(false)}
                    />
                    <div
                        className="relative z-10 w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="urgent-nonrefund-title"
                    >
                        <h2
                            id="urgent-nonrefund-title"
                            className="text-lg font-semibold text-slate-800"
                        >
                            Payment is non-refundable
                        </h2>
                        <p className="mt-3 text-sm text-slate-600">
                            This urgent fee — whether you paid with{" "}
                            <span className="font-medium text-slate-800">points</span> or{" "}
                            <span className="font-medium text-slate-800">card</span> — cannot be returned or refunded
                            once you continue. Click OK to save your draft and go to your draft posts section, or
                            Cancel to stay here.
                        </p>
                        <div className="mt-6 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                onClick={() => setUrgentNonRefundableOpen(false)}
                                disabled={urgentDoneBusy}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="inline-flex min-w-[8rem] items-center justify-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                onClick={() => void confirmUrgentDoneAfterNonRefundAck()}
                                disabled={urgentDoneBusy}
                            >
                                {urgentDoneBusy ? (
                                    <>
                                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                        Saving…
                                    </>
                                ) : (
                                    "OK"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {postConfirmOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    role="presentation"
                >
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
                        aria-label="Dismiss"
                        onClick={() => !isSubmitting && setPostConfirmOpen(false)}
                    />
                    <div
                        className="relative z-10 w-full max-w-md rounded-2xl border border-blue-200 bg-white p-6 shadow-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="post-confirm-title"
                    >
                        <h2
                            id="post-confirm-title"
                            className="text-lg font-semibold text-slate-800"
                        >
                            Post to the community?
                        </h2>
                        <p className="mt-3 text-sm text-slate-600">
                            This will publish “{title.trim() || "your post"}” to the community feed for
                            everyone to see. You can still report or manage it from your profile later.
                        </p>
                        <div className="mt-6 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                onClick={() => setPostConfirmOpen(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="inline-flex min-w-[8rem] items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                onClick={() => {
                                    void executePost();
                                }}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                        Posting…
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 shrink-0" aria-hidden />
                                        Post
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
