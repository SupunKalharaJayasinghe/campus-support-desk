"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Clock3,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Ticket,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserCog,
  UserPlus2,
  Users,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";

type TrendDirection = "up" | "down";

interface KpiMetric {
  id: string;
  label: string;
  value: string;
  trend: string;
  context: string;
  direction: TrendDirection;
}

interface SectionCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const DATE_RANGES = [
  { label: "Last 7 days", value: "last_7_days" },
  { label: "Last 30 days", value: "last_30_days" },
  { label: "This Semester", value: "this_semester" },
];

const KPI_METRICS: KpiMetric[] = [
  {
    id: "kpi-total-users",
    label: "Total Users",
    value: "2,486",
    trend: "+3.2%",
    context: "vs last month",
    direction: "up",
  },
  {
    id: "kpi-active-users",
    label: "Active Users",
    value: "2,148",
    trend: "+4.5%",
    context: "vs last month",
    direction: "up",
  },
  {
    id: "kpi-total-students",
    label: "Total Students",
    value: "1,932",
    trend: "+2.8%",
    context: "vs last month",
    direction: "up",
  },
  {
    id: "kpi-open-tickets",
    label: "Open Support Tickets",
    value: "73",
    trend: "-1.1%",
    context: "vs last month",
    direction: "down",
  },
];

const ACADEMIC_SUMMARY = [
  { label: "Total Faculties", value: "8", icon: Building2 },
  { label: "Degree Programs", value: "26", icon: GraduationCap },
  { label: "Total Modules", value: "412", icon: BookOpen },
  { label: "Active Cohorts", value: "38", icon: Users },
];

const FACULTY_STUDENT_DISTRIBUTION = [
  { faculty: "Computing", count: 640 },
  { faculty: "Engineering", count: 520 },
  { faculty: "Business", count: 410 },
  { faculty: "Science", count: 362 },
];

const USER_DISTRIBUTION = [
  { role: "Students", count: 1932, icon: Users },
  { role: "Lecturers", count: 284, icon: UserCheck },
  { role: "Lost Item Officers", count: 34, icon: ShieldCheck },
  { role: "Administrators", count: 18, icon: UserCog },
];

const RECENT_ACTIVITY = [
  {
    id: "activity-1",
    icon: UserPlus2,
    description: "New user registered: Kalum Perera (Student)",
    time: "12 minutes ago",
  },
  {
    id: "activity-2",
    icon: Building2,
    description: "Faculty profile updated: Faculty of Engineering",
    time: "1 hour ago",
  },
  {
    id: "activity-3",
    icon: GraduationCap,
    description: "Degree program updated: BSc Software Engineering",
    time: "3 hours ago",
  },
  {
    id: "activity-4",
    icon: UserCheck,
    description: "User status changed: Lecturer account reactivated",
    time: "5 hours ago",
  },
  {
    id: "activity-5",
    icon: Ticket,
    description: "Support ticket assigned to Campus IT Services",
    time: "8 hours ago",
  },
];

const ATTENTION_ITEMS = [
  {
    id: "alert-1",
    title: "Suspended Users",
    value: "12",
    detail: "Requires verification review",
  },
  {
    id: "alert-2",
    title: "Pending Approvals",
    value: "9",
    detail: "User and role requests awaiting action",
  },
  {
    id: "alert-3",
    title: "System Warnings",
    value: "2",
    detail: "Notification service delay detected",
  },
];

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function StatCard({ metric }: { metric: KpiMetric }) {
  const TrendIcon = metric.direction === "up" ? TrendingUp : TrendingDown;

  return (
    <article className="rounded-3xl border border-black/15 bg-white p-6 shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#26150F]/62">
        {metric.label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#0A0A0A]">
        {metric.value}
      </p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
            metric.direction === "up"
              ? "border-[#034AA6]/25 bg-[#034AA6]/10 text-[#034AA6]"
              : "border-black/15 bg-black/5 text-[#26150F]/75"
          )}
        >
          <TrendIcon size={12} />
          {metric.trend}
        </span>
        <span className="text-xs text-[#26150F]/62">{metric.context}</span>
      </div>
    </article>
  );
}

