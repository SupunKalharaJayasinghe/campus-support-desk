"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import type { PostCategory, PostItem, PostReply, PostStatus } from "@/models/portal-types";
import { readStoredUser } from "@/lib/rbac";

type Filter = "All" | PostCategory;
type ApiCommunityCategory = "academic_question" | "study_material" | "lost_item";

interface ApiCommunityPost {
  _id: string;
  title: string;
  description: string;
  category: ApiCommunityCategory;
  createdAt?: string;
  likesCount?: number;
  likedByCurrentUser?: boolean;
  author?: string | { name?: string };
  authorDisplayName?: string;
  authorMemberDisplayName?: string;
  status?: string;
}

interface ApiCommunityReply {
  _id: string;
  author?: string | { name?: string };
  authorDisplayName?: string;
  authorMemberDisplayName?: string;
  message: string;
  createdAt?: string;
}

interface ToggleLikeResponse {
  liked?: boolean;
  likesCount?: number;
  error?: string;
}

interface StudentPostItem extends PostItem {
  likedByCurrentUser: boolean;
}

const CATEGORY_TO_API: Record<PostCategory, ApiCommunityCategory> = {
  "Academic Question": "academic_question",
  "Study Material": "study_material",
  "Lost Item": "lost_item",
};

const API_TO_CATEGORY: Record<ApiCommunityCategory, PostCategory> = {
  academic_question: "Academic Question",
  study_material: "Study Material",
  lost_item: "Lost Item",
};

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function readErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  const row = payload as { error?: unknown; message?: unknown };
  return String(row.error ?? row.message ?? fallback).trim() || fallback;
}

function formatPostTime(value?: string) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "Just now";
  }

  return parsed.toLocaleString();
}

function mapAuthorName(value: ApiCommunityPost | ApiCommunityReply) {
  const live = String(value.authorMemberDisplayName ?? "").trim();
  const snapshot = String(value.authorDisplayName ?? "").trim();
  const fallback =
    typeof value.author === "object"
      ? String(value.author.name ?? "").trim()
      : "";

  return live || snapshot || fallback || "Community User";
}

function mapReply(reply: ApiCommunityReply): PostReply {
  return {
    id: reply._id,
    author: mapAuthorName(reply),
    authorId: "",
    message: String(reply.message ?? "").trim(),
    time: formatPostTime(reply.createdAt),
  };
}

function mapStatus(value: string | undefined): PostStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "archived") {
    return "Archived";
  }
  if (normalized === "resolved") {
    return "Resolved";
  }
  return "Open";
}

function mapPost(post: ApiCommunityPost, replies: PostReply[] = []): StudentPostItem {
  const category = API_TO_CATEGORY[post.category] ?? "Academic Question";
  return {
    id: post._id,
    ownerId: typeof post.author === "string" ? post.author : "",
    title: String(post.title ?? "").trim(),
    description: String(post.description ?? "").trim(),
    content: String(post.description ?? "").trim(),
    author: mapAuthorName(post),
    category,
    tags: [],
    replies,
    upvotes: Math.max(0, Number(post.likesCount ?? 0)),
    status: mapStatus(post.status),
    time: formatPostTime(post.createdAt),
    likedByCurrentUser: Boolean(post.likedByCurrentUser),
  };
}

