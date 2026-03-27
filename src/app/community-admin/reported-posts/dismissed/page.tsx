"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Ban } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
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

function truncateText(text: string, maxLen: number) {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

export default function DismissedReportPostsPage() {
  const [reports, setReports] = useState<ReportedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/community-post-reports", { cache: "no-store" });
        const data: unknown = await response.json();
        if (!response.ok) {
          if (!cancelled) {
            setReports([]);
            setError(
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
            setError("Invalid report response.");
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
          setError("Could not load reports.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissed = useMemo(
    () =>
      reports
        .filter((r) => r.status === "DISMISSED")
        .slice()
        .sort((a, b) => {
          const ta = new Date(a.updatedAt).getTime();
          const tb = new Date(b.updatedAt).getTime();
          if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return tb - ta;
          return b.id.localeCompare(a.id);
        }),
    [reports]
  );

  return (
    <div className="space-y-6 pb-6 md:space-y-8" id="dismissed-reports-top">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/75">
            Reported posts
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-heading sm:text-2xl">
            Report dismissed posts
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-text/72">
            Reports you dismissed after review (status Dismissed). Open a row in the main queue for read-only
            details and recorded admin notes.
          </p>
        </div>
        <Link
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-medium tracking-[0.01em] text-text shadow-sm transition-all hover:bg-tint",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          )}
          href="/community-admin/reported-posts#reports"
        >
          Back to queue
        </Link>
      </div>

      <Card
        title={`Dismissed (${dismissed.length})`}
        description="You rejected these reports after recording an admin review. The main queue shows the full thread when you open a row."
        className="border-l-[3px] border-l-rose-400 bg-gradient-to-br from-card to-rose-500/[0.04]"
      >
        {error ? (
          <p className="rounded-2xl border border-dashed border-rose-200/80 bg-rose-50/50 px-4 py-8 text-center text-sm text-rose-900/80">
            {error}
          </p>
        ) : loading ? (
          <p className="rounded-2xl border border-dashed border-sky-200/70 bg-sky-50/40 px-4 py-8 text-center text-sm text-slate-600">
            Loading reports…
          </p>
        ) : dismissed.length === 0 ? (
          <p className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-600">
            <Ban className="text-rose-400/90" size={22} aria-hidden />
            No dismissed reports yet. Dismiss a reviewed report from the main queue to see it here.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {dismissed.map((report) => (
              <li
                key={report.id}
                className="flex flex-col gap-3 rounded-2xl border border-rose-200/75 bg-gradient-to-br from-card to-rose-500/[0.05] px-3.5 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={reportStatusVariant(report.status)}>
                      {reportStatusLabel(report.status)}
                    </Badge>
                    <span className="text-[11px] text-text/55">{categoryLabel(report.category)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-heading line-clamp-2">{report.postTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-heading/90 whitespace-pre-wrap">
                    {truncateText(report.reason, 280)}
                  </p>
                  <p className="mt-2 text-[11px] text-text/50">
                    Post ID <span className="font-mono text-text/70">{report.postId}</span>
                    {" · "}
                    {report.reportedAt}
                  </p>
                  {report.reviewComment.trim() ? (
                    <p className="mt-2 rounded-lg border border-rose-100/90 bg-rose-50/45 px-2.5 py-2 text-xs text-text/80">
                      Admin note: {truncateText(report.reviewComment, 200)}
                    </p>
                  ) : null}
                </div>
                <Link
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center justify-center rounded-2xl border border-rose-800/90 bg-rose-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700 sm:self-center",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  )}
                  href={`/community-admin/reported-posts?openReport=${encodeURIComponent(
                    report.id
                  )}&status=DISMISSED`}
                >
                  Open in queue
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
