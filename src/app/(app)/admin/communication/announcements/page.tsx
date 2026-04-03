"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit3, Plus, RefreshCw, Send, Trash2, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  type AnnouncementRecord,
} from "@/models/announcement-center";

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

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listAnnouncements({ includeDeleted: true });
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

      toast({
        title: isEditMode ? "Updated" : "Published",
        message: isEditMode
          ? "Announcement updated successfully."
          : "Announcement published for all users.",
        variant: "success",
      });
      closeCompose(true);
      await loadAnnouncements();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save announcement.");
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
    try {
      await deleteAnnouncement(item.id);
      toast({
        title: "Deleted",
        message: "Announcement deleted successfully.",
        variant: "success",
      });
      await loadAnnouncements();
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to delete announcement",
        variant: "error",
      });
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="h-11 min-w-[180px] justify-center gap-2 rounded-2xl bg-[#034aa6] px-5 text-white hover:bg-[#0339a6]"
              onClick={openCreate}
            >
              <Plus size={16} />
              Add Announcement
            </Button>
            <Button
              className="h-11 min-w-[160px] justify-center gap-2 rounded-2xl px-5"
              onClick={() => {
                void loadAnnouncements();
              }}
              variant="secondary"
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
          </div>
        }
        description="All announcements with audit trail. Admin can edit/delete any announcement."
        title="Announcements"
      />

      <Card title="Published and Deleted Announcements">
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
                      <div className="flex flex-wrap items-center gap-2">
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

                  <div className="mt-3 space-y-1 rounded-2xl border border-border bg-tint px-3 py-2 text-xs text-text/70">
                    <p>Published by: {item.createdBy}</p>
                    <p>Author account: {actorLabel(item.author)}</p>
                    <p>Updated by: {actorLabel(item.lastUpdatedBy)}</p>
                    {updatedChanged ? (
                      <p>Last updated at: {formatDateTime(item.updatedAt)}</p>
                    ) : null}
                    {item.isDeleted ? (
                      <p>
                        Deleted by: {actorLabel(item.deletedByInfo)} •{" "}
                        {formatDateTime(item.deletedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })
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
                  <Send size={16} />
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
