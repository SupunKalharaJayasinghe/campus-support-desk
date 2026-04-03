"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Edit3, Eye, EyeOff, Megaphone, Plus, RefreshCw, Send, Trash2, X } from "lucide-react";
import TopNav from "@/components/layout/TopNav";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  type AnnouncementRecord,
} from "@/models/announcement-center";
import { readStoredUser } from "@/models/rbac";
import type { AppRole } from "@/models/rbac";

interface PortalConfig {
  homeHref: string;
  links: Array<{ label: string; href: string }>;
  title: string;
}

const CONFIG_BY_ROLE: Record<AppRole, PortalConfig> = {
  SUPER_ADMIN: {
    homeHref: "/admin",
    links: [
      { label: "Dashboard", href: "/admin" },
      { label: "Announcements", href: "/announcements" },
      { label: "Notifications", href: "/notifications" },
    ],
    title: "Announcements",
  },
  LECTURER: {
    homeHref: "/lecturer",
    links: [
      { label: "Dashboard", href: "/lecturer" },
      { label: "Announcements", href: "/announcements" },
      { label: "Notifications", href: "/notifications" },
    ],
    title: "Announcements",
  },
  LOST_ITEM_STAFF: {
    homeHref: "/lost-items",
    links: [
      { label: "Dashboard", href: "/lost-items" },
      { label: "Announcements", href: "/announcements" },
      { label: "Notifications", href: "/notifications" },
    ],
    title: "Announcements",
  },
  STUDENT: {
    homeHref: "/student",
    links: [
      { label: "Dashboard", href: "/student" },
      { label: "Announcements", href: "/announcements" },
      { label: "Notifications", href: "/notifications" },
    ],
    title: "Announcements",
  },
};

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

function actorLabel(actor: AnnouncementRecord["author"]) {
  const chunks: string[] = [];
  if (actor.name) chunks.push(actor.name);
  if (actor.role) chunks.push(actor.role);
  if (actor.email) chunks.push(actor.email);
  if (actor.userId) chunks.push(`ID: ${actor.userId}`);
  return chunks.join(" • ") || "Unknown user";
}

