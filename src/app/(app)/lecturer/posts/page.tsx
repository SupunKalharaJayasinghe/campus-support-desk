"use client";

import "../lecturer-experience.css";

import { useEffect, useMemo, useState } from "react";
import { BadgeHelp, MessageSquareText, Send, Sparkles } from "lucide-react";
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

  const academicCount = posts.filter((post) => post.category === "Academic Question").length;
  const answeredCount = posts.filter((post) => post.replies.length > 0).length;
  const waitingCount = posts.length - answeredCount;

  return (
    <div className="lecturer-experience">
      <div className="page">
        <div className="section active">
          <div className="container">
            <div className="page-header fadein">
              <div>
                <div className="page-title">Posts</div>
                <div className="page-subtitle">
                  Review student discussion threads and answer them in the same lecturer support workspace.
                </div>
              </div>
            </div>

            <div className="stats-row fadein">
              {[
                { icon: <MessageSquareText size={18} />, label: "Total threads", value: posts.length, color: "var(--accent)" },
                { icon: <BadgeHelp size={18} />, label: "Academic questions", value: academicCount, color: "var(--amber)" },
                { icon: <Sparkles size={18} />, label: "Answered", value: answeredCount, color: "var(--green)" },
                { icon: <Send size={18} />, label: "Waiting reply", value: waitingCount, color: "var(--purple)" },
              ].map((item) => (
                <div className="glass stat-card" key={item.label} style={{ color: item.color }}>
                  <div className="stat-icon" style={{ background: "rgba(52,97,255,0.08)" }}>
                    {item.icon}
                  </div>
                  <div className="stat-value" style={{ color: "var(--ink)" }}>
                    {item.value}
                  </div>
                  <div className="stat-label">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="glass-strong fadein">
              <div className="card-header">
                <div>
                  <div className="card-title">Discussion Feed</div>
                  <div className="card-subtitle">Reply to student posts without changing any current post storage logic</div>
                </div>
              </div>
              <div className="card-body">
                {posts.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-text">No posts available yet.</div>
                  </div>
                ) : (
                  <div className="slot-list">
                    {posts.map((post) => (
                      <div className="glass" key={post.id} style={{ padding: 22 }}>
                        <div
                          className="inline-flex"
                          style={{
                            justifyContent: "space-between",
                            width: "100%",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                          }}
                        >
                          <div className="inline-flex" style={{ flexWrap: "wrap" }}>
                            <span className={`badge ${post.category === "Academic Question" ? "badge-booked" : "badge-waitlist"}`}>
                              {post.category}
                            </span>
                            <span className={`badge ${post.replies.length > 0 ? "badge-available" : "badge-full"}`}>
                              {post.replies.length > 0 ? `${post.replies.length} replies` : "Waiting reply"}
                            </span>
                          </div>
                          <span className="text-xs">{post.time}</span>
                        </div>

                        <div className="slot-date" style={{ marginTop: 12 }}>{post.title}</div>
                        <div className="slot-time" style={{ marginTop: 6 }}>
                          {post.content}
                        </div>
                        <div className="text-xs" style={{ marginTop: 8 }}>
                          {post.author} • {post.status}
                          {post.attachmentName ? ` • Attachment: ${post.attachmentName}` : ""}
                        </div>

                        {post.replies.length > 0 ? (
                          <div className="slot-list" style={{ marginTop: 16 }}>
                            {post.replies.map((reply) => (
                              <div className="slot-item" key={reply.id} style={{ cursor: "default" }}>
                                <div className="slot-indicator ind-green" />
                                <div style={{ flex: 1 }}>
                                  <div className="slot-date">{reply.author}</div>
                                  <div className="slot-time">{reply.message}</div>
                                  <div className="text-xs">{reply.time}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "minmax(0,1fr) auto",
                            marginTop: 16,
                          }}
                        >
                          <input
                            className="form-input"
                            onChange={(event) =>
                              setAnswers((prev) => ({ ...prev, [post.id]: event.target.value }))
                            }
                            placeholder="Write answer..."
                            type="text"
                            value={answers[post.id] ?? ""}
                          />
                          <button
                            className="btn-primary"
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
                            type="button"
                          >
                            <Send size={16} />
                            Post Answer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
