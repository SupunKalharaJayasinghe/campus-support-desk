"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Textarea from "@/components/ui/Textarea";
import {
  categoryLabel,
  mapApiReportToRow,
  type ReportedPost,
  type ReportStatus,
} from "@/app/community-admin/_lib/reports";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function reportStatusVariant(status: ReportStatus) {
  if (status === "OPEN") return "danger" as const;
  if (status === "REVIEWED") return "info" as const;
  if (status === "AGREED") return "success" as const;
  return "warning" as const;
}

function reportStatusLabel(status: ReportStatus) {
  if (status === "OPEN") return "Open";
  if (status === "REVIEWED") return "Reviewed";
  if (status === "AGREED") return "Agreed";
  return "Dismissed";
}

function isLikelyMongoObjectId(value: string) {
  return /^[a-f\d]{24}$/i.test(value.trim());
}

function CommunityAdminReportedPostsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<ReportedPost[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [detailReportId, setDetailReportId] = useState("");
  const [adminReviewAcknowledged, setAdminReviewAcknowledged] = useState(false);
  const [reviewCommentDraft, setReviewCommentDraft] = useState("");
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReportsLoading(true);
      setReportsError(null);
      try {
        const response = await fetch("/api/community-post-reports", { cache: "no-store" });
        const data: unknown = await response.json();
        if (!response.ok) {
          if (!cancelled) {
            setReports([]);
            setReportsError(
              typeof data === "object" && data !== null && "error" in data
                ? String((data as { error: unknown }).error)
                : "Could not load reports."
            );
          }
          return;
        }
        if (!Array.isArray(data)) {
          if (!cancelled) {
            setReports([]);
            setReportsError("Invalid report response.");
          }
          return;
        }
        const next = data
          .map((row) => mapApiReportToRow(row))
          .filter((m): m is ReportedPost => Boolean(m));
        if (!cancelled) setReports(next);
      } catch {
        if (!cancelled) {
          setReports([]);
          setReportsError("Could not load reports.");
        }
      } finally {
        if (!cancelled) setReportsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reportsLoading) return;
    const openReport = searchParams.get("openReport");
    const statusParam = searchParams.get("status");

    if (openReport) {
      const row = reports.find((r) => r.id === openReport);
      if (row) {
        setDetailReportId(openReport);
      }
    }

    if (openReport || statusParam) {
      router.replace("/community-admin/reported-posts", { scroll: false });
    }
  }, [reports, reportsLoading, router, searchParams]);

  /** Open reports only — main queue (use dedicated pages for other statuses). */
  const openReportQueue = useMemo(
    () => reports.filter((r) => r.status === "OPEN"),
    [reports]
  );

  useEffect(() => {
    if (!detailReportId) return;
    const exists = reports.some((r) => r.id === detailReportId);
    if (!exists) {
      setDetailReportId("");
    }
  }, [detailReportId, reports]);

  useEffect(() => {
    if (!detailReportId) return;
    const r = reports.find((x) => x.id === detailReportId);
    if (!r) return;
    setModerationError(null);
    if (r.status === "OPEN") {
      setReviewCommentDraft("");
      setAdminReviewAcknowledged(false);
    } else if (!r.reviewComment.trim() || !r.adminReviewAcknowledged) {
      setReviewCommentDraft("");
      setAdminReviewAcknowledged(false);
    } else {
      setReviewCommentDraft(r.reviewComment);
      setAdminReviewAcknowledged(r.adminReviewAcknowledged);
    }
  }, [detailReportId, reports]);

  const detailReport =
    detailReportId && reports.some((r) => r.id === detailReportId)
      ? reports.find((r) => r.id === detailReportId) ?? null
      : null;

  /** Closed without stored review metadata (API used to skip persisting comment after OPEN). */
  const needsReviewBackfill = Boolean(
    detailReport &&
      detailReport.status !== "OPEN" &&
      (!detailReport.reviewComment.trim() || !detailReport.adminReviewAcknowledged)
  );

  const modalOpen = Boolean(detailReport);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModerationError(null);
        setDetailReportId("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modalOpen]);

  const persistAdminReview = async (
    id: string,
    moderation: {
      adminReviewAcknowledged: boolean;
      reviewComment: string;
    }
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const response = await fetch(`/api/community-post-reports/${id}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saveAdminReview: true,
        adminReviewAcknowledged: moderation.adminReviewAcknowledged,
        reviewComment: moderation.reviewComment,
      }),
    });
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        raw !== null &&
        typeof raw === "object" &&
        "error" in raw &&
        typeof (raw as { error: unknown }).error === "string"
          ? (raw as { error: string }).error
          : "Could not save admin review.";
      return { ok: false, error: message };
    }
    if (!raw || typeof raw !== "object") {
      setReports((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                status: item.status === "OPEN" ? "REVIEWED" : item.status,
                adminReviewAcknowledged: moderation.adminReviewAcknowledged,
                reviewComment: moderation.reviewComment.trim(),
              }
            : item
        )
      );
      return { ok: true };
    }
    const doc = raw as Record<string, unknown>;
    const updatedRaw = doc.updatedAt;
    const updatedIso =
      updatedRaw instanceof Date
        ? updatedRaw.toISOString()
        : typeof updatedRaw === "string"
          ? updatedRaw
          : undefined;
    const savedAck = doc.adminReviewAcknowledged === true;
    const savedComment =
      typeof doc.reviewComment === "string" ? doc.reviewComment.trim() : moderation.reviewComment.trim();
    setReports((previous) =>
      previous.map((item) => {
        if (item.id !== id) return item;
        const statusRaw = String(doc.status ?? "").toUpperCase();
        const parsed: ReportStatus | null =
          statusRaw === "REVIEWED" ||
          statusRaw === "AGREED" ||
          statusRaw === "DISMISSED" ||
          statusRaw === "OPEN"
            ? statusRaw
            : null;
        const status = parsed ?? (item.status === "OPEN" ? "REVIEWED" : item.status);
        return {
          ...item,
          status,
          updatedAt: updatedIso ?? item.updatedAt,
          adminReviewAcknowledged: savedAck,
          reviewComment: savedComment,
        };
      })
    );
    return { ok: true };
  };

  const updateReportStatus = async (
    id: string,
    nextStatus: ReportStatus,
    moderation: {
      adminReviewAcknowledged: boolean;
      reviewComment: string;
    }
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const response = await fetch(`/api/community-post-reports/${id}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: nextStatus,
        adminReviewAcknowledged: moderation.adminReviewAcknowledged,
        reviewComment: moderation.reviewComment,
      }),
    });
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        raw !== null &&
        typeof raw === "object" &&
        "error" in raw &&
        typeof (raw as { error: unknown }).error === "string"
          ? (raw as { error: string }).error
          : "Could not update report.";
      return { ok: false, error: message };
    }
    if (!raw || typeof raw !== "object") {
      setReports((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                status: nextStatus,
                adminReviewAcknowledged: moderation.adminReviewAcknowledged,
                reviewComment: moderation.reviewComment.trim(),
              }
            : item
        )
      );
      return { ok: true };
    }
    const doc = raw as Record<string, unknown>;
    const statusRaw = String(doc.status ?? nextStatus).toUpperCase();
    const status: ReportStatus =
      statusRaw === "REVIEWED" ||
      statusRaw === "AGREED" ||
      statusRaw === "DISMISSED" ||
      statusRaw === "OPEN"
        ? statusRaw
        : nextStatus;
    const updatedRaw = doc.updatedAt;
    const updatedIso =
      updatedRaw instanceof Date
        ? updatedRaw.toISOString()
        : typeof updatedRaw === "string"
          ? updatedRaw
          : undefined;
    const savedAck = doc.adminReviewAcknowledged === true;
    const savedComment =
      typeof doc.reviewComment === "string" ? doc.reviewComment.trim() : moderation.reviewComment.trim();
    setReports((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              updatedAt: updatedIso ?? item.updatedAt,
              adminReviewAcknowledged: savedAck,
              reviewComment: savedComment,
            }
          : item
      )
    );
    return { ok: true };
  };

  const closeModal = () => {
    setModerationError(null);
    setDetailReportId("");
  };

  /** Open report + “As community admin I review…” + non-empty review comment. */
  const canSubmitReviewed =
    detailReport?.status === "OPEN" &&
    adminReviewAcknowledged &&
    reviewCommentDraft.trim().length > 0;

  const canSubmitBackfill =
    needsReviewBackfill &&
    adminReviewAcknowledged &&
    reviewCommentDraft.trim().length > 0;

  const saveOpenAdminReview = async () => {
    if (!detailReport || detailReport.status !== "OPEN") return;
    if (!canSubmitReviewed) {
      setModerationError(
        "Tick “As community admin I review this post” and enter a review comment before saving."
      );
      return;
    }
    setModerationError(null);
    const result = await persistAdminReview(detailReport.id, {
      adminReviewAcknowledged: true,
      reviewComment: reviewCommentDraft.trim(),
    });
    if (!result.ok) {
      setModerationError(result.error);
      return;
    }
    closeModal();
    window.setTimeout(() => router.push("/community-admin/reported-posts/reviewed"), 100);
  };

  const saveReviewBackfill = async () => {
    if (!detailReport || !needsReviewBackfill) return;
    if (!canSubmitBackfill) {
      setModerationError(
        'Tick “As community admin I review this post” and enter a review comment before saving.'
      );
      return;
    }
    setModerationError(null);
    const result = await persistAdminReview(detailReport.id, {
      adminReviewAcknowledged: true,
      reviewComment: reviewCommentDraft.trim(),
    });
    if (!result.ok) {
      setModerationError(result.error);
      return;
    }
    closeModal();
    if (detailReport.status === "REVIEWED") {
      window.setTimeout(() => router.push("/community-admin/reported-posts/reviewed"), 100);
    }
  };

  const finalReviewComment = () => reviewCommentDraft.trim();

  const canActWithSavedReview =
    detailReport?.status === "REVIEWED" &&
    !needsReviewBackfill &&
    adminReviewAcknowledged &&
    finalReviewComment().length > 0;

  const saveReviewedCommentUpdate = async () => {
    if (!detailReport || detailReport.status !== "REVIEWED" || needsReviewBackfill) return;
    if (!canActWithSavedReview) {
      setModerationError(
        "Confirm the checkbox and enter an admin review comment before updating."
      );
      return;
    }
    setModerationError(null);
    const result = await persistAdminReview(detailReport.id, {
      adminReviewAcknowledged: true,
      reviewComment: finalReviewComment(),
    });
    if (!result.ok) {
      setModerationError(result.error);
      return;
    }
  };

  const acceptReviewedReport = async () => {
    if (!detailReport || detailReport.status !== "REVIEWED" || needsReviewBackfill) return;
    if (!canActWithSavedReview) {
      setModerationError(
        "Confirm the checkbox and enter an admin review comment before accepting this report."
      );
      return;
    }
    setModerationError(null);
    const result = await updateReportStatus(detailReport.id, "AGREED", {
      adminReviewAcknowledged: true,
      reviewComment: finalReviewComment(),
    });
    if (!result.ok) {
      setModerationError(result.error);
      return;
    }
    closeModal();
    window.setTimeout(() => router.push("/community-admin/reported-posts/confirmed"), 100);
  };

  const deleteAgreedPost = async () => {
    if (!detailReport || detailReport.status !== "AGREED") return;
    const postId = detailReport.postId.trim();
    if (!isLikelyMongoObjectId(postId)) {
      setModerationError("Cannot delete: missing or invalid post id.");
      return;
    }
    const ok = window.confirm(
      "Delete this community post permanently? Replies, likes, and all reports for this post will be removed. This cannot be undone."
    );
    if (!ok) return;
    setModerationError(null);
    setDeleteInProgress(true);
    try {
      const response = await fetch(`/api/community-posts/${encodeURIComponent(postId)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      const raw: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          raw !== null &&
          typeof raw === "object" &&
          "error" in raw &&
          typeof (raw as { error: unknown }).error === "string"
            ? (raw as { error: string }).error
            : "Could not delete post.";
        setModerationError(message);
        return;
      }
      setReports((previous) => previous.filter((r) => r.postId.trim() !== postId));
      closeModal();
    } finally {
      setDeleteInProgress(false);
    }
  };

  const dismissReviewedReport = async () => {
    if (!detailReport || detailReport.status !== "REVIEWED" || needsReviewBackfill) return;
    if (!canActWithSavedReview) {
      setModerationError(
        "Confirm the checkbox and enter an admin review comment before dismissing this report."
      );
      return;
    }
    setModerationError(null);
    const result = await updateReportStatus(detailReport.id, "DISMISSED", {
      adminReviewAcknowledged: true,
      reviewComment: finalReviewComment(),
    });
    if (!result.ok) {
      setModerationError(result.error);
      return;
    }
    closeModal();
    window.setTimeout(() => router.push("/community-admin/reported-posts/dismissed"), 100);
  };

  const reportRowList = (list: ReportedPost[]) => (
    <div className="space-y-2.5">
      {list.map((report) => {
        const opened = modalOpen && detailReportId === report.id;
        return (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-2xl border px-3.5 py-3 shadow-sm transition-colors sm:flex-row sm:items-start sm:justify-between",
              opened
                ? "border-primary/40 bg-gradient-to-r from-primary/[0.12] to-sky-500/[0.08] ring-1 ring-primary/15"
                : "border-border/90 bg-card hover:border-amber-200/80 hover:bg-amber-50/25"
            )}
            key={report.id}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text/55">
                Post ID
              </p>
              <p className="mt-0.5 break-all font-mono text-xs text-heading/90">{report.postId}</p>
              <p className="mt-2 text-sm leading-relaxed text-heading whitespace-pre-wrap">
                {report.reason}
              </p>
            </div>
            <Button
              className="h-9 shrink-0 sm:self-center"
              onClick={() => setDetailReportId(report.id)}
              type="button"
              variant="secondary"
            >
              Check post
            </Button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6 pb-6 md:space-y-8">
      <section id="reports" className="scroll-mt-6">
        <Card
          title="Report queue (open reports only)"
          description="Pending reports with status Open. After you save an admin review, the report moves to the Reviewed posts page. Use the sidebar for filters, reviewed, confirmed, and dismissed lists."
          className="border-l-[3px] border-l-amber-500 bg-gradient-to-br from-card to-amber-500/[0.04]"
        >
          {reportsError ? (
            <p className="rounded-2xl border border-dashed border-rose-200/80 bg-rose-50/50 px-4 py-8 text-center text-sm text-rose-900/80">
              {reportsError}
            </p>
          ) : reportsLoading ? (
            <p className="rounded-2xl border border-dashed border-sky-200/70 bg-sky-50/40 px-4 py-8 text-center text-sm text-slate-600">
              Loading reports…
            </p>
          ) : openReportQueue.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-600">
              {reports.length === 0
                ? "No post reports yet."
                : "No open reports in the queue."}
            </p>
          ) : (
            reportRowList(openReportQueue)
          )}
        </Card>
      </section>

      {detailReport ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
          role="presentation"
        >
          <div
            aria-labelledby="report-detail-modal-title"
            aria-modal="true"
            className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-card bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)] ring-1 ring-primary/10"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 bg-gradient-to-r from-primary/[0.08] via-sky-500/[0.05] to-transparent px-5 py-4">
              <div className="min-w-0">
                <p
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-primary/80"
                  id="report-detail-modal-title"
                >
                  Reported post details
                </p>
                <p className="mt-1 text-lg font-semibold text-heading">Review and decide</p>
              </div>
              <Button
                aria-label="Close"
                className="h-9 w-9 shrink-0 p-0"
                onClick={closeModal}
                type="button"
                variant="ghost"
              >
                <X size={18} aria-hidden />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={reportStatusVariant(detailReport.status)}>
                    {reportStatusLabel(detailReport.status)}
                  </Badge>
                  {detailReport.status === "REVIEWED" ? (
                    <span className="text-xs text-text/65">
                      Update your notes, then accept or dismiss the report.
                    </span>
                  ) : detailReport.status !== "OPEN" ? (
                    <span className="text-xs text-text/65">This report is closed.</span>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-sky-200/60 bg-sky-50/40 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-sky-800/70">Report ID</p>
                    <p className="mt-1 break-all text-sm font-semibold text-heading">
                      {detailReport.id}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/40 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-indigo-900/70">Post ID</p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold text-heading">
                      {detailReport.postId}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-violet-200/60 bg-violet-50/35 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-violet-800/70">Category</p>
                    <p className="mt-1 text-sm font-semibold text-heading">
                      {categoryLabel(detailReport.category)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/35 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-emerald-800/70">Reported By</p>
                    <p className="mt-1 text-sm font-semibold text-heading">
                      {detailReport.reportedBy}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 px-3 py-3 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.08em] text-amber-900/65">Post Author</p>
                    <p className="mt-1 text-sm font-semibold text-heading">
                      {detailReport.postAuthor}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/80 to-sky-50/30 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-slate-600">Post title</p>
                  <p className="mt-1 text-sm font-medium text-heading">{detailReport.postTitle}</p>

                  <p className="mt-4 text-xs uppercase tracking-[0.08em] text-text/60">Reason</p>
                  <p className="mt-1 text-sm leading-6 text-heading whitespace-pre-wrap">
                    {detailReport.reason}
                  </p>

                  <p className="mt-4 text-xs uppercase tracking-[0.08em] text-text/60">Post summary</p>
                  <p className="mt-1 text-sm leading-6 text-text/85">{detailReport.postSummary}</p>

                  <p className="mt-4 text-xs uppercase tracking-[0.08em] text-text/60">Reported At</p>
                  <p className="mt-1 text-sm text-text/85">{detailReport.reportedAt}</p>
                </div>

                {detailReport.status === "OPEN" ? (
                  <div
                    aria-labelledby="admin-review-form-title"
                    className="rounded-2xl border-2 border-dashed border-primary/35 bg-gradient-to-br from-primary/[0.07] to-sky-500/[0.05] px-4 py-4 shadow-sm"
                    role="group"
                  >
                    <p
                      className="text-xs font-semibold uppercase tracking-[0.08em] text-primary"
                      id="admin-review-form-title"
                    >
                      Admin review form
                    </p>
                    <p className="mt-1 text-sm text-heading">
                      Complete this, then click <strong className="text-primary">Save admin review</strong>.
                      Your acknowledgment and comment are stored on this report (open reports move to{" "}
                      <strong className="text-primary">Reviewed</strong>).
                    </p>
                    <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-card px-3 py-2.5 shadow-sm">
                      <input
                        checked={adminReviewAcknowledged}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-focus"
                        id="admin-review-ack"
                        onChange={(event) => {
                          setAdminReviewAcknowledged(event.target.checked);
                          setModerationError(null);
                        }}
                        type="checkbox"
                      />
                      <span className="text-sm leading-snug text-heading">
                        As community admin I review this post{" "}
                        <span className="text-rose-600">*</span>
                      </span>
                    </label>
                    <label className="mt-3 block" htmlFor="admin-review-comment">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-text/70">
                        Admin review comment <span className="text-rose-600">*</span>
                      </span>
                      <Textarea
                        className="mt-1.5 min-h-[100px]"
                        id="admin-review-comment"
                        maxLength={4000}
                        onChange={(event) => {
                          setReviewCommentDraft(event.target.value);
                          setModerationError(null);
                        }}
                        placeholder="Explain what you checked and why you chose this outcome…"
                        value={reviewCommentDraft}
                      />
                    </label>
                  </div>
                ) : null}

                {detailReport.status === "REVIEWED" && !needsReviewBackfill ? (
                  <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 to-sky-50/40 px-4 py-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-indigo-900/80">
                      Community admin review
                    </p>
                    <p className="mt-1 text-sm text-text/80">
                      Edit your admin review below. Use <strong className="text-indigo-800">Update comment</strong>{" "}
                      to save changes, or <strong className="text-emerald-800">Accept</strong> /{" "}
                      <strong className="text-rose-800">Dismiss</strong> for a final decision.
                    </p>
                    <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-100 bg-white/90 px-3 py-2.5 shadow-sm">
                      <input
                        checked={adminReviewAcknowledged}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-border text-indigo-600 focus-visible:ring-2 focus-visible:ring-focus"
                        id="admin-review-ack-reviewed"
                        onChange={(event) => {
                          setAdminReviewAcknowledged(event.target.checked);
                          setModerationError(null);
                        }}
                        type="checkbox"
                      />
                      <span className="text-sm leading-snug text-heading">
                        As community admin I confirm this review and any decision I apply{" "}
                        <span className="text-rose-600">*</span>
                      </span>
                    </label>
                    <label className="mt-3 block" htmlFor="admin-review-comment-reviewed">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-text/70">
                        Admin review comment <span className="text-rose-600">*</span>
                      </span>
                      <Textarea
                        className="mt-1.5 min-h-[120px] border-indigo-100"
                        id="admin-review-comment-reviewed"
                        maxLength={4000}
                        onChange={(event) => {
                          setReviewCommentDraft(event.target.value);
                          setModerationError(null);
                        }}
                        placeholder="Your notes on the post and the reporter’s reason…"
                        value={reviewCommentDraft}
                      />
                    </label>
                  </div>
                ) : null}

                {(detailReport.status === "AGREED" || detailReport.status === "DISMISSED") ||
                (detailReport.status === "REVIEWED" && needsReviewBackfill) ? (
                  <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Community admin review (recorded)
                    </p>
                    {detailReport.status === "REVIEWED" && needsReviewBackfill ? (
                      <p className="mt-2 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-sm text-amber-950/85">
                        This report is already reviewed but has no saved admin review in the database.
                        Complete the form below and click{" "}
                        <strong className="font-semibold">Save admin review</strong>.
                      </p>
                    ) : detailReport.adminReviewAcknowledged ? (
                      <p className="mt-2 text-sm text-emerald-800">
                        Recorded by community admin.
                      </p>
                    ) : null}
                    {detailReport.status !== "REVIEWED" || !needsReviewBackfill ? (
                      <>
                        <p className="mt-3 text-xs uppercase tracking-[0.08em] text-text/60">
                          Admin review comment
                        </p>
                        <p className="mt-1 min-h-[1.5rem] text-sm leading-6 text-heading whitespace-pre-wrap">
                          {detailReport.reviewComment
                            ? detailReport.reviewComment
                            : "No comment was stored for this report."}
                        </p>
                      </>
                    ) : null}
                    {detailReport.status === "REVIEWED" && needsReviewBackfill ? (
                      <div
                        aria-labelledby="admin-review-backfill-title"
                        className="mt-4 rounded-2xl border-2 border-dashed border-primary/35 bg-gradient-to-br from-primary/[0.07] to-sky-500/[0.05] px-4 py-4 shadow-sm"
                        role="group"
                      >
                        <p
                          className="text-xs font-semibold uppercase tracking-[0.08em] text-primary"
                          id="admin-review-backfill-title"
                        >
                          Record admin review
                        </p>
                        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-card px-3 py-2.5 shadow-sm">
                          <input
                            checked={adminReviewAcknowledged}
                            className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-focus"
                            id="admin-review-ack-backfill"
                            onChange={(event) => {
                              setAdminReviewAcknowledged(event.target.checked);
                              setModerationError(null);
                            }}
                            type="checkbox"
                          />
                          <span className="text-sm leading-snug text-heading">
                            As community admin I review this post{" "}
                            <span className="text-rose-600">*</span>
                          </span>
                        </label>
                        <label className="mt-3 block" htmlFor="admin-review-comment-backfill">
                          <span className="text-xs font-medium uppercase tracking-[0.08em] text-text/70">
                            Admin review comment <span className="text-rose-600">*</span>
                          </span>
                          <Textarea
                            className="mt-1.5 min-h-[100px]"
                            id="admin-review-comment-backfill"
                            maxLength={4000}
                            onChange={(event) => {
                              setReviewCommentDraft(event.target.value);
                              setModerationError(null);
                            }}
                            placeholder="Explain what you checked and why you recorded this outcome…"
                            value={reviewCommentDraft}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-card bg-white px-5 py-4">
              <p className="text-xs text-text/60">
                {detailReport.status === "OPEN" ? (
                  <>
                    <span className="font-medium text-sky-800">Save admin review</span> is enabled only after
                    the form above is complete.{" "}
                  </>
                ) : needsReviewBackfill ? (
                  <>
                    <span className="font-medium text-sky-800">Save admin review</span> stores your
                    comment on this closed report.{" "}
                  </>
                ) : detailReport.status === "REVIEWED" && !needsReviewBackfill ? (
                  <>
                    <span className="font-medium text-indigo-800">Update comment</span> saves your note
                    and keeps status as Reviewed.{" "}
                    <span className="font-medium text-emerald-800">Accept report</span> agrees with the
                    reporter; <span className="font-medium text-rose-800">Dismiss report</span> rejects
                    it.{" "}
                  </>
                ) : detailReport.status === "AGREED" ? (
                  <>
                    <span className="font-medium text-rose-800">Delete post</span> removes the post from the
                    community along with its replies, likes, and all reports for that post.
                  </>
                ) : detailReport.status === "DISMISSED" ? (
                  <>This decision is final for this workflow. </>
                ) : null}
                <span className="font-medium text-heading">Cancel</span> closes without saving.
              </p>
              {moderationError ? (
                <p
                  className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-900"
                  role="alert"
                >
                  {moderationError}
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {detailReport.status === "OPEN" ? (
                  <Button
                    className="h-10 !border-sky-500 !bg-sky-500 !text-white shadow-sm hover:!border-sky-600 hover:!bg-sky-600 disabled:!opacity-60"
                    disabled={!canSubmitReviewed}
                    onClick={saveOpenAdminReview}
                    type="button"
                    variant="secondary"
                  >
                    Save admin review
                  </Button>
                ) : null}
                {needsReviewBackfill ? (
                  <Button
                    className="h-10 !border-sky-500 !bg-sky-500 !text-white shadow-sm hover:!border-sky-600 hover:!bg-sky-600 disabled:!opacity-60"
                    disabled={!canSubmitBackfill}
                    onClick={saveReviewBackfill}
                    type="button"
                    variant="secondary"
                  >
                    Save admin review
                  </Button>
                ) : null}
                {detailReport.status === "REVIEWED" && !needsReviewBackfill ? (
                  <>
                    <Button
                      className="h-10 !border-indigo-700 !bg-indigo-600 !text-white shadow-sm hover:!bg-indigo-700 disabled:!opacity-60"
                      disabled={!canActWithSavedReview}
                      onClick={saveReviewedCommentUpdate}
                      type="button"
                      variant="secondary"
                    >
                      Update
                    </Button>
                    <Button
                      className="h-10 !border-emerald-800 !bg-emerald-600 !text-white shadow-sm hover:!bg-emerald-700 disabled:!opacity-60"
                      disabled={!canActWithSavedReview}
                      onClick={acceptReviewedReport}
                      type="button"
                      variant="secondary"
                    >
                      Accept
                    </Button>
                    <Button
                      className="h-10 !border-rose-900 !bg-rose-600 !text-white shadow-sm hover:!bg-rose-700 disabled:!opacity-60"
                      disabled={!canActWithSavedReview}
                      onClick={dismissReviewedReport}
                      type="button"
                      variant="secondary"
                    >
                      Dismiss
                    </Button>
                  </>
                ) : null}
                {detailReport.status === "AGREED" ? (
                  <Button
                    className="h-10 !border-rose-900 !bg-rose-600 !text-white shadow-sm hover:!bg-rose-700 disabled:!opacity-60"
                    disabled={deleteInProgress || !isLikelyMongoObjectId(detailReport.postId)}
                    onClick={deleteAgreedPost}
                    type="button"
                    variant="secondary"
                  >
                    {deleteInProgress ? "Deleting…" : "Delete post"}
                  </Button>
                ) : null}
                <Button
                  className="h-10 border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 sm:ml-auto"
                  disabled={deleteInProgress}
                  onClick={closeModal}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CommunityAdminReportedPostsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 pb-6 md:space-y-8">
          <Card
            title="Report queue"
            description="Loading moderation workspace..."
            className="border-l-[3px] border-l-amber-500 bg-gradient-to-br from-card to-amber-500/[0.04]"
          >
            <p className="rounded-2xl border border-dashed border-sky-200/70 bg-sky-50/40 px-4 py-8 text-center text-sm text-slate-600">
              Loading reports...
            </p>
          </Card>
        </div>
      }
    >
      <CommunityAdminReportedPostsPageContent />
    </Suspense>
  );
}
