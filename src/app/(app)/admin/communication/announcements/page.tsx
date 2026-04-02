"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Send, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createAnnouncement,
  listAnnouncements,
  type AnnouncementRecord,
} from "@/models/announcement-center";
import { readStoredUser } from "@/models/rbac";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{
    title?: string;
    message?: string;
  }>({});

  const loadAnnouncements = useCallback(async () => {
    try {
      const rows = await listAnnouncements();
      setItems(rows);
    } catch (error) {
      setItems([]);
      toast({
        title: "Failed",
        message:
          error instanceof Error ? error.message : "Failed to load announcements",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    if (!isComposeOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isComposeOpen]);

  const closeCompose = () => {
    setIsComposeOpen(false);
    setTitle("");
    setMessage("");
    setErrors({});
  };

  const publish = async () => {
    if (publishing) {
      return;
    }

    const nextErrors: typeof errors = {};
    const nextTitle = collapseSpaces(title);
    const nextMessage = collapseSpaces(message);

    if (!nextTitle) {
      nextErrors.title = "Title is required.";
    }
    if (!nextMessage) {
      nextErrors.message = "Message is required.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setPublishing(true);
    try {
      const actor = readStoredUser()?.name || "Admin";
      await createAnnouncement({
        title: nextTitle,
        message: nextMessage,
        targetLabel: "All users",
        createdBy: actor,
      });

      toast({
        title: "Published",
        message: "Announcement is now visible on all user dashboards.",
        variant: "success",
      });
      closeCompose();
      await loadAnnouncements();
    } catch (error) {
      toast({
        title: "Failed",
        message:
          error instanceof Error ? error.message : "Failed to publish announcement",
        variant: "error",
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <Button
            className="h-11 min-w-[180px] justify-center gap-2 rounded-2xl bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
            onClick={() => setIsComposeOpen(true)}
          >
            <Plus size={16} />
            Add Announcement
          </Button>
        }
        description="Announcements already published for users are listed below. Use + to publish a new one."
        title="Announcements"
      />

      <Card title="Published Announcements">
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-3xl border border-border bg-card p-6 text-sm text-text/70">
              Loading announcements...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-6 text-sm text-text/70">
              No announcements published yet.
            </div>
          ) : (
            items.map((item) => (
              <div className="rounded-3xl border border-border bg-card p-5" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-heading">{item.title}</p>
                    <p className="mt-1 text-xs text-text/60">
                      {item.targetLabel} • {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <Badge variant="success">Published</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-text/75">{item.message}</p>
                <p className="mt-3 text-xs text-text/60">Published by {item.createdBy}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      {isComposeOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCompose();
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]"
            role="dialog"
          >
            <div className="overflow-y-auto px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                    CREATE
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-heading">Add Announcement</p>
                </div>
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading"
                  onClick={closeCompose}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-heading" htmlFor="announcement-title">
                    Title
                  </label>
                  <Input
                    className={cn(
                      errors.title
                        ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                        : ""
                    )}
                    id="announcement-title"
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g., Midterm schedule update"
                    value={title}
                  />
                  {errors.title ? (
                    <p className="mt-1 text-xs text-red-700">{errors.title}</p>
                  ) : null}
                </div>

                <div>
                  <label className="text-sm font-medium text-heading" htmlFor="announcement-message">
                    Message
                  </label>
                  <Textarea
                    className={cn(
                      errors.message
                        ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                        : ""
                    )}
                    id="announcement-message"
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Write a clear message for all users."
                    value={message}
                  />
                  {errors.message ? (
                    <p className="mt-1 text-xs text-red-700">{errors.message}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-white px-6 py-4">
              <div className="flex justify-end gap-2.5">
                <Button
                  className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                  disabled={publishing}
                  onClick={closeCompose}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 min-w-[150px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
                  disabled={publishing}
                  onClick={() => {
                    void publish();
                  }}
                >
                  <Send size={16} />
                  {publishing ? "Publishing..." : "Publish"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
