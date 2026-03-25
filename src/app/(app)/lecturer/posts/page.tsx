"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { lecturerPosts } from "@/models/mockData";
import type { PostItem } from "@/models/mockData";

export default function LecturerPostsPage() {
  const [posts, setPosts] = useState<PostItem[]>(lecturerPosts);
  const [answers, setAnswers] = useState<Record<string, string>>({});

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
                  setPosts((prev) =>
                    prev.map((entry) =>
                      entry.id === post.id
                        ? {
                            ...entry,
                            replies: [
                              ...entry.replies,
                              {
                                id: `reply-${Date.now()}`,
                                author: "Dr. Liam Harper",
                                authorId: "u-lecturer",
                                message: answer,
                                time: "Just now",
                              },
                            ],
                          }
                        : entry
                    )
                  );
                  setAnswers((prev) => ({ ...prev, [post.id]: "" }));
                }}
                variant="secondary"
              >
                Post Answer
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