async function fetchReplies(postId: string, viewerId: string) {
  const searchParams = new URLSearchParams({ postId });
  if (viewerId) {
    searchParams.set("viewerId", viewerId);
  }

  const response = await fetch(`/api/community-replies?${searchParams.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return [] as PostReply[];
  }

  const payload = (await response.json().catch(() => null)) as ApiCommunityReply[] | null;
  if (!Array.isArray(payload)) {
    return [] as PostReply[];
  }

  return payload.map(mapReply);
}

export default function StudentPostsPage() {
  const { toast } = useToast();
  const user = useMemo(() => readStoredUser(), []);
  const viewerId = String(user?.id ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [posts, setPosts] = useState<StudentPostItem[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<PostCategory>("Academic Question");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      try {
        const searchParams = new URLSearchParams();
        if (viewerId) {
          searchParams.set("viewerId", viewerId);
        }

        const query = searchParams.toString();
        const response = await fetch(
          query ? `/api/community-posts?${query}` : "/api/community-posts",
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => null)) as
          | ApiCommunityPost[]
          | { error?: string; message?: string }
          | null;

        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(readErrorMessage(payload, "Failed to load posts."));
        }

        const replyRows = await Promise.all(
          payload.map(async (post) => [post._id, await fetchReplies(post._id, viewerId)] as const)
        );
        const repliesByPostId = new Map<string, PostReply[]>(replyRows);
        const mapped = payload.map((post) => mapPost(post, repliesByPostId.get(post._id) ?? []));

        if (!cancelled) {
          setPosts(mapped);
          setSelectedId((current) => {
            if (current && mapped.some((item) => item.id === current)) {
              return current;
            }
            return mapped[0]?.id ?? null;
          });
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Posts unavailable",
            message:
              error instanceof Error ? error.message : "Failed to load posts.",
            variant: "error",
          });
          setPosts([]);
          setSelectedId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, [toast, viewerId]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return posts.filter((post) => {
      if (filter !== "All" && post.category !== filter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        post.title.toLowerCase().includes(query) ||
        post.description.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query)
      );
    });
  }, [filter, posts, search]);

  const selected = posts.find((item) => item.id === selectedId) ?? null;

  const toggleUpvote = async (post: StudentPostItem) => {
    if (!viewerId) {
      toast({
        title: "Sign in required",
        message: "You need to sign in before reacting to posts.",
        variant: "error",
      });
      return;
    }

    setBusyPostId(post.id);
    try {
      const response = await fetch("/api/community-post-likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: post.id,
          userId: viewerId,
          username: user?.username,
          email: user?.email,
          name: user?.name,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ToggleLikeResponse | null;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Failed to update post reaction."));
      }

      const liked = Boolean(payload?.liked);
      const likesCount = Math.max(0, Number(payload?.likesCount ?? post.upvotes));

      setPosts((current) =>
        current.map((entry) =>
          entry.id === post.id
            ? {
                ...entry,
                upvotes: likesCount,
                likedByCurrentUser: liked,
              }
            : entry
        )
      );

      toast({
        title: liked ? "Upvoted" : "Upvote removed",
        message: liked
          ? "Your vote has been recorded."
          : "Your vote has been removed.",
      });
    } catch (error) {
      toast({
        title: "Reaction failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update the post right now.",
        variant: "error",
      });
    } finally {
      setBusyPostId(null);
    }
  };

  const createPost = async () => {
    if (submitting) {
      return;
    }

    if (!title.trim() || !description.trim()) {
      return;
    }

    if (!viewerId) {
      toast({
        title: "Sign in required",
        message: "You need to sign in before creating a post.",
        variant: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/community-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category: CATEGORY_TO_API[category],
          status: "open",
          author: viewerId,
          authorUsername: user?.username,
          authorEmail: user?.email,
          authorName: user?.name,
          authorDisplayName: user?.name,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ApiCommunityPost
        | { error?: string; message?: string }
        | null;

      if (!response.ok || !payload || Array.isArray(payload) || !("_id" in payload)) {
        throw new Error(readErrorMessage(payload, "Failed to create the post."));
      }

      const created = mapPost(payload, []);
      setPosts((current) => [created, ...current]);
      setSelectedId(created.id);
      setTitle("");
      setDescription("");
      setCategory("Academic Question");
      setCreateOpen(false);
      toast({
        title: "Post created",
        message: "Your post was published successfully.",
      });
    } catch (error) {
      toast({
        title: "Create failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to create the post right now.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />
        <Card>
          <Skeleton className="h-10 w-full" />
        </Card>
        <Card>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="mt-3 h-16 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Posts</h1>
        <p className="text-sm text-text/72">Ask questions and share study resources.</p>
      </div>

      <Card>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["All", "Academic Question", "Study Material", "Lost Item"] as Filter[]).map((item) => (
              <button
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  filter === item ? "bg-primary text-white" : "bg-tint text-text/75"
                )}
                key={item}
                onClick={() => setFilter(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              className="md:w-72"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts"
              value={search}
            />
            <Button onClick={() => setCreateOpen(true)}>Create Post</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <p className="text-sm text-text/72">No posts found.</p>
            </Card>
          ) : (
            filtered.map((post) => (
              <Card className={selectedId === post.id ? "border-primary/35" : ""} key={post.id}>
                <button className="w-full text-left" onClick={() => setSelectedId(post.id)} type="button">
                  <div className="flex items-center justify-between">
                    <Badge variant={post.category === "Academic Question" ? "warning" : "success"}>
                      {post.category}
                    </Badge>
                    <Badge variant={post.status === "Archived" ? "danger" : "neutral"}>{post.status}</Badge>
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-heading">{post.title}</h2>
                  <p className="mt-1 text-sm text-text/72">{post.description}</p>
                  <p className="mt-2 text-xs text-text/70">
                    {post.replies.length} replies • {post.upvotes} upvotes
                  </p>
                </button>
              </Card>
            ))
          )}
        </div>

        <aside className="hidden lg:block">
          <Card>
            {selected ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-heading">{selected.title}</h2>
                <p className="text-sm text-text/72">{selected.content}</p>
                <div className="flex items-center justify-between gap-3 text-xs text-text/70">
                  <span>{selected.author}</span>
                  <span>{selected.time}</span>
                </div>
                <Button
                  disabled={busyPostId === selected.id}
                  onClick={() => void toggleUpvote(selected)}
                  variant="secondary"
                >
                  {busyPostId === selected.id
                    ? "Updating..."
                    : selected.likedByCurrentUser
                      ? "Upvoted"
                      : "Upvote"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-text/72">Select a post to view details.</p>
            )}
          </Card>
        </aside>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-40 bg-text/35 p-4">
          <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-xl">
              <h2 className="text-lg font-semibold text-heading">Create Post</h2>
              <div className="mt-4 space-y-3">
                <Select
                  onChange={(event) => setCategory(event.target.value as PostCategory)}
                  value={category}
                >
                  <option value="Academic Question">Academic Question</option>
                  <option value="Study Material">Study Material</option>
                  <option value="Lost Item">Lost Item</option>
                </Select>
                <Input onChange={(event) => setTitle(event.target.value)} placeholder="Title" value={title} />
                <Textarea
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Description"
                  value={description}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button disabled={submitting} onClick={() => setCreateOpen(false)} variant="ghost">
                  Cancel
                </Button>
                <Button disabled={submitting} onClick={() => void createPost()}>
                  {submitting ? "Creating..." : "Create Post"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
