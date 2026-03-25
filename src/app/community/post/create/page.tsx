"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Tag, Paperclip, X, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import communityBackground from "@/app/images/community/community2.jpg";
import { readStoredUser } from "@/lib/rbac";
import { readCommunityProfileSettings } from "@/lib/community-profile";

const CATEGORY_OPTIONS = [
    { label: "Lost Item", value: "lost_item" },
    { label: "Study Material", value: "study_material" },
    { label: "Academic Question", value: "academic_question" },
];

export default function CreateCommunityPostPage() {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("study_material");
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [attachments, setAttachments] = useState<string[]>([]);
    const [attachmentInput, setAttachmentInput] = useState("");
    const [status, setStatus] = useState<"open" | "resolved">("open");

    const [isDraftSaved, setIsDraftSaved] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    // --- Tag helpers ---
    const addTag = () => {
        const trimmed = tagInput.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags((prev) => [...prev, trimmed]);
            setIsDraftSaved(false);
        }
        setTagInput("");
    };

    const removeTag = (tag: string) => {
        setTags((prev) => prev.filter((t) => t !== tag));
        setIsDraftSaved(false);
    };

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTag();
        }
    };

    // --- Attachment helpers ---
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

    const handleAttachmentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addAttachment();
        }
    };

    // --- Draft ---
    const handleSaveDraft = () => {
        if (!title.trim() || !description.trim()) return;
        setIsDraftSaved(true);
    };

    const handleDeleteDraft = () => {
        setTitle("");
        setDescription("");
        setCategory("study_material");
        setTags([]);
        setTagInput("");
        setAttachments([]);
        setAttachmentInput("");
        setStatus("open");
        setIsDraftSaved(false);
        setSubmitError("");
    };

    // --- Submit ---
    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isDraftSaved) return;
        if (!title.trim() || !description.trim()) return;

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
                    status,
                    author: storedUser?.id,
                    // keep both name fields aligned with the latest profile display name
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
        } catch {
            setSubmitError("Unable to connect to the server.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFormValid = title.trim().length > 0 && description.trim().length > 0;

    return (
        <main
            className="relative min-h-screen overflow-hidden text-[#0f0f0f]"
            style={{ backgroundImage: `url(${communityBackground.src})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
            <div className="absolute inset-0 bg-slate-100/70" />
            <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="rounded-md bg-blue-700 px-2 py-1 text-xs font-bold text-white">UNIHUB</div>
                        <span className="text-lg font-bold tracking-tight text-slate-800">Create Post</span>
                    </div>
                    <Link
                        className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-200"
                        href="/community"
                    >
                        <ArrowLeft size={16} />
                        Back to Community
                    </Link>
                </div>

                <Card className="mx-auto w-full max-w-3xl rounded-2xl border border-blue-100 bg-white/95 p-5 shadow-none sm:p-6">
                    <div className="mb-6 border-b border-blue-100 pb-4">
                        <h2 className="text-xl font-semibold text-slate-800">Share with the Community</h2>
                        <p className="mt-1 text-sm text-slate-600">Post a question, resource, or announcement for your peers.</p>
                    </div>

                    <form onSubmit={handlePost} className="space-y-5">
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
                                autoFocus
                                className="border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200"
                            />
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
                                rows={4}
                                value={description}
                                onChange={(e) => {
                                    setDescription(e.target.value);
                                    setIsDraftSaved(false);
                                }}
                                className="min-h-[120px] border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                                <Tag size={14} />
                                Tags
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Add a tag and press Enter"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    className="flex-1 border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200"
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

                        <div className="flex justify-end gap-3 border-t border-blue-100 pt-4">
                            {!isDraftSaved ? (
                                <Button
                                    type="button"
                                    variant="primary"
                                    className="rounded-full bg-blue-700 px-6 text-white hover:bg-blue-800"
                                    onClick={handleSaveDraft}
                                    disabled={!isFormValid}
                                >
                                    Save Draft
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        className="rounded-full bg-red-600 px-6 text-white hover:bg-red-700"
                                        onClick={handleDeleteDraft}
                                        disabled={isSubmitting}
                                    >
                                        Delete
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="rounded-full bg-blue-700 px-6 text-white hover:bg-blue-800"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? "Posting..." : "Post"}
                                    </Button>
                                </>
                            )}
                        </div>

                        {submitError && <p className="text-sm font-medium text-red-700">{submitError}</p>}
                    </form>
                </Card>
            </div>
        </main>
    );
}