function SectionCard({ title, description, action, children }: SectionCardProps) {
  return (
    <section className="rounded-3xl border border-black/15 bg-white p-6 shadow-[0_8px_24px_rgba(38,21,15,0.08)] lg:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#0A0A0A]">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-[#26150F]/70">{description}</p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const [dateRange, setDateRange] = useState(DATE_RANGES[0].value);

  const maxFacultyCount = useMemo(
    () =>
      Math.max(...FACULTY_STUDENT_DISTRIBUTION.map((item) => item.count)),
    []
  );

  const totalUsers = useMemo(
    () => USER_DISTRIBUTION.reduce((total, item) => total + item.count, 0),
    []
  );

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#0A0A0A]">
            Overview
          </h1>
          <p className="mt-1 text-sm text-[#26150F]/72">
            Platform insights and system summary
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="overview-date-range">
            Date range
          </label>
          <Select
            className="h-11 w-full rounded-xl sm:w-52"
            id="overview-date-range"
            onChange={(event) => setDateRange(event.target.value)}
            value={dateRange}
          >
            {DATE_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </Select>

          <Button
            aria-label="Refresh overview data"
            className="h-11 rounded-xl border-black/20 bg-white px-3 text-[#26150F] hover:border-[#0339A6]/60 hover:bg-[#034AA6]/5 hover:text-[#0339A6]"
            onClick={() => {
              console.log("Refresh overview requested");
            }}
            type="button"
            variant="secondary"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_METRICS.map((metric) => (
          <StatCard key={metric.id} metric={metric} />
        ))}
      </section>

      <SectionCard
        description="Core academic structure metrics and student footprint by faculty."
        title="Academic Overview"
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="grid gap-3 sm:grid-cols-2">
            {ACADEMIC_SUMMARY.map((metric) => {
              const Icon = metric.icon;
              return (
                <article
                  className="rounded-2xl border border-black/12 bg-white p-4"
                  key={metric.label}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#034AA6]/10 text-[#034AA6]">
                    <Icon size={16} />
                  </span>
                  <p className="mt-3 text-xs uppercase tracking-[0.1em] text-[#26150F]/62">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[#0A0A0A]">
                    {metric.value}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="rounded-2xl border border-black/12 bg-[#D9D9D9]/25 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[#0A0A0A]">
                Students per Faculty
              </p>
              <p className="text-xs text-[#26150F]/62">Current semester</p>
            </div>
            <div className="mt-4 space-y-3">
              {FACULTY_STUDENT_DISTRIBUTION.map((item) => (
                <div key={item.faculty}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#26150F]/78">{item.faculty}</span>
                    <span className="font-medium text-[#0A0A0A]">{item.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-black/10">
                    <div
                      className="h-2 rounded-full bg-[#034AA6]/80"
                      style={{
                        width: `${(item.count / maxFacultyCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <SectionCard
          description="Current user composition across operational roles."
          title="User Distribution"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {USER_DISTRIBUTION.map((item) => {
              const Icon = item.icon;
              const percent = Math.round((item.count / totalUsers) * 100);
              return (
                <article
                  className="rounded-2xl border border-black/12 bg-white p-4"
                  key={item.role}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#034AA6]/10 text-[#034AA6]">
                      <Icon size={16} />
                    </span>
                    <span className="text-xs text-[#26150F]/62">{percent}%</span>
                  </div>
                  <p className="mt-3 text-sm text-[#26150F]/72">{item.role}</p>
                  <p className="mt-1 text-2xl font-semibold text-[#0A0A0A]">
                    {item.count}
                  </p>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          description="Items that require immediate administrative review."
          title="Alerts & Attention"
        >
          <div className="space-y-3">
            {ATTENTION_ITEMS.map((item) => (
              <article
                className="rounded-2xl border border-black/12 bg-[#D9D9D9]/25 p-4"
                key={item.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#034AA6]/10 text-[#034AA6]">
                      <AlertTriangle size={14} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[#0A0A0A]">{item.title}</p>
                      <p className="mt-1 text-xs text-[#26150F]/68">{item.detail}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-black/12 bg-white px-2 py-0.5 text-xs font-medium text-[#26150F]/78">
                    {item.value}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        action={
          <button
            className="text-sm font-medium text-[#034AA6] transition-colors duration-200 hover:text-[#0339A6]"
            type="button"
          >
            View All
          </button>
        }
        description="Latest platform events and administrative changes."
        title="Recent Activity"
      >
        <div className="space-y-3">
          {RECENT_ACTIVITY.map((item) => {
            const Icon = item.icon;
            return (
              <article
                className="flex items-start justify-between gap-3 rounded-2xl border border-black/12 bg-white p-4"
                key={item.id}
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#034AA6]/10 text-[#034AA6]">
                    <Icon size={16} />
                  </span>
                  <p className="text-sm text-[#26150F]/82">{item.description}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-[#26150F]/60">
                  <Clock3 size={12} />
                  {item.time}
                </span>
              </article>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
