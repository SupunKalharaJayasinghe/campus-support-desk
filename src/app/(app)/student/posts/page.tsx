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
import { PORTAL_DATA_KEYS, loadPortalData, savePortalData } from "@/models/portal-data";
import type { PostCategory, PostItem } from "@/models/portal-types";
import { readStoredUser } from "@/models/rbac";

type Filter = "All" | PostCategory;

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function StudentPostsPage() {
  const { toast } = useToast();
  const user = useMemo(() => readStoredUser(), []);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<PostCategory>("Academic Question");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [upvoted, setUpvoted] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    void loadPortalData<PostItem[]>(PORTAL_DATA_KEYS.discussionPosts, []).then((rows) => {
      if (cancelled) {
        return;
      }

      setPosts(rows);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistPosts = (next: PostItem[], onSuccess?: () => void) => {
    void savePortalData(PORTAL_DATA_KEYS.discussionPosts, next)
      .then((saved) => {
        setPosts(saved);
        onSuccess?.();
      })
      .catch(() => {
        toast({
          title: "Save failed",
          message: "Unable to update posts right now.",
        });
      });
  };

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
          {filtered.map((post) => (
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
          ))}
        </div>

        <aside className="hidden lg:block">
          <Card>
            {selected ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-heading">{selected.title}</h2>
                <p className="text-sm text-text/72">{selected.content}</p>
                <div className="flex flex-wrap gap-1">
                  {selected.tags.map((tag) => (
                    <span className="rounded-full bg-tint px-2 py-1 text-xs text-text/72" key={tag}>
                      #{tag}
                    </span>
                  ))}
                </div>
                <Button
                  disabled={upvoted.includes(selected.id)}
                  onClick={() => {
                    if (upvoted.includes(selected.id)) {
                      return;
                    }

                    const next = posts.map((entry) =>
                      entry.id === selected.id
                        ? { ...entry, upvotes: entry.upvotes + 1 }
                        : entry
                    );

                    persistPosts(next, () => {
                      setUpvoted((prev) => [...prev, selected.id]);
                      toast({ title: "Upvoted", message: "Your vote has been recorded." });
                    });
                  }}
                  variant="secondary"
                >
                  {upvoted.includes(selected.id) ? "Upvoted" : "Upvote"}
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
                <Button onClick={() => setCreateOpen(false)} variant="ghost">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!title.trim() || !description.trim()) {
                      return;
                    }

                    const next: PostItem[] = [
                      {
                        id: `post-${Date.now()}`,
                        ownerId: String(user?.id ?? "student"),
                        title: title.trim(),
                        description: description.trim(),
                        content: description.trim(),
                        author: String(user?.name ?? "Student"),
                        category,
                        tags: [],
                        replies: [],
                        upvotes: 0,
                        status: "Open",
                        time: "Just now",
                      },
                      ...posts,
                    ];

                    persistPosts(next, () => {
                      setTitle("");
                      setDescription("");
                      setCategory("Academic Question");
                      setCreateOpen(false);
                      toast({ title: "Post created", message: "Your post was added to the feed." });
                    });
                  }}
                >
                  Create Post
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
