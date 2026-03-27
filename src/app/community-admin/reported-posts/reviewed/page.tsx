"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import Card from "@/components/ui/Card";
import {
  mapApiReportToRow,
  type ReportedPost,
} from "@/app/community-admin/_lib/reports";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function truncateText(text: string, maxLen: number) {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

export default function ReviewedReportPostsPage() {
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

  const reviewed = useMemo(
    () =>
      reports
        .filter((r) => r.status === "REVIEWED")
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
    <div className="space-y-6 pb-6 md:space-y-8" id="reviewed-reports-top">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/75">
            Reported posts
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-heading sm:text-2xl">
            Reviewed report posts
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-text/72">
            Reports with a saved admin review. Open a row in the main queue to update the note, accept,
            or dismiss.
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
        title={`Reviewed (${reviewed.length})`}
        description="Each row shows the saved admin review snippet. Use Open in queue to moderate in the full workflow (update comment, accept, or dismiss)."
        className="border-l-[3px] border-l-sky-600 bg-gradient-to-br from-card to-sky-500/[0.05]"
      >
        {error ? (
          <p className="rounded-2xl border border-dashed border-rose-200/80 bg-rose-50/50 px-4 py-8 text-center text-sm text-rose-900/80">
            {error}
          </p>
        ) : loading ? (
          <p className="rounded-2xl border border-dashed border-sky-200/70 bg-sky-50/40 px-4 py-8 text-center text-sm text-slate-600">
            Loading reports…
          </p>
        ) : reviewed.length === 0 ? (
          <p className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-600">
            <ClipboardList className="text-slate-400" size={22} aria-hidden />
            No reviewed reports yet. Save an admin review from an open report to see it here.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {reviewed.map((report) => {
              const hasAdminNote = report.reviewComment.trim().length > 0;
              return (
                <li
                  key={report.id}
                  className="flex flex-col gap-3 rounded-2xl border border-sky-200/70 bg-gradient-to-br from-card to-sky-500/[0.03] px-3.5 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-800/80">
                      Admin review
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-heading whitespace-pre-wrap">
                      {hasAdminNote
                        ? truncateText(report.reviewComment, 320)
                        : "— No admin review saved yet —"}
                    </p>
                    <p className="mt-2 text-[11px] text-text/50">
                      Post ID <span className="font-mono text-text/70">{report.postId}</span>
                      {" · "}
                      {report.reportedAt}
                    </p>
                  </div>
                  <Link
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 sm:self-center",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    )}
                    href={`/community-admin/reported-posts?openReport=${encodeURIComponent(
                      report.id
                    )}&status=REVIEWED`}
                  >
                    Open in queue
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