export default function AnnouncementsPortalPage() {
  const [sessionUser, setSessionUser] = useState<ReturnType<typeof readStoredUser>>(null);
  const role = sessionUser?.role ?? "STUDENT";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const config = CONFIG_BY_ROLE[role] ?? CONFIG_BY_ROLE.STUDENT;

  const [items, setItems] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [activeId, setActiveId] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await listAnnouncements({
        includeDeleted: isSuperAdmin && showDeleted,
      });
      setItems(rows);
    } catch (loadError) {
      setItems([]);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load announcements."
      );
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, showDeleted]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    setSessionUser(readStoredUser());
  }, []);

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

  const closeCompose = (force = false) => {
    if (isSaving && !force) {
      return;
    }
    setIsComposeOpen(false);
    setIsEditMode(false);
    setActiveId("");
    setTitle("");
    setMessage("");
    setFormError("");
  };

  const openCreate = () => {
    setIsEditMode(false);
    setActiveId("");
    setTitle("");
    setMessage("");
    setFormError("");
    setIsComposeOpen(true);
  };

  const openEdit = (item: AnnouncementRecord) => {
    setIsEditMode(true);
    setActiveId(item.id);
    setTitle(item.title);
    setMessage(item.message);
    setFormError("");
    setIsComposeOpen(true);
  };

  const saveAnnouncement = async () => {
    if (isSaving) {
      return;
    }

    const nextTitle = collapseSpaces(title);
    const nextMessage = collapseSpaces(message);
    if (!nextTitle || !nextMessage) {
      setFormError("Title and message are required.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      if (isEditMode) {
        await updateAnnouncement(activeId, {
          title: nextTitle,
          message: nextMessage,
          targetLabel: "All users",
        });
      } else {
        await createAnnouncement({
          title: nextTitle,
          message: nextMessage,
          targetLabel: "All users",
        });
      }

      closeCompose(true);
      await loadAnnouncements();
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : "Failed to save announcement."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const removeAnnouncement = async (item: AnnouncementRecord) => {
    if (deletingId) {
      return;
    }
    const confirmed = window.confirm(`Delete announcement "${item.title}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    setError("");
    try {
      await deleteAnnouncement(item.id);
      await loadAnnouncements();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete announcement."
      );
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <TopNav homeHref={config.homeHref} links={config.links} />
      <main className="px-0 pb-8 pt-20">
        <Container size="6xl">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-semibold text-heading">{config.title}</h1>
                <p className="mt-2 text-sm text-text/75">
                  All roles can publish announcements. Admin can delete any announcement.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="h-11 min-w-[130px] gap-2 rounded-2xl bg-[#034aa6] px-5 text-white hover:bg-[#0339a6]"
                  onClick={openCreate}
                >
                  <Plus size={16} />
                  New
                </Button>
                <Button
                  className="h-11 min-w-[130px] gap-2 rounded-2xl px-4"
                  onClick={() => {
                    void loadAnnouncements();
                  }}
                  variant="secondary"
                >
                  <RefreshCw size={16} />
                  Refresh
                </Button>
                {isSuperAdmin ? (
                  <Button
                    className="h-11 min-w-[154px] gap-2 rounded-2xl px-4"
                    onClick={() => setShowDeleted((current) => !current)}
                    variant="secondary"
                  >
                    {showDeleted ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showDeleted ? "Hide Deleted" : "Show Deleted"}
                  </Button>
                ) : null}
                {role === "SUPER_ADMIN" ? (
                  <Link
                    className="inline-flex h-11 min-w-[164px] items-center justify-center rounded-2xl border border-border bg-white px-5 text-sm font-medium text-heading hover:bg-tint"
                    href="/admin/communication/announcements"
                  >
                    Admin View
                  </Link>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-3">
              {loading ? (
                <div className="rounded-3xl border border-border bg-card p-6 text-sm text-text/70">
                  Loading announcements...
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-3xl border border-border bg-card p-6 text-sm text-text/70">
                  No announcements available yet.
                </div>
              ) : (
                items.map((item) => {
                  const updatedChanged = item.updatedAt !== item.createdAt;
                  return (
                    <div
                      className="rounded-3xl border border-border bg-card p-5"
                      key={item.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-heading">{item.title}</p>
                            <Badge variant={item.isDeleted ? "danger" : "success"}>
                              {item.isDeleted ? "Deleted" : "Published"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-text/60">
                            {item.targetLabel} • {formatDateTime(item.createdAt)}
                          </p>
                        </div>

                        {!item.isDeleted ? (
                          <div className="flex items-center gap-2">
                            {item.canEdit ? (
                              <Button
                                className="h-9 gap-2 rounded-xl px-3"
                                onClick={() => openEdit(item)}
                                variant="secondary"
                              >
                                <Edit3 size={14} />
                                Edit
                              </Button>
                            ) : null}
                            {item.canDelete ? (
                              <Button
                                className="h-9 gap-2 rounded-xl px-3"
                                disabled={deletingId === item.id}
                                onClick={() => {
                                  void removeAnnouncement(item);
                                }}
                                variant="danger"
                              >
                                <Trash2 size={14} />
                                {deletingId === item.id ? "Deleting..." : "Delete"}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <p className="mt-3 text-sm leading-6 text-text/80">{item.message}</p>
                      <p className="mt-3 text-xs text-text/60">Published by {item.createdBy}</p>

                      {updatedChanged ? (
                        <p className="mt-1 text-xs text-text/60">
                          Updated at {formatDateTime(item.updatedAt)}
                        </p>
                      ) : null}

                      {isSuperAdmin ? (
                        <div className="mt-3 space-y-1 rounded-2xl border border-border bg-tint px-3 py-2 text-xs text-text/70">
                          <p>Author: {actorLabel(item.author)}</p>
                          <p>Updated by: {actorLabel(item.lastUpdatedBy)}</p>
                          {item.isDeleted ? (
                            <p>
                              Deleted by: {actorLabel(item.deletedByInfo)} •{" "}
                              {formatDateTime(item.deletedAt)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Container>
      </main>

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
                    {isEditMode ? "UPDATE" : "CREATE"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-heading">
                    {isEditMode ? "Edit Announcement" : "Add Announcement"}
                  </p>
                </div>
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading"
                  onClick={() => closeCompose()}
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
                    id="announcement-title"
                    maxLength={180}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g., Midterm schedule update"
                    value={title}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-heading" htmlFor="announcement-message">
                    Message
                  </label>
                  <Textarea
                    id="announcement-message"
                    maxLength={3000}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Write a clear message for all users."
                    value={message}
                  />
                </div>

                {formError ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {formError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="border-t border-border bg-white px-6 py-4">
              <div className="flex justify-end gap-2.5">
                <Button
                  className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                  disabled={isSaving}
                  onClick={() => closeCompose()}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 min-w-[150px] gap-2 bg-[#034aa6] px-5 text-white hover:bg-[#0339a6]"
                  disabled={isSaving}
                  onClick={() => {
                    void saveAnnouncement();
                  }}
                >
                  {isEditMode ? <Megaphone size={16} /> : <Send size={16} />}
                  {isSaving ? "Saving..." : isEditMode ? "Update" : "Publish"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
