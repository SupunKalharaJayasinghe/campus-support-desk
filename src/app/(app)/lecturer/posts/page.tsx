"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { PORTAL_DATA_KEYS, loadPortalData, savePortalData } from "@/models/portal-data";
import type { PostItem } from "@/models/portal-types";
import { readStoredUser } from "@/models/rbac";

export default function LecturerPostsPage() {
  const user = useMemo(() => readStoredUser(), []);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    void loadPortalData<PostItem[]>(PORTAL_DATA_KEYS.discussionPosts, []).then((rows) => {
      if (cancelled) {
        return;
      }

      setPosts(rows);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistPosts = (next: PostItem[]) => {
    void savePortalData(PORTAL_DATA_KEYS.discussionPosts, next)
      .then((saved) => {
        setPosts(saved);
      })
      .catch(() => null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Posts</h1>
        <p className="text-sm text-text/72">Answer student questions from the discussion feed.</p>
      </div>

      <div className="space-y-3">
        {posts.map((post) => (
          <Card key={post.id}>
            <Badge variant={post.category === "Academic Question" ? "warning" : "neutral"}>
              {post.category}
            </Badge>
            <h2 className="mt-2 text-base font-semibold text-heading">{post.title}</h2>
            <p className="mt-1 text-sm text-text/72">{post.content}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                onChange={(event) =>
                  setAnswers((prev) => ({ ...prev, [post.id]: event.target.value }))
                }
                placeholder="Write answer..."
                value={answers[post.id] ?? ""}
              />
              <Button
                onClick={() => {
                  const answer = (answers[post.id] ?? "").trim();
                  if (!answer) {
                    return;
                  }

                  const next = posts.map((entry) =>
                    entry.id === post.id
                      ? {
                          ...entry,
                          replies: [
                            ...entry.replies,
                            {
                              id: `reply-${Date.now()}`,
                              author: String(user?.name ?? "Lecturer"),
                              authorId: String(user?.id ?? "lecturer"),
                              message: answer,
                              time: "Just now",
                            },
                          ],
                        }
                      : entry
                  );

                  persistPosts(next);
                  setAnswers((prev) => ({ ...prev, [post.id]: "" }));
                }}
                variant="secondary"
              >
                Post Answer
              </Button>
            </div>
          </Card>
        ))}
        {posts.length === 0 ? (
          <Card>
            <p className="text-sm text-text/72">No posts available yet.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
