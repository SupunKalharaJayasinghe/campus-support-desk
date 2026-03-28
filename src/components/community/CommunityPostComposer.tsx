"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Paperclip, Plus, Send, Tag, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { readStoredUser } from "@/lib/rbac";
import { readCommunityProfileSettings } from "@/lib/community-profile";
import { getPostTextQualityError } from "@/lib/post-text-quality";

const MAX_IMAGE_FILE_BYTES = 2 * 1024 * 1024;

const CATEGORY_OPTIONS = [
    { label: "Lost Item", value: "lost_item" },
    { label: "Study Material", value: "study_material" },
    { label: "Academic Question", value: "academic_question" },
];

function cn(...classes: Array<string | undefined | false>) {
    return classes.filter(Boolean).join(" ");
}

/** Tag must start with # and have at least one non-whitespace character after it. */
function isValidCommunityTag(raw: string): boolean {
    const t = raw.trim();
    return t.startsWith("#") && t.slice(1).trim().length > 0;
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

    const [isDraftSaved, setIsDraftSaved] = useState(false);
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
        setIsDraftSaved(true);
        setSubmitError("");
    }, [
        draftToEdit,
        draftToEdit?.id,
        draftToEdit?.updatedAt,
        draftToEdit?.pictureUrl,
    ]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [postConfirmOpen, setPostConfirmOpen] = useState(false);

    const addTag = () => {
        const trimmed = tagInput.trim();
        if (!trimmed) {
            setTagInput("");
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
        if (trimmed && !attachments.includes(trimmed)) {
            setAttachments((prev) => [...prev, trimmed]);
            setIsDraftSaved(false);
        }
        setAttachmentInput("");
    };

    const removeAttachment = (url: string) => {
        setAttachments((prev) => prev.filter((a) => a !== url));
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
        if (!title.trim() || !description.trim()) return;
        if (getPostTextQualityError(title) || getPostTextQualityError(description)) return;
        const nextDraft: CommunityPostDraftInput = {
            id: draftId ?? undefined,
            title: title.trim(),
            description: description.trim(),
            category: category as CommunityPostDraft["category"],
            tags,
            attachments,
            pictureUrl: pictureUrl.trim() || undefined,
            status,
        };
        const savedDraft = (await onDraftSaved?.(nextDraft)) ?? null;
        if (savedDraft?.id) {
            setDraftId(savedDraft.id);
        }
        if (resetAfterDraftSave) {
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
            setIsDraftSaved(false);
            setSubmitError("");
            return;
        }
        setIsDraftSaved(true);
    };

    const handleComposerCancel = () => {
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
        setIsDraftSaved(false);
        setSubmitError("");
        onDraftEditCancel?.();
    };

    const handleDeleteDraft = () => {
        if (draftId) {
            onDraftDeleted?.(draftId);
        }
        handleComposerCancel();
    };

    const tagsValid = tags.every((t) => isValidCommunityTag(t));
    const titleQualityError = getPostTextQualityError(title);
    const descriptionQualityError = getPostTextQualityError(description);
    const isFormValid =
        title.trim().length > 0 &&
        description.trim().length > 0 &&
        !titleQualityError &&
        !descriptionQualityError &&
        tagsValid;
    const saveDraftLabel = draftId ? "Update Draft" : "Save Draft";

    const openPostConfirm = () => {
        if (!isDraftSaved || !isFormValid || isSubmitting) return;
        setPostConfirmOpen(true);
    };

    const executePost = async () => {
        if (!isDraftSaved) return;
        if (!title.trim() || !description.trim()) return;
        if (getPostTextQualityError(title) || getPostTextQualityError(description)) return;

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
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setSubmitError(data?.error ?? "Failed to create post.");
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
                        aria-invalid={titleQualityError ? true : undefined}
                        aria-describedby={titleQualityError ? "title-quality-error" : undefined}
                        className={cn(
                            "border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200",
                            !!titleQualityError &&
                                "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-200"
                        )}
                    />
                    {titleQualityError ? (
                        <p
                            id="title-quality-error"
                            className="mt-2 text-xs font-medium text-red-600"
                            role="alert"
                        >
                            {titleQualityError}
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
                        aria-invalid={descriptionQualityError ? true : undefined}
                        aria-describedby={descriptionQualityError ? "description-quality-error" : undefined}
                        className={cn(
                            "min-h-[100px] border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200 sm:min-h-[120px]",
                            !!descriptionQualityError &&
                                "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-200"
                        )}
                    />
                    {descriptionQualityError ? (
                        <p
                            id="description-quality-error"
                            className="mt-2 text-xs font-medium text-red-600"
                            role="alert"
                        >
                            {descriptionQualityError}
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
                                tagError &&
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
                    ) : (
                        <p className="mt-1 text-xs text-slate-500">
                            Tags must start with # (for example #lost-and-found).
                        </p>
                    )}
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
                    {tags.length > 0 && !tagsValid ? (
                        <p className="mt-2 text-xs font-medium text-red-600">
                            Every tag must start with # and include text after it. Remove invalid tags and add them
                            again (e.g. #study).
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
                            placeholder="Paste a URL and press Enter"
                            value={attachmentInput}
                            onChange={(e) => setAttachmentInput(e.target.value)}
                            onKeyDown={handleAttachmentKeyDown}
                            className="flex-1 border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200"
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

                <div className="border-t border-blue-100 pt-4">
                    {!isDraftSaved ? (
                        <div className="flex w-full items-center justify-between gap-3">
                            <Button
                                type="button"
                                variant="primary"
                                className="rounded-full bg-blue-700 px-6 text-white hover:bg-blue-800"
                                onClick={handleSaveDraft}
                                disabled={!isFormValid}
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
                                    onClick={handleSaveDraft}
                                    disabled={!isFormValid || isSubmitting}
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
