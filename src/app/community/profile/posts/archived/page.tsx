"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, MessageSquare, ThumbsUp } from "lucide-react";
import Card from "@/components/ui/Card";
import { readStoredUser } from "@/lib/rbac";

type DbCommunityReply = {
  _id: string;
  postId: string;
  authorDisplayName?: string;
  message: string;
  createdAt?: string;
};

type DbCommunityPost = {
  _id: string;
  title: string;
  description: string;
  category: "lost_item" | "study_material" | "academic_question";
  status?: "open" | "resolved" | "archived";
  createdAt?: string;
  likesCount?: number;
  repliesCount?: number;
  replies?: DbCommunityReply[];
};

export default function CommunityProfileArchivedPostsPage() {
  const user = useMemo(() => readStoredUser(), []);
  const [posts, setPosts] = useState<DbCommunityPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          throw new Error(body?.error || "Failed to load archived posts");
        }
        const data = (await res.json()) as DbCommunityPost[];
        if (!cancelled) {
          const archived = (Array.isArray(data) ? data : []).filter(
            (post) => post.status === "archived"
          );
          setPosts(archived);
        }
      } catch (err) {
        if (!cancelled) {
          setPosts([]);
          setError(
            err instanceof Error ? err.message : "Failed to load archived posts"
          );
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Archive size={20} className="text-blue-700" />
            <h1 className="text-xl font-bold text-slate-800">All archived posts</h1>
          </div>
          <Link
            href="/community/profile#archive-posts"
            className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Back to profile
          </Link>
        </div>

        {error && (
          <Card className="mb-4 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-none">
            {error}
          </Card>
        )}

        {posts === null ? (
          <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
            Loading archived posts…
          </Card>
        ) : posts.length === 0 ? (
          <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
            No archived posts yet.
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post._id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                    {String(post.category).replace("_", " ")}
                  </span>
                  <span className="text-xs text-slate-500">
                    {post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}
                  </span>
                </div>

                <h2 className="text-base font-semibold leading-snug text-slate-800">{post.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{post.description}</p>

                <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <ThumbsUp size={14} /> {post.likesCount ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare size={14} /> {post.repliesCount ?? 0}
                  </span>
                </div>

                {(post.replies?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Replies
                    </p>
                    {post.replies!.map((reply) => (
                      <div key={reply._id} className="rounded-lg bg-white p-3 text-sm text-slate-700">
                        <p className="text-xs font-semibold text-slate-500">
                          {reply.authorDisplayName || "Community User"}
                          {reply.createdAt ? (
                            <span className="font-normal">
                              {" "}
                              · {new Date(reply.createdAt).toLocaleString()}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{reply.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

