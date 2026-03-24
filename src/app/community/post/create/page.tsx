"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Tag, Paperclip, X, Plus } from "lucide-react";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import communityBackground from "@/app/images/community/community2.jpg";
import { readStoredUser } from "@/lib/rbac";

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
                    authorName: storedUser?.name ?? "Current User",
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
            className="min-h-screen bg-cover bg-center bg-no-repeat py-10 lg:py-16"
            style={{ backgroundImage: `url(${communityBackground.src})` }}
        >
            <Container size="4xl">
                <div className="rounded-3xl border border-gray-500/40 bg-gray-200/90 p-6 shadow-shadow md:p-8">
                    {/* Back button */}
                    <div className="mb-8">
                        <Link
                            className="inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2 text-sm font-semibold text-text shadow-sm transition-all hover:bg-gray-50 hover:shadow-md"
                            href="/community"
                        >
                            <ArrowLeft size={16} />
                            Back to Community
                        </Link>
                    </div>

                    <Card className="mx-auto w-full max-w-2xl overflow-hidden border-2 border-primary/20 bg-white p-6 shadow-lg">
                        <h2 className="mb-6 text-xl font-semibold text-heading">Create a New Post</h2>

                        <form onSubmit={handlePost} className="space-y-5">

                            {/* Title */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-text/80">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    placeholder="What's on your mind?"
                                    value={title}
                                    onChange={(e) => { setTitle(e.target.value); setIsDraftSaved(false); }}
                                    autoFocus
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-text/80">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full rounded-[16px] border border-border bg-card px-3.5 py-2.5 text-sm text-text transition-colors placeholder:text-text/55 focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus"
                                    value={category}
                                    onChange={(e) => { setCategory(e.target.value); setIsDraftSaved(false); }}
                                >
                                    {CATEGORY_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-text/80">
                                    Details <span className="text-red-500">*</span>
                                </label>
                                <Textarea
                                    placeholder="Share the details here..."
                                    rows={4}
                                    value={description}
                                    onChange={(e) => { setDescription(e.target.value); setIsDraftSaved(false); }}
                                />
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text/80">
                                    <Tag size={14} />
                                    Tags
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add a tag and press Enter"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={handleTagKeyDown}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="primary"
                                        className="shrink-0 bg-blue-600 px-3 text-white hover:bg-blue-700"
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
                                                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700"
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

                            {/* Attachments */}
                            <div>
                                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text/80">
                                    <Paperclip size={14} />
                                    Attachments <span className="text-xs font-normal text-text/50">(URLs)</span>
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Paste a URL and press Enter"
                                        value={attachmentInput}
                                        onChange={(e) => setAttachmentInput(e.target.value)}
                                        onKeyDown={handleAttachmentKeyDown}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="primary"
                                        className="shrink-0 bg-blue-600 px-3 text-white hover:bg-blue-700"
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
                                                className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-text/70"
                                            >
                                                <span className="truncate max-w-[90%]">{url}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAttachment(url)}
                                                    className="ml-2 shrink-0 text-red-400 hover:text-red-600"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Status */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-text/80">Status</label>
                                <div className="flex gap-4">
                                    {(["open"] as const).map((s) => (
                                        <label key={s} className="flex cursor-pointer items-center gap-2 text-sm text-text/80">
                                            <input
                                                type="radio"
                                                name="status"
                                                value={s}
                                                checked={status === s}
                                                onChange={() => { setStatus(s); setIsDraftSaved(false); }}
                                                className="accent-primary"
                                            />
                                            <span className="capitalize">{s}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex justify-center gap-3 pt-2">
                                {!isDraftSaved ? (
                                    <Button
                                        type="button"
                                        variant="primary"
                                        className="bg-blue-600 px-8 text-white hover:bg-blue-700"
                                        onClick={handleSaveDraft}
                                        disabled={!isFormValid}
                                    >
                                        Save Draft
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            type="button"
                                            className="bg-red-600 px-6 text-white hover:bg-red-700"
                                            onClick={handleDeleteDraft}
                                            disabled={isSubmitting}
                                        >
                                            Delete
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="bg-green-600 px-6 text-white hover:bg-green-700"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? "Posting..." : "Post"}
                                        </Button>
                                    </>
                                )}
                            </div>

                            {submitError && (
                                <p className="text-center text-sm font-medium text-red-700">{submitError}</p>
                            )}
                        </form>
                    </Card>
                </div>
            </Container>
        </main>
    );
}
