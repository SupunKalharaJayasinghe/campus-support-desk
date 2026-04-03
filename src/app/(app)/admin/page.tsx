"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Clock3,
  GraduationCap,
  Layers3,
  Megaphone,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  listLatestAnnouncements,
  type AnnouncementRecord,
} from "@/models/announcement-center";
import {
  listNotificationsForUser,
  type NotificationFeedItem,
} from "@/models/notification-center";
import { readStoredUser } from "@/models/rbac";
import LatestNotificationSection from "@/components/notifications/LatestNotificationSection";

type StatIcon = ComponentType<{ size?: number }>;

interface StatisticCard {
  label: string;
  value: string;
  growth: string;
  growthLabel: string;
  icon: StatIcon;
}

interface DistributionItem {
  label: string;
  value: number;
  meta: string;
}

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  time: string;
}

interface AlertItem {
  id: string;
  title: string;
  detail: string;
  level: "High" | "Medium";
}

const STATISTICS: StatisticCard[] = [
  {
    label: "Total Students",
    value: "1,284",
    growth: "+4.8%",
    growthLabel: "vs last intake",
    icon: Users,
  },
  {
    label: "Total Faculties",
    value: "5",
    growth: "+1",
    growthLabel: "new school added",
    icon: Building2,
  },
  {
    label: "Degree Programs",
    value: "12",
    growth: "+2",
    growthLabel: "curriculum refreshes",
    icon: GraduationCap,
  },
  {
    label: "Lecturers / Instructors",
    value: "86",
    growth: "+6.2%",
    growthLabel: "staff capacity",
    icon: UserCheck,
  },
  {
    label: "Total Modules",
    value: "94",
    growth: "+5",
    growthLabel: "new offerings",
    icon: BookOpen,
  },
  {
    label: "Active Intakes",
    value: "6",
    growth: "+1",
    growthLabel: "upcoming cycle",
    icon: CalendarDays,
  },
];

const STUDENTS_PER_FACULTY: DistributionItem[] = [
  { label: "Faculty of Computing", value: 412, meta: "FOC" },
  { label: "Faculty of Engineering", value: 286, meta: "FOE" },
  { label: "Faculty of Business", value: 228, meta: "FOB" },
  { label: "Faculty of Science", value: 204, meta: "FOS" },
  { label: "Faculty of Design", value: 154, meta: "FOD" },
];

const STUDENTS_PER_DEGREE: DistributionItem[] = [
  { label: "Software Engineering", value: 286, meta: "SE" },
  { label: "Computer Science", value: 248, meta: "CS" },
  { label: "Information Technology", value: 198, meta: "IT" },
  { label: "Civil Engineering", value: 142, meta: "CE" },
  { label: "Business Analytics", value: 118, meta: "BA" },
];

const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: "act-01",
    title: "34 new student registrations approved",
    detail: "FOC / SE / 2026 June intake enrollment sync completed",
    time: "12 mins ago",
  },
  {
    id: "act-02",
    title: "Module offering created for SE304",
    detail: "Advanced Software Project Management opened for Weekday stream",
    time: "46 mins ago",
  },
  {
    id: "act-03",
    title: "Lecturer assignment updated",
    detail: "Dr. A. Fernando assigned as LIC for CS202",
    time: "1 hr ago",
  },
  {
    id: "act-04",
    title: "Assignment deadline published",
    detail: "Database Systems lab submission deadline pushed to subgroup 2.2",
    time: "2 hrs ago",
  },
];

const ALERTS: AlertItem[] = [
  {
    id: "alert-01",
    title: "7 upcoming assignment deadlines",
    detail: "Deadlines across SE201, CS105, and IT118 close within the next 48 hours.",
    level: "High",
  },
  {
    id: "alert-02",
    title: "3 modules without assigned lecturers",
    detail: "Module offerings in the Faculty of Business still require teaching allocations.",
    level: "High",
  },
  {
    id: "alert-03",
    title: "2 subgroups without timetable sessions",
    detail: "Weekend subgroup scheduling remains incomplete for the active Y1S1 intake.",
    level: "Medium",
  },
];

const QUICK_ACTIONS = [
  "Add Faculty",
  "Create Degree Program",
  "Create Intake",
  "Add Lecturer",
  "Publish Announcement",
];

function StatOverviewCard({ growth, growthLabel, icon: Icon, label, value }: StatisticCard) {
  return (
    <Card accent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-heading">{value}</p>
        </div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary">
          <TrendingUp size={12} />
          {growth}
        </span>
        <span className="text-xs text-text/60">{growthLabel}</span>
      </div>
    </Card>
  );
}

