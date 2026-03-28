"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Filter, ListChecks } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
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

const ALL_STATUSES: ReportStatus[] = ["OPEN", "REVIEWED", "AGREED", "DISMISSED"];

type CategoryFilter = "all" | ReportedPost["category"];

export default function ReportedPostsFiltersPage() {
  const [reports, setReports] = useState<ReportedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusToggled, setStatusToggled] = useState<Record<ReportStatus, boolean>>(() => ({
    OPEN: true,
    REVIEWED: true,
    AGREED: true,
    DISMISSED: true,
  }));
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [priority, setPriority] = useState<"all" | ReportedPost["priority"]>("all");
  const [searchRaw, setSearchRaw] = useState("");

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

  const searchNorm = searchRaw.trim().toLowerCase();

  const filtered = useMemo(() => {
    const activeStatuses = ALL_STATUSES.filter((s) => statusToggled[s]);
    const q = searchNorm;
    let list = reports.filter((r) => activeStatuses.includes(r.status));
    if (category !== "all") {
      list = list.filter((r) => r.category === category);
    }
    if (priority !== "all") {
      list = list.filter((r) => r.priority === priority);
    }
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.reason,
          r.postTitle,
          r.postSummary,
          r.postAuthor,
          r.reportedBy,
          r.postId,
          r.id,
          r.reviewComment,
          categoryLabel(r.category),
          r.priority,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list.slice().sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return tb - ta;
      return b.id.localeCompare(a.id);
    });
  }, [category, priority, reports, searchNorm, statusToggled]);

  const statusCounts = useMemo(() => {
    const base: Record<ReportStatus, number> = {
      OPEN: 0,
      REVIEWED: 0,
      AGREED: 0,
      DISMISSED: 0,
    };
    for (const r of reports) {
      base[r.status] += 1;
    }
    return base;
  }, [reports]);

  const clearFilters = () => {
    setStatusToggled({
      OPEN: true,
      REVIEWED: true,
      AGREED: true,
      DISMISSED: true,
    });
    setCategory("all");
    setPriority("all");
    setSearchRaw("");
  };

  const anyStatusOn = ALL_STATUSES.some((s) => statusToggled[s]);

  return (
    <div className="space-y-6 pb-6 md:space-y-8" id="report-filters-top">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/75">
            Reported posts
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-heading sm:text-2xl">
            Filters &amp; search
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-text/72">
            Narrow the full report list, then open a row in the main queue to review and act.
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
        title="Filter reports"
        description="Combine moderation status, post category, priority, and text search. Text matches reason, title, summary, author, reporter, IDs, admin comment, and labels."
        className="border-l-[3px] border-l-sky-500 bg-gradient-to-br from-card to-sky-500/[0.05]"
      >
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text/65">
              Moderation status
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {ALL_STATUSES.map((s) => (
                <label
                  key={s}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm transition-colors",
                    statusToggled[s]
                      ? "border-primary/35 bg-primary/[0.06] text-heading"
                      : "border-border/80 bg-card text-text/70"
                  )}
                >
                  <input
                    checked={statusToggled[s]}
                    className="h-4 w-4 rounded border-border text-primary"
                    onChange={() =>
                      setStatusToggled((prev) => ({ ...prev, [s]: !prev[s] }))
                    }
                    type="checkbox"
                  />
                  <span>{reportStatusLabel(s)}</span>
                  <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-text/60">
                    {statusCounts[s]}
                  </span>
                </label>
              ))}
            </div>
            {!anyStatusOn ? (
              <p className="mt-2 text-xs text-amber-800" role="status">
                Select at least one status to see results.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.1em] text-text/65">
                Post category
              </label>
              <Select
                className="mt-1.5"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              >
                <option value="all">All categories</option>
                <option value="academic_question">Academic question</option>
                <option value="study_material">Study material</option>
                <option value="lost_item">Lost item</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.1em] text-text/65">
                Priority (from reason type)
              </label>
              <Select
                className="mt-1.5"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "all" | ReportedPost["priority"])
                }
              >
                <option value="all">All priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </Select>
            </div>
          </div>

          <div>
            <label
              className="text-xs font-semibold uppercase tracking-[0.1em] text-text/65"
              htmlFor="report-search"
            >
              Search
            </label>
            <Input
              className="mt-1.5"
              id="report-search"
              placeholder="Reason, title, author, post id, report id…"
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button className="h-9" onClick={clearFilters} type="button" variant="secondary">
              Reset filters
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title="Matching reports"
        description={
          loading
            ? "Loading…"
            : error
              ? error
              : `Showing ${filtered.length} of ${reports.length} loaded reports.` +
                (reports.length === 0 ? "" : "")
        }
        className="border-l-[3px] border-l-amber-500 bg-gradient-to-br from-card to-amber-500/[0.04]"
      >
        {error ? (
          <p className="rounded-2xl border border-dashed border-rose-200/80 bg-rose-50/50 px-4 py-8 text-center text-sm text-rose-900/80">
            {error}
          </p>
        ) : loading ? (
          <p className="rounded-2xl border border-dashed border-sky-200/70 bg-sky-50/40 px-4 py-8 text-center text-sm text-slate-600">
            Loading reports…
          </p>
        ) : !anyStatusOn ? (
          <p className="rounded-2xl border border-dashed border-amber-200/80 bg-amber-50/50 px-4 py-8 text-center text-sm text-amber-950/85">
            Turn on at least one status above to see matches.
          </p>
        ) : filtered.length === 0 ? (
          <p className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-600">
            <Filter className="text-slate-400" size={22} aria-hidden />
            No reports match these filters. Try widening search or reset filters.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((report) => (
              <li
                key={report.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/90 bg-card px-3.5 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={reportStatusVariant(report.status)}>
                      {reportStatusLabel(report.status)}
                    </Badge>
                    <span className="text-[11px] text-text/55">
                      {categoryLabel(report.category)} · {report.priority}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-heading line-clamp-1">
                    {report.postTitle}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-text/80 line-clamp-2 whitespace-pre-wrap">
                    {report.reason}
                  </p>
                  <p className="mt-1.5 text-[11px] text-text/50">
                    Post{" "}
                    <span className="font-mono text-text/65">{report.postId}</span>
                    · {report.reportedAt}
                  </p>
                </div>
                <Link
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-border bg-card px-4 text-sm font-medium text-text shadow-sm transition-all hover:bg-tint sm:self-center",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  )}
                  href={`/community-admin/reported-posts?openReport=${encodeURIComponent(
                    report.id
                  )}&status=${encodeURIComponent(report.status)}`}
                >
                  <ListChecks size={16} aria-hidden />
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
