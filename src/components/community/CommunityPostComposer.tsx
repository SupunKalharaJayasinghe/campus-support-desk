"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    isCommunityPostComposerValid,
    isValidCommunityTag,
} from "@/lib/community-post-composer-validation";

const MAX_IMAGE_FILE_BYTES = 2 * 1024 * 1024;

const CATEGORY_OPTIONS = [
    { label: "Lost Item", value: "lost_item" },
    { label: "Study Material", value: "study_material" },
    { label: "Academic Question", value: "academic_question" },
];

function cn(...classes: Array<string | undefined | false>) {
    return classes.filter(Boolean).join(" ");
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
    urgentPaymentMethod: UrgentPaymentMethod | null;
    urgentPrepayId?: string | null;
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

    const [isDraftSaved, setIsDraftSaved] = useState(false);

    /** Set after successful Pay — must be sent when posting urgent + points (points deducted at Pay). */
    const [urgentPrepayId, setUrgentPrepayId] = useState<string | null>(null);
    const [payingUrgent, setPayingUrgent] = useState(false);
    const [payError, setPayError] = useState("");
    const urgentPrepayIdRef = useRef<string | null>(null);
    urgentPrepayIdRef.current = urgentPrepayId;

    const urgentLocked = Boolean(draftToEdit?.id);

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

    useEffect(() => {
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
    /** After Save/Post click, show required-field and full client-side validation messages. */
    const [validationAttempted, setValidationAttempted] = useState(false);
    const [attachmentInputError, setAttachmentInputError] = useState("");

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

    const handleSaveDraft = async () => {
        if (!isCommunityPostComposerValid({ title, description, tags, attachments })) return;

        const nextUrgentPaymentMethod: UrgentPaymentMethod = (() => {
            if (!isUrgent) return urgentPaymentMethod;
            if (urgentPaymentMethod !== "points") return urgentPaymentMethod;
            const pts = communityPoints ?? 0;
            return pts >= urgentCfg.feePoints ? "points" : "card";
        })();

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
            urgentPaymentMethod: isUrgent ? nextUrgentPaymentMethod : null,
            urgentCardLast4:
                isUrgent && nextUrgentPaymentMethod === "card"
                    ? cardNumber.replace(/\s+/g, "").slice(-4) || undefined
                    : undefined,
            urgentPrepayId:
                isUrgent && nextUrgentPaymentMethod === "points"
                    ? urgentPrepayId
                    : null,
        };
        const savedDraft = (await onDraftSaved?.(nextDraft)) ?? null;
        if (savedDraft?.id) {
            setDraftId(savedDraft.id);
        }
        if (resetAfterDraftSave) {
            void cancelUrgentPrepay();
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
            setIsDraftSaved(false);
            setSubmitError("");
            setValidationAttempted(false);
            setAttachmentInputError("");
            setPayError("");
            return;
        }
        setIsDraftSaved(true);
    };

    const handleComposerCancel = () => {
        void cancelUrgentPrepay();
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
        if (!isDraftSaved || isSubmitting) return;
        if (!isCommunityPostComposerValid({ title, description, tags, attachments })) return;
        if (isUrgent && urgentPaymentMethod === "points" && !urgentPrepayId) {
            setSubmitError("Click Pay to deduct points for urgent, or choose card payment.");
            return;
        }
        setPostConfirmOpen(true);
    };

    const handleUrgentPay = async () => {
        if (urgentLocked || !isUrgent || urgentPaymentMethod !== "points") return;
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
                setUrgentPrepayId(String(data.prepayId));
            }
            if (typeof data?.newPoints === "number" && Number.isFinite(data.newPoints)) {
                setCommunityPoints(data.newPoints);
            }
            setIsDraftSaved(false);
            // After paying, automatically save/update the draft with urgent + prepay id.
            setValidationAttempted(true);
            await handleSaveDraft();
        } catch (e) {
            setPayError(e instanceof Error ? e.message : "Payment failed.");
        } finally {
            setPayingUrgent(false);
        }
    };

    const executePost = async () => {
        if (!isDraftSaved) return;
        if (!isCommunityPostComposerValid({ title, description, tags, attachments })) return;

        if (isUrgent && urgentPaymentMethod === "card") {
            const raw = cardNumber.replace(/\s+/g, "");
            const last4 = raw.slice(-4);
            if (raw.length < 12 || last4.length !== 4 || !/^\d{4}$/.test(last4)) {
                setCardError("Enter a valid card number (digits only).");
                return;
            }
            if (!cardExpiry.trim()) {
                setCardError("Enter card expiry (MM/YY).");
                return;
            }
            if (!cardCvc.trim()) {
                setCardError("Enter card CVC.");
                return;
            }
            setCardError("");
        }

        if (isUrgent && urgentPaymentMethod === "points" && !urgentPrepayId) {
            setSubmitError("Click Pay to deduct points for urgent, or choose card payment.");
            return;
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
                    isUrgent,
                    urgentLevel: isUrgent ? urgentLevel : null,
                    urgentPaymentMethod: isUrgent ? urgentPaymentMethod : null,
                    urgentCardLast4:
                        isUrgent && urgentPaymentMethod === "card"
                            ? cardNumber.replace(/\s+/g, "").slice(-4)
                            : null,
                    urgentPrepayId:
                        isUrgent && urgentPaymentMethod === "points" ? urgentPrepayId : null,
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
                                disabled={urgentLocked}
                                onChange={(e) => {
                                    const next = e.target.checked;
                                    if (!next && urgentPrepayIdRef.current) {
                                        void cancelUrgentPrepay();
                                    }
                                    setIsUrgent(next);
                                    setIsDraftSaved(false);
                                    setSubmitError("");
                                }}
                                className="h-4 w-4 accent-red-600 disabled:opacity-60"
                            />
                            Mark as urgent
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

                    {urgentLocked ? (
                        <p className="mt-2 text-xs text-slate-600">
                            Urgent and payment details can’t be changed when updating a saved draft.
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
                                    disabled={urgentLocked}
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
                                            {opt.label} — {opt.feePoints} points
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-slate-500">
                                    Urgent fee:{" "}
                                    <span className="font-semibold text-slate-800">{urgentCfg.feePoints}</span>{" "}
                                    points
                                </p>
                                {urgentPaymentMethod === "points" && !urgentLocked ? (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="primary"
                                            disabled={
                                                payingUrgent ||
                                                !!urgentPrepayId ||
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
                                            ) : urgentPrepayId ? (
                                                "Paid"
                                            ) : (
                                                `Pay ${urgentCfg.feePoints} points`
                                            )}
                                        </Button>
                                        {urgentPrepayId ? (
                                            <span className="text-xs font-medium text-green-700">
                                                Fee deducted from your profile — you can post.
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-500">
                                                Pay now to deduct points before posting.
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
                                                    urgentPaymentMethod === m
                                                        ? "border-blue-400 bg-white text-slate-800"
                                                        : "border-blue-100 bg-white/70 text-slate-700"
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name="urgent-payment-method"
                                                    value={m}
                                                    disabled={urgentLocked || insufficient}
                                                    checked={urgentPaymentMethod === m}
                                                    onChange={() => {
                                                        if (m === "card" && urgentPrepayIdRef.current) {
                                                            void cancelUrgentPrepay();
                                                        }
                                                        setUrgentPaymentMethod(m);
                                                        setIsDraftSaved(false);
                                                        setCardError("");
                                                    }}
                                                    className="accent-blue-700 disabled:opacity-60"
                                                />
                                                <span className="capitalize">{m}</span>
                                                {insufficient ? (
                                                    <span className="ml-1 text-xs text-red-600">
                                                        (not enough points)
                                                    </span>
                                                ) : null}
                                            </label>
                                        );
                                    })}
                                </div>
                                {communityPoints !== null && communityPoints < urgentCfg.feePoints ? (
                                    <p className="mt-2 text-xs font-medium text-red-700">
                                        Not enough points for urgent — please pay by card.
                                    </p>
                                ) : null}
                            </div>

                            {urgentPaymentMethod === "card" ? (
                                <div className="sm:col-span-2">
                                    <p className="text-xs text-slate-600">
                                        Card payment is a demo flow (no real charge). We only store the last 4 digits.
                                    </p>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                        <Input
                                            placeholder="Card number"
                                            value={cardNumber}
                                            onChange={(e) => {
                                                setCardNumber(e.target.value);
                                                setCardError("");
                                                setIsDraftSaved(false);
                                            }}
                                            disabled={urgentLocked}
                                            className="border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200 disabled:bg-slate-100"
                                        />
                                        <Input
                                            placeholder="MM/YY"
                                            value={cardExpiry}
                                            onChange={(e) => {
                                                setCardExpiry(e.target.value);
                                                setCardError("");
                                                setIsDraftSaved(false);
                                            }}
                                            disabled={urgentLocked}
                                            className="border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200 disabled:bg-slate-100"
                                        />
                                        <Input
                                            placeholder="CVC"
                                            value={cardCvc}
                                            onChange={(e) => {
                                                setCardCvc(e.target.value);
                                                setCardError("");
                                                setIsDraftSaved(false);
                                            }}
                                            disabled={urgentLocked}
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
                        </div>
                    ) : null}
                </div>

                <div className="border-t border-blue-100 pt-4">
                    {!isDraftSaved ? (
                        <div className="flex w-full items-center justify-between gap-3">
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
                                className="rounded-full border border-slate-300 bg-white px-6 text-slate-700 hover:bg-slate-100"
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