function DistributionList({ items }: { items: DistributionItem[] }) {
  const maxValue = Math.max(...items.map((item) => item.value));

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-heading">{item.label}</p>
              <p className="mt-0.5 text-xs text-text/60">{item.meta}</p>
            </div>
            <p className="text-sm font-semibold text-heading">{item.value}</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-200/70">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.max(12, Math.round((item.value / maxValue) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

export default function AdminDashboardPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationFeedItem[]>([]);
  const latestNotification = notifications[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    const currentUser = readStoredUser();
    void Promise.all([
      listLatestAnnouncements(15).catch(() => [] as AnnouncementRecord[]),
      listNotificationsForUser(currentUser, "SUPER_ADMIN").catch(
        () => [] as NotificationFeedItem[]
      ),
    ]).then(([rows, scopedNotifications]) => {
      if (cancelled) {
        return;
      }
      setAnnouncements(rows);
      setNotifications(scopedNotifications.slice(0, 3));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        description="Centralized oversight for academic structure, enrollments, teaching operations, and system-wide alerts."
        title="Dashboard"
      />

      <LatestNotificationSection
        href="/notifications"
        item={latestNotification}
        subtitle="Most recent notification targeted to admin users."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {STATISTICS.map((item) => (
          <StatOverviewCard key={item.label} {...item} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card
          accent
          description="Operational academic metrics across faculties, degrees, and active delivery groups."
          title="Academic Overview"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-heading">Students per Faculty</p>
                <Badge variant="neutral">Current intake</Badge>
              </div>
              <div className="mt-5">
                <DistributionList items={STUDENTS_PER_FACULTY} />
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-heading">Students per Degree</p>
                  <Badge variant="neutral">Top programs</Badge>
                </div>
                <div className="mt-5">
                  <DistributionList items={STUDENTS_PER_DEGREE} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-border bg-card p-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <CalendarDays size={18} />
                  </span>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Current Active Term
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-heading">Y1S1</p>
                  <p className="mt-1 text-sm text-text/60">2026 June Intake</p>
                </div>

                <div className="rounded-3xl border border-border bg-card p-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Layers3 size={18} />
                  </span>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Total Subgroups
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-heading">38</p>
                  <p className="mt-1 text-sm text-text/60">Across weekday and weekend streams</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card
          description="Latest communication posted by the super admin team."
          title="Announcement Preview"
        >
          <div className="space-y-4">
            {announcements.length === 0 ? (
              <div className="rounded-3xl border border-border bg-card p-5 text-sm text-text/70">
                No announcements available yet.
              </div>
            ) : (
              announcements.map((item) => (
                <div className="rounded-3xl border border-border bg-card p-5" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-heading">{item.title}</p>
                      <p className="mt-1 text-xs text-text/60">{item.targetLabel}</p>
                    </div>
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Megaphone size={16} />
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-medium text-text/55">
                    {formatDateTime(item.createdAt)}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-text/72">{item.message}</p>
                </div>
              ))
            )}
            <Link
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-heading hover:bg-tint"
              href="/announcements"
            >
              View All
            </Link>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card
          description="Recent platform events across enrollments, teaching allocation, and coursework setup."
          title="Recent Activity"
        >
          <div className="space-y-4">
            {RECENT_ACTIVITY.map((item, index) => (
              <div className="flex gap-4" key={item.id}>
                <div className="flex flex-col items-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Clock3 size={16} />
                  </span>
                  {index === RECENT_ACTIVITY.length - 1 ? null : (
                    <span className="mt-2 h-full w-px bg-border" />
                  )}
                </div>
                <div className="min-w-0 rounded-3xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-heading">{item.title}</p>
                  <p className="mt-1 text-sm text-text/68">{item.detail}</p>
                  <p className="mt-3 text-xs font-medium text-text/55">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card
            description="Fast access to common super admin workflows."
            title="Quick Actions"
          >
            <div className="grid gap-3">
              {QUICK_ACTIONS.map((item, index) => (
                <Button
                  className="justify-between"
                  key={item}
                  variant={index === QUICK_ACTIONS.length - 1 ? "primary" : "secondary"}
                >
                  {item}
                  <ArrowRight size={14} />
                </Button>
              ))}
            </div>
          </Card>

          <Card
            description="Priority issues that need intervention from academic operations."
            title="Important Alerts"
          >
            <div className="space-y-3">
              {ALERTS.map((item) => (
                <div className="rounded-3xl border border-border bg-card p-4" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <AlertTriangle size={16} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-heading">{item.title}</p>
                        <p className="mt-1 text-sm text-text/68">{item.detail}</p>
                      </div>
                    </div>
                    <Badge variant={item.level === "High" ? "warning" : "neutral"}>{item.level}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            description="Notifications and system announcements visible to admin users."
            title="Recent Notifications"
          >
            <div className="space-y-3">
              {notifications.map((item) => (
                <div className="rounded-3xl border border-border bg-card p-4" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant={item.type === "Announcement" ? "success" : "warning"}>
                        {item.type}
                      </Badge>
                      <p className="mt-2 text-sm font-semibold text-heading">{item.title}</p>
                      <p className="mt-1 text-sm text-text/68">{item.message}</p>
                    </div>
                    <p className="text-xs text-text/55">{item.time}</p>
                  </div>
                </div>
              ))}
              {notifications.length === 0 ? (
                <div className="rounded-3xl border border-border bg-card p-4 text-sm text-text/68">
                  No notifications available.
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

