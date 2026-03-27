"use client";

import { useMemo } from "react";
import Card from "@/components/ui/Card";
import type { ReportedPost, ReportStatus } from "@/app/community-admin/_lib/reports";

type Props = {
  activeMemberCount: number;
  warnedMemberCount: number;
  suspendedMemberCount: number;
  membersLoading: boolean;
  reports: ReportedPost[];
  reportsLoading: boolean;
};

const REPORT_ORDER: ReportStatus[] = ["OPEN", "REVIEWED", "AGREED", "DISMISSED"];

const REPORT_LABEL: Record<ReportStatus, string> = {
  OPEN: "Open",
  REVIEWED: "Reviewed",
  AGREED: "Agreed",
  DISMISSED: "Dismissed",
};

const REPORT_BAR_CLASS: Record<ReportStatus, string> = {
  OPEN: "bg-rose-500",
  REVIEWED: "bg-sky-600",
  AGREED: "bg-emerald-600",
  DISMISSED: "bg-slate-500",
};

/** Illustrative 7-day series for dashboard preview only (not tied to live analytics). */
const DEMO_TREND_POINTS = [8, 12, 10, 16, 14, 19, 15];

function MemberStatusDonut({
  active,
  warned,
  suspended,
  loading,
}: {
  active: number;
  warned: number;
  suspended: number;
  loading: boolean;
}) {
  const total = active + warned + suspended;
  const seg = useMemo(() => {
    if (total <= 0) return { endActive: 0, endWarned: 0 };
    return {
      endActive: (active / total) * 360,
      endWarned: ((active + warned) / total) * 360,
    };
  }, [active, warned, suspended, total]);

  if (loading) {
    return (
      <div
        className="mx-auto flex h-44 w-44 items-center justify-center rounded-full border border-dashed border-slate-200 bg-slate-50/80 text-sm text-text/60"
        aria-hidden
      >
        …
      </div>
    );
  }

  if (total <= 0) {
    return (
      <div className="mx-auto flex h-44 w-44 flex-col items-center justify-center rounded-full border border-slate-200 bg-slate-50/60 text-center text-sm text-text/65">
        <span>No members</span>
        <span className="mt-1 text-xs text-text/50">Chart appears when directory has rows</span>
      </div>
    );
  }

  const { endActive, endWarned } = seg;
  const gradient = `conic-gradient(
    rgb(5 150 105) 0deg ${endActive}deg,
    rgb(245 158 11) ${endActive}deg ${endWarned}deg,
    rgb(225 29 72) ${endWarned}deg 360deg
  )`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-44 w-44">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: gradient }}
          role="img"
          aria-label={`Member mix: ${active} active, ${warned} warned, ${suspended} suspended`}
        />
        <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full border border-white/80 bg-card text-center shadow-inner">
          <p className="text-2xl font-bold tabular-nums text-heading">{total}</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-text/55">members</p>
        </div>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
        <li className="flex items-center gap-1.5 text-text/80">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" aria-hidden />
          Active ({active})
        </li>
        <li className="flex items-center gap-1.5 text-text/80">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden />
          Warned ({warned})
        </li>
        <li className="flex items-center gap-1.5 text-text/80">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" aria-hidden />
          Suspended ({suspended})
        </li>
      </ul>
    </div>
  );
}

function ReportStatusBars({ reports, loading }: { reports: ReportedPost[]; loading: boolean }) {
  const counts = useMemo(() => {
    const m: Record<ReportStatus, number> = {
      OPEN: 0,
      REVIEWED: 0,
      AGREED: 0,
      DISMISSED: 0,
    };
    for (const r of reports) {
      m[r.status] += 1;
    }
    return m;
  }, [reports]);

  const max = Math.max(1, ...REPORT_ORDER.map((k) => counts[k]));

  if (loading) {
    return (
      <div className="flex h-36 items-end justify-center gap-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-sm text-text/60">
        <span className="self-center">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex h-40 items-end justify-between gap-2 px-1 sm:gap-3" role="img" aria-label="Report counts by moderation status">
      {REPORT_ORDER.map((key) => {
        const n = counts[key];
        const pct = (n / max) * 100;
        return (
          <div key={key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full max-w-[4rem] items-end justify-center sm:max-w-[5rem]">
              <div
                className={`w-full max-w-[3rem] rounded-t-lg transition-all ${REPORT_BAR_CLASS[key]}`}
                style={{ height: `${Math.max(pct, n > 0 ? 8 : 4)}%` }}
                title={`${REPORT_LABEL[key]}: ${n}`}
              />
            </div>
            <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-text/70 sm:text-xs">
              {REPORT_LABEL[key]}
            </span>
            <span className="text-sm font-semibold tabular-nums text-heading">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

function DemoActivitySparkline() {
  const w = 100;
  const h = 36;
  const pad = 4;
  const vals = DEMO_TREND_POINTS;
  const vmin = Math.min(...vals);
  const vmax = Math.max(...vals);
  const span = Math.max(vmax - vmin, 1);
  const n = vals.length;
  const coords = vals.map((v, i) => {
    const x = pad + (i / (n - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - vmin) / span) * (h - pad * 2);
    return { x, y };
  });
  const pathD = coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${h - pad} L ${coords[0].x.toFixed(1)} ${h - pad} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-24 w-full text-primary"
        preserveAspectRatio="none"
        aria-label="Demo activity trend over seven days (illustrative)"
      >
        <defs>
          <linearGradient id="adminDemoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(37 99 235)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(37 99 235)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#adminDemoFill)" />
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wide text-text/50">
        <span>Mon</span>
        <span>Sun</span>
      </div>
    </div>
  );
}

export default function AdminOverviewCharts(props: Props) {
  return (
    <div id="overview-charts" className="scroll-mt-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-heading md:text-xl">At a glance</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text/70">
          Visual summaries from your current data, plus an illustrative trend for layout demos.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Member status mix"
          description="Share of the directory by moderation state."
          className="border-l-[3px] border-l-emerald-600 bg-card/95"
        >
          <MemberStatusDonut
            active={props.activeMemberCount}
            warned={props.warnedMemberCount}
            suspended={props.suspendedMemberCount}
            loading={props.membersLoading}
          />
        </Card>
        <Card
          title="Reports by status"
          description="How many reports sit in each workflow stage today."
          className="border-l-[3px] border-l-violet-500 bg-card/95"
        >
          <ReportStatusBars reports={props.reports} loading={props.reportsLoading} />
        </Card>
        <Card
          title="Activity trend (demo)"
          description="Sample 7-day sparkline for presentation—replace with real analytics when you wire a metrics API."
          className="border-l-[3px] border-l-sky-500 bg-card/95"
        >
          <DemoActivitySparkline />
        </Card>
      </div>
    </div>
  );
}
