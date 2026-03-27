"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
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

export default function CommunityAdminReportedPostsPage() {
  const [reports, setReports] = useState<ReportedPost[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportStatusFilter, setReportStatusFilter] = useState<"" | ReportStatus>("");
  const [detailReportId, setDetailReportId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReportsLoading(true);
      setReportsError(null);
      try {
        const response = await fetch("/api/community-post-reports");
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

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (!reportStatusFilter) return true;
      return report.status === reportStatusFilter;
    });
  }, [reportStatusFilter, reports]);

  useEffect(() => {
    if (!detailReportId) return;
    const stillVisible = filteredReports.some((r) => r.id === detailReportId);
    if (!stillVisible) {
      setDetailReportId("");
    }
  }, [detailReportId, filteredReports]);

  const detailReport =
    detailReportId && filteredReports.some((r) => r.id === detailReportId)
      ? filteredReports.find((r) => r.id === detailReportId) ?? null
      : null;

  const modalOpen = Boolean(detailReport);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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

  const updateReportStatus = async (id: string, nextStatus: ReportStatus) => {
    const response = await fetch(`/api/community-post-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) {
      return;
    }
    const raw: unknown = await response.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      setReports((previous) =>
        previous.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
      );
      return;
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
    setReports((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              updatedAt: updatedIso ?? item.updatedAt,
            }
          : item
      )
    );
  };

  const closeModal = () => setDetailReportId("");

  const markReviewed = async () => {
    if (!detailReport || detailReport.status !== "OPEN") return;
    await updateReportStatus(detailReport.id, "REVIEWED");
    closeModal();
  };

  const markAgreed = async () => {
    if (!detailReport || detailReport.status !== "OPEN") return;
    await updateReportStatus(detailReport.id, "AGREED");
    closeModal();
  };

  const markDismissed = async () => {
    if (!detailReport || detailReport.status !== "OPEN") return;
    await updateReportStatus(detailReport.id, "DISMISSED");
    closeModal();
  };

  return (
    <div className="space-y-6 pb-6 md:space-y-8">
      <section id="filters" className="scroll-mt-6">
        <Card
          title="Filters"
          description="Filter the report queue by status."
          className="border-l-[3px] border-l-sky-500 bg-gradient-to-br from-card to-sky-500/[0.04]"
        >
          <Select
            value={reportStatusFilter}
            onChange={(event) => setReportStatusFilter(event.target.value as "" | ReportStatus)}
          >
            <option value="">All report status</option>
            <option value="OPEN">Open</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="AGREED">Agreed</option>
            <option value="DISMISSED">Dismissed</option>
          </Select>
        </Card>
      </section>

      <section id="reports" className="scroll-mt-6">
        <Card
          title="Reported Posts"
          description="Only the report reason is shown here. Use Check post to open full details in a popup."
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
          ) : filteredReports.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-600">
              {reports.length === 0
                ? "No post reports yet."
                : "No reports match this status filter."}
            </p>
          ) : (
            <div className="space-y-2.5">
              {filteredReports.map((report) => {
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
                    <p className="min-w-0 flex-1 text-sm leading-relaxed text-heading whitespace-pre-wrap">
                      {report.reason}
                    </p>
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
                  {detailReport.status !== "OPEN" ? (
                    <span className="text-xs text-text/65">This report is already closed.</span>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-sky-200/60 bg-sky-50/40 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-sky-800/70">Report ID</p>
                    <p className="mt-1 break-all text-sm font-semibold text-heading">
                      {detailReport.id}
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
                  <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 px-3 py-3">
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
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-card bg-white px-5 py-4">
              <p className="text-xs text-text/60">
                <span className="font-medium text-sky-800">Reviewed</span> marks it seen without
                siding.{" "}
                <span className="font-medium text-emerald-800">Agree</span> confirms the report.{" "}
                <span className="font-medium text-red-800">Dismissed</span> rejects the report.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="h-10 !border-sky-500 !bg-sky-500 !text-white shadow-sm hover:!border-sky-600 hover:!bg-sky-600 disabled:!opacity-60"
                  disabled={detailReport.status !== "OPEN"}
                  onClick={markReviewed}
                  type="button"
                  variant="secondary"
                >
                  Reviewed
                </Button>
                <Button
                  className="h-10 !border-emerald-600 !bg-emerald-600 !text-white hover:!border-emerald-700 hover:!bg-emerald-700 disabled:!opacity-60"
                  disabled={detailReport.status !== "OPEN"}
                  onClick={markAgreed}
                  type="button"
                  variant="secondary"
                >
                  Agree
                </Button>
                <Button
                  className="h-10"
                  disabled={detailReport.status !== "OPEN"}
                  onClick={markDismissed}
                  type="button"
                  variant="danger"
                >
                  Dismissed
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
