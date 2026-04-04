"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  MessageSquare,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import Card from "@/components/ui/Card";
import CommunityReplyAttachment from "@/components/community/CommunityReplyAttachment";
import { readCommunityProfileSettings } from "@/lib/community-profile";
import { readStoredUser } from "@/lib/rbac";

type DbCommunityReply = {
  _id: string;
  postId: string;
  authorDisplayName?: string;
  message: string;
  createdAt?: string;
  isAccepted?: boolean;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
};

type DbCommunityPost = {
  _id: string;
  title: string;
  description: string;
  category: "lost_item" | "study_material" | "academic_question";
  pictureUrl?: string | null;
  status?: "open" | "resolved" | "archived";
  createdAt?: string;
  likesCount?: number;
  repliesCount?: number;
  replies?: DbCommunityReply[];
};

export default function CommunityProfilePostsPage() {
  const user = useMemo(() => readStoredUser(), []);
  const [posts, setPosts] = useState<DbCommunityPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvingPostId, setResolvingPostId] = useState<string | null>(null);
  const [acceptingReplyId, setAcceptingReplyId] = useState<string | null>(null);
  const [postDeleteConfirm, setPostDeleteConfirm] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [expandedPostReplies, setExpandedPostReplies] = useState<Record<string, boolean>>({});
  const openPosts = useMemo(
    () => (posts ?? []).filter((post) => (post.status ?? "open") === "open"),
    [posts]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError(null);
        if (!user?.id) {
          setPosts([]);
          return;
        }
        const res = await fetch(
          `/api/community-user-posts?userId=${encodeURIComponent(user.id)}`
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Failed to load posts");
        }
        const data = (await res.json()) as DbCommunityPost[];
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setPosts([]);
          setError(err instanceof Error ? err.message : "Failed to load posts");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const confirmPostDelete = useCallback(async () => {
    const pending = postDeleteConfirm;
    if (!pending || !user?.id) return;
    setDeletingPostId(pending.id);
    try {
      setError(null);
      const res = await fetch(
        `/api/community-posts/${encodeURIComponent(pending.id)}?userId=${encodeURIComponent(user.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to delete post");
      }
      setPosts((prev) => (prev ? prev.filter((p) => p._id !== pending.id) : prev));
      setPostDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
    } finally {
      setDeletingPostId(null);
    }
  }, [postDeleteConfirm, user?.id]);

  useEffect(() => {
    if (!postDeleteConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || deletingPostId) return;
      setPostDeleteConfirm(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [postDeleteConfirm, deletingPostId]);

  const togglePostReplies = useCallback((postId: string) => {
    setExpandedPostReplies((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  }, []);

  const handleMarkResolved = useCallback(async (postId: string) => {
    try {
      setResolvingPostId(postId);
      setError(null);
      const res = await fetch(`/api/community-posts/${encodeURIComponent(postId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "resolved" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to mark post as resolved");
      }
      setPosts((prev) =>
        prev
          ? prev.map((post) =>
              post._id === postId ? { ...post, status: "resolved" } : post
            )
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark post as resolved");
    } finally {
      setResolvingPostId(null);
    }
  }, []);

  const handleMarkReplyAccepted = useCallback(async (postId: string, replyId: string) => {
    try {
      setAcceptingReplyId(replyId);
      setError(null);
      const storedUser = readStoredUser();
      const settings = readCommunityProfileSettings();
      const authorName =
        settings.displayName.trim() || storedUser?.name?.trim() || "Current User";
      const res = await fetch(`/api/community-replies/${encodeURIComponent(replyId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isAccepted: true,
          author: storedUser?.id,
          authorUsername: storedUser?.username,
          authorEmail: storedUser?.email,
          authorName,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to mark reply as accepted");
      }
      setPosts((prev) =>
        prev
          ? prev.map((post) => {
              if (post._id !== postId) return post;
              return {
                ...post,
                replies: (post.replies ?? []).map((reply) => ({
                  ...reply,
                  isAccepted: reply._id === replyId,
                })),
              };
            })
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark reply as accepted");
    } finally {
      setAcceptingReplyId(null);
    }
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 space-y-3">
          <Link
            href="/community/profile#current-posts"
            className="inline-flex items-center gap-1 rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to profile
          </Link>
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-blue-700" />
            <h1 className="text-xl font-bold text-slate-800">All your current posts</h1>
          </div>
        </div>

        {error && (
          <Card className="mb-4 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-none">
            {error}
          </Card>
        )}

        {posts === null ? (
          <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
            Loading…
          </Card>
        ) : posts.length === 0 ? (
          <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
            No posts yet.
          </Card>
        ) : openPosts.length === 0 ? (
          <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
            No open posts right now.
          </Card>
        ) : (
          <div className="space-y-4">
            {openPosts.map((post) => (
              <Card key={post._id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                    {String(post.category).replace("_", " ")}
                  </span>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                    <span className="text-right text-xs text-slate-500">
                      {post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPostDeleteConfirm({ id: post._id, title: post.title })
                      }
                      disabled={deletingPostId === post._id}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={13} aria-hidden />
                      Delete
                    </button>
                  </div>
                </div>

                <h2 className="text-base font-semibold leading-snug text-slate-800">{post.title}</h2>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      post.status === "resolved"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {post.status === "resolved" ? "Resolved" : "Open"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleMarkResolved(post._id)}
                    disabled={post.status === "resolved" || resolvingPostId === post._id}
                    className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {resolvingPostId === post._id
                      ? "Updating..."
                      : post.status === "resolved"
                        ? "Resolved"
                        : "Mark Resolved"}
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{post.description}</p>
                {post.pictureUrl ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-blue-100 bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.pictureUrl}
                      alt=""
                      className="max-h-56 w-full object-contain"
                    />
                  </div>
                ) : null}

                <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <ThumbsUp size={14} /> {post.likesCount ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePostReplies(post._id)}
                    aria-expanded={Boolean(expandedPostReplies[post._id])}
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-slate-100"
                  >
                    <MessageSquare size={14} aria-hidden /> {post.repliesCount ?? 0}
                    <ChevronDown
                      size={13}
                      aria-hidden
                      className={`transition-transform ${
                        expandedPostReplies[post._id] ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {expandedPostReplies[post._id] && (post.replies?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Replies
                    </p>
                    {post.replies!.map((reply) => (
                      <div key={reply._id} className="rounded-lg bg-white p-3 text-sm text-slate-700">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-500">
                            {reply.authorDisplayName || "Community User"}
                            {reply.createdAt ? (
                              <span className="font-normal">
                                {" "}
                                · {new Date(reply.createdAt).toLocaleString()}
                              </span>
                            ) : null}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleMarkReplyAccepted(post._id, reply._id)}
                            disabled={reply.isAccepted || acceptingReplyId === reply._id}
                            className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {acceptingReplyId === reply._id
                              ? "Updating..."
                              : reply.isAccepted
                                ? "Accepted"
                                : "Mark Accepted"}
                          </button>
                        </div>
                        {(reply.message ?? "").trim() ? (
                          <p className="mt-1 whitespace-pre-wrap">{reply.message}</p>
                        ) : reply.attachmentUrl ? (
                          <p className="mt-1 text-xs italic text-slate-500">Attachment only</p>
                        ) : null}
                        {reply.attachmentUrl ? (
                          <CommunityReplyAttachment
                            attachmentUrl={reply.attachmentUrl}
                            attachmentName={reply.attachmentName ?? undefined}
                            imageClassName="max-h-32"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
                {expandedPostReplies[post._id] && (post.replies?.length ?? 0) === 0 && (
                  <p className="mt-3 text-xs text-slate-500">No replies yet.</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {postDeleteConfirm && (
        <div
          className="fixed inset-0 z-[103] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            aria-label="Dismiss"
            onClick={() => !deletingPostId && setPostDeleteConfirm(null)}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-blue-200 bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="posts-page-delete-confirm-title"
          >
            <h2
              id="posts-page-delete-confirm-title"
              className="text-lg font-semibold text-slate-800"
            >
              Delete this post?
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Are you sure you want to delete “{postDeleteConfirm.title}”? Replies and likes for
              this post will be removed. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPostDeleteConfirm(null)}
                disabled={!!deletingPostId}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                onClick={() => {
                  confirmPostDelete().catch(() => undefined);
                }}
                disabled={!!deletingPostId}
              >
                {deletingPostId ? "Deleting…" : "Delete post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

