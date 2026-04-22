"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Clock3,
  GraduationCap,
  Layers3,
  LifeBuoy,
  Megaphone,
  UserCheck,
  Users,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
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

type StatIcon = ComponentType<{ size?: number }>;

interface DistributionItem {
  label: string;
  value: number;
  meta: string;
}

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
}

interface AlertItem {
  id: string;
  title: string;
  detail: string;
  level: "High" | "Medium";
}

interface DashboardPayload {
  stats: {
    totalStudents: number;
    activeStudents: number;
    totalFaculties: number;
    activeFaculties: number;
    totalDegreePrograms: number;
    activeDegreePrograms: number;
    totalLecturers: number;
    activeLecturers: number;
    totalModules: number;
    totalIntakes: number;
    activeIntakes: number;
    activeOfferingCount: number;
    totalSubgroups: number;
  };
  currentIntake: {
    name: string;
    currentTerm: string;
  } | null;
  studentsPerFaculty: DistributionItem[];
  studentsPerDegree: DistributionItem[];
  recentActivity: ActivityItem[];
  alerts: AlertItem[];
  ticketSummary: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
  };
  recentTickets: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    occurredAt: string;
  }[];
}

interface StatDefinition {
  key:
    | "students"
    | "faculties"
    | "degreePrograms"
    | "lecturers"
    | "modules"
    | "intakes";
  label: string;
  icon: StatIcon;
  tone: "sky" | "teal" | "violet" | "amber" | "green" | "rose";
}

const STAT_DEFINITIONS: StatDefinition[] = [
  { key: "students", label: "Total Students", icon: Users, tone: "sky" },
  { key: "faculties", label: "Total Faculties", icon: Building2, tone: "teal" },
  { key: "degreePrograms", label: "Degree Programs", icon: GraduationCap, tone: "violet" },
  { key: "lecturers", label: "Lecturers / Instructors", icon: UserCheck, tone: "green" },
  { key: "modules", label: "Total Modules", icon: BookOpen, tone: "amber" },
  { key: "intakes", label: "Active Intakes", icon: CalendarDays, tone: "rose" },
];

const QUICK_ACTIONS = [
  { label: "Add Faculty", href: "/admin/faculty" },
  { label: "Create Degree Program", href: "/admin/academics/degree-programs" },
  { label: "Create Intake", href: "/admin/academics/intakes" },
  { label: "Add Lecturer", href: "/admin/users/lecturers" },
  { label: "Publish Announcement", href: "/admin/announcements" },
] as const;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseDistributionItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as DistributionItem[];
  }

  return value
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const label = String(row.label ?? "").trim();
      const meta = String(row.meta ?? "").trim();
      const numericValue = Math.max(0, Number(row.value) || 0);
      if (!label) {
        return null;
      }

      return {
        label,
        value: numericValue,
        meta,
      } satisfies DistributionItem;
    })
    .filter((item): item is DistributionItem => Boolean(item));
}

function parseActivityItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as ActivityItem[];
  }

  return value
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const id = String(row.id ?? "").trim();
      const title = String(row.title ?? "").trim();
      const detail = String(row.detail ?? "").trim();
      const occurredAt = String(row.occurredAt ?? "").trim();
      if (!id || !title || !occurredAt) {
        return null;
      }

      return {
        id,
        title,
        detail,
        occurredAt,
      } satisfies ActivityItem;
    })
    .filter((item): item is ActivityItem => Boolean(item));
}

function parseAlerts(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AlertItem[];
  }

  return value
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const id = String(row.id ?? "").trim();
      const title = String(row.title ?? "").trim();
      const detail = String(row.detail ?? "").trim();
      const level = row.level === "High" ? "High" : "Medium";
      if (!id || !title || !detail) {
        return null;
      }

      return { id, title, detail, level } satisfies AlertItem;
    })
    .filter((item): item is AlertItem => Boolean(item));
}

function parseDashboardPayload(value: unknown): DashboardPayload | null {
  const root = asObject(value);
  const stats = asObject(root?.stats);
  if (!root || !stats) {
    return null;
  }

  const currentIntakeRow = asObject(root.currentIntake);

  return {
    stats: {
      totalStudents: Math.max(0, Number(stats.totalStudents) || 0),
      activeStudents: Math.max(0, Number(stats.activeStudents) || 0),
      totalFaculties: Math.max(0, Number(stats.totalFaculties) || 0),
      activeFaculties: Math.max(0, Number(stats.activeFaculties) || 0),
      totalDegreePrograms: Math.max(0, Number(stats.totalDegreePrograms) || 0),
      activeDegreePrograms: Math.max(0, Number(stats.activeDegreePrograms) || 0),
      totalLecturers: Math.max(0, Number(stats.totalLecturers) || 0),
      activeLecturers: Math.max(0, Number(stats.activeLecturers) || 0),
      totalModules: Math.max(0, Number(stats.totalModules) || 0),
      totalIntakes: Math.max(0, Number(stats.totalIntakes) || 0),
      activeIntakes: Math.max(0, Number(stats.activeIntakes) || 0),
      activeOfferingCount: Math.max(0, Number(stats.activeOfferingCount) || 0),
      totalSubgroups: Math.max(0, Number(stats.totalSubgroups) || 0),
    },
    currentIntake:
      currentIntakeRow && String(currentIntakeRow.currentTerm ?? "").trim()
        ? {
            name: String(currentIntakeRow.name ?? "").trim(),
            currentTerm: String(currentIntakeRow.currentTerm ?? "").trim(),
          }
        : null,
    studentsPerFaculty: parseDistributionItems(root.studentsPerFaculty),
    studentsPerDegree: parseDistributionItems(root.studentsPerDegree),
    recentActivity: parseActivityItems(root.recentActivity),
    alerts: parseAlerts(root.alerts),
    ticketSummary: {
      total: Math.max(0, Number(asObject(root.ticketSummary)?.total) || 0),
      open: Math.max(0, Number(asObject(root.ticketSummary)?.open) || 0),
      inProgress: Math.max(0, Number(asObject(root.ticketSummary)?.inProgress) || 0),
      resolved: Math.max(0, Number(asObject(root.ticketSummary)?.resolved) || 0),
    },
    recentTickets: Array.isArray(root.recentTickets)
      ? root.recentTickets
          .map((item) => {
            const row = asObject(item);
            if (!row) {
              return null;
            }
            const id = String(row.id ?? "").trim();
            const subject = String(row.subject ?? "").trim();
            const status = String(row.status ?? "").trim();
            const priority = String(row.priority ?? "").trim();
            const occurredAt = String(row.occurredAt ?? "").trim();
            if (!id || !subject || !occurredAt) {
              return null;
            }
            return { id, subject, status, priority, occurredAt };
          })
          .filter(
            (
              item
            ): item is {
              id: string;
              subject: string;
              status: string;
              priority: string;
              occurredAt: string;
            } => Boolean(item)
          )
      : [],
  };
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { message?: string }
    | null;
  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "message" in payload && payload.message
        ? payload.message
        : "Request failed"
    );
  }
  return (payload ?? ({} as T)) as T;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

function formatRelativeTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently";
  }

  const diffMs = parsed.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function DistributionList({ items }: { items: DistributionItem[] }) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div className="admin-distribution-row" key={`${item.meta}-${item.label}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-heading">{item.label}</p>
              <p className="mt-0.5 text-xs text-text/60">{item.meta}</p>
            </div>
            <p className="text-sm font-semibold text-heading">
              {item.value.toLocaleString()}
            </p>
          </div>
          <div className="admin-distribution-track mt-3 h-2 rounded-full bg-slate-200/70">
            <div
              className="admin-distribution-fill h-2 rounded-full bg-primary"
              style={{ width: `${Math.max(12, Math.round((item.value / maxValue) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatOverviewCard({
  icon: Icon,
  label,
  value,
  meta,
  tone,
}: {
  icon: StatIcon;
  label: string;
  value: string;
  meta: string;
  tone: StatDefinition["tone"];
}) {
  return (
    <Card accent className="admin-stat-card h-full p-5" data-tone={tone}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-heading">{value}</p>
        </div>
        <span className="admin-stat-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-4 text-xs text-text/60">{meta}</p>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationFeedItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const currentUser = readStoredUser();

    void (async () => {
      try {
        const [dashboardPayload, rows, scopedNotifications] = await Promise.all([
          readJson<unknown>(await fetch("/api/admin/dashboard", { cache: "no-store" })).then(
            (payload) => parseDashboardPayload(payload)
          ),
          listLatestAnnouncements(15).catch(() => [] as AnnouncementRecord[]),
          listNotificationsForUser(currentUser, "SUPER_ADMIN").catch(
            () => [] as NotificationFeedItem[]
          ),
        ]);

        if (cancelled) {
          return;
        }

        setDashboard(dashboardPayload);
        setDashboardError(
          dashboardPayload ? "" : "Failed to map admin dashboard data from the database."
        );
        setAnnouncements(rows);
        setNotifications(scopedNotifications.slice(0, 3));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setDashboard(null);
        setDashboardError(
          error instanceof Error ? error.message : "Failed to load dashboard data."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const statistics = useMemo(() => {
    const stats = dashboard?.stats;
    const statMap = {
      students: {
        value: stats ? stats.totalStudents.toLocaleString() : "—",
        meta: stats ? `${stats.activeStudents.toLocaleString()} active records` : "Loading",
      },
      faculties: {
        value: stats ? stats.totalFaculties.toLocaleString() : "—",
        meta: stats ? `${stats.activeFaculties.toLocaleString()} active faculties` : "Loading",
      },
      degreePrograms: {
        value: stats ? stats.totalDegreePrograms.toLocaleString() : "—",
        meta: stats
          ? `${stats.activeDegreePrograms.toLocaleString()} active programs`
          : "Loading",
      },
      lecturers: {
        value: stats ? stats.totalLecturers.toLocaleString() : "—",
        meta: stats ? `${stats.activeLecturers.toLocaleString()} active lecturers` : "Loading",
      },
      modules: {
        value: stats ? stats.totalModules.toLocaleString() : "—",
        meta: stats
          ? `${stats.activeOfferingCount.toLocaleString()} active offerings`
          : "Loading",
      },
      intakes: {
        value: stats ? stats.activeIntakes.toLocaleString() : "—",
        meta: stats ? `${stats.totalIntakes.toLocaleString()} intake records` : "Loading",
      },
    } as const;

    return STAT_DEFINITIONS.map((item) => ({
      ...item,
      ...statMap[item.key],
    }));
  }, [dashboard]);

  const recentActivityItems = dashboard?.recentActivity.slice(0, 4) ?? [];
  const alertItems = dashboard?.alerts.slice(0, 3) ?? [];
  const announcementPreviewItems = announcements.slice(0, 2);
  const recentNotificationItems = notifications.slice(0, 3);

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      {dashboardError ? (
        <Card className="admin-empty-state p-5">
          <p className="text-sm font-semibold text-heading">Dashboard data unavailable</p>
          <p className="mt-1 text-sm text-text/68">{dashboardError}</p>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statistics.map((item) => (
          <StatOverviewCard
            icon={item.icon}
            key={item.key}
            label={item.label}
            meta={item.meta}
            tone={item.tone}
            value={item.value}
          />
        ))}
      </section>

      <section className="grid gap-6">
        <Card
          accent
          description="Operational academic metrics across faculties, degrees, and active delivery groups."
          title="Academic Overview"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="admin-surface rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-heading">Students per Faculty</p>
                <Badge variant="neutral">Live distribution</Badge>
              </div>
              <div className="mt-5">
                {dashboard?.studentsPerFaculty.length ? (
                  <DistributionList items={dashboard.studentsPerFaculty} />
                ) : (
                  <p className="admin-empty-state rounded-3xl px-4 py-5 text-sm text-text/68">
                    No enrollment distribution available yet.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="admin-surface rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-heading">Students per Degree</p>
                  <Badge variant="neutral">Top programs</Badge>
                </div>
                <div className="mt-5">
                  {dashboard?.studentsPerDegree.length ? (
                    <DistributionList items={dashboard.studentsPerDegree} />
                  ) : (
                    <p className="admin-empty-state rounded-3xl px-4 py-5 text-sm text-text/68">
                      No degree-level enrollment distribution available yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="admin-inline-stat rounded-3xl border border-border bg-card p-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <CalendarDays size={18} />
                  </span>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Current Active Term
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-heading">
                    {dashboard?.currentIntake?.currentTerm || "—"}
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    {dashboard?.currentIntake?.name || "No active intake found"}
                  </p>
                </div>

                <div className="admin-inline-stat rounded-3xl border border-border bg-card p-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Layers3 size={18} />
                  </span>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Total Subgroups
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-heading">
                    {dashboard ? dashboard.stats.totalSubgroups.toLocaleString() : "—"}
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    Distinct subgroup codes stored in active enrollment data
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5" title="Recent Activity">
          <div className="space-y-3">
            {recentActivityItems.length ? (
              recentActivityItems.map((item) => (
                <div
                  className="admin-activity-panel flex items-start gap-3 rounded-3xl border border-border bg-card p-4"
                  key={item.id}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Clock3 size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-heading">{item.title}</p>
                      <p className="shrink-0 text-xs font-medium text-text/55">
                        {formatRelativeTime(item.occurredAt)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-text/68">{item.detail}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="admin-empty-state rounded-3xl border border-border bg-card p-4 text-sm text-text/68">
                No recent database activity available.
              </div>
            )}
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
          <Card className="p-5" title="Quick Actions">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {QUICK_ACTIONS.map((item, index) => (
                <Link
                  className={[
                    "admin-quick-link inline-flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                    index === QUICK_ACTIONS.length - 1
                      ? "admin-quick-link-primary bg-primary text-white hover:bg-primaryHover"
                      : "border border-border bg-card text-text hover:bg-tint",
                  ].join(" ")}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                  <ArrowRight size={14} />
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5" title="Important Alerts">
            <div className="space-y-3">
              {alertItems.length ? (
                alertItems.map((item) => (
                  <div
                    className="admin-alert-card rounded-3xl border border-border bg-card p-4"
                    key={item.id}
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <AlertTriangle size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-heading">{item.title}</p>
                          <Badge variant={item.level === "High" ? "warning" : "neutral"}>
                            {item.level}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-text/68">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="admin-empty-state rounded-3xl border border-border bg-card p-4 text-sm text-text/68">
                  No alert conditions detected from current database records.
                </div>
              )}
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-6">
        <Card
          accent
          description="Current support request workload and latest ticket updates from students."
          title="Support Tickets"
        >
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="admin-inline-stat rounded-3xl border border-border bg-card p-5 sm:col-span-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <LifeBuoy size={18} />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                  Total Tickets
                </p>
                <p className="mt-2 text-2xl font-semibold text-heading">
                  {(dashboard?.ticketSummary.total ?? 0).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-text/60">All support tickets submitted by students</p>
              </div>
              <div className="admin-inline-stat rounded-3xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">Open</p>
                <p className="mt-2 text-2xl font-semibold text-heading">
                  {(dashboard?.ticketSummary.open ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="admin-inline-stat rounded-3xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                  In progress
                </p>
                <p className="mt-2 text-2xl font-semibold text-heading">
                  {(dashboard?.ticketSummary.inProgress ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="admin-inline-stat rounded-3xl border border-border bg-card p-5 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                  Resolved
                </p>
                <p className="mt-2 text-2xl font-semibold text-heading">
                  {(dashboard?.ticketSummary.resolved ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="admin-surface rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-heading">Latest Ticket Updates</p>
                <Badge variant="neutral">Recent 3</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {dashboard?.recentTickets.length ? (
                  dashboard.recentTickets.map((ticket) => (
                    <div
                      className="admin-list-card rounded-3xl border border-border bg-card p-4"
                      key={ticket.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-heading">{ticket.subject}</p>
                          <p className="mt-1 text-xs text-text/60">
                            {ticket.status || "Open"} • Priority: {ticket.priority || "Medium"}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs font-medium text-text/55">
                          {formatRelativeTime(ticket.occurredAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="admin-empty-state rounded-3xl px-4 py-5 text-sm text-text/68">
                    No support ticket activity available yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5" title="Announcement Preview">
          <div className="space-y-3">
            {announcementPreviewItems.length ? (
              announcementPreviewItems.map((item) => (
                <div
                  className="admin-list-card rounded-3xl border border-border bg-card p-4"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Megaphone size={14} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-heading">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs text-text/60">{item.targetLabel}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-text/72">{item.message}</p>
                    </div>
                    <p className="shrink-0 text-xs font-medium text-text/55">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="admin-empty-state rounded-3xl border border-border bg-card p-4 text-sm text-text/68">
                No announcements available yet.
              </div>
            )}
            <div className="pt-1">
              <Link
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primaryHover"
                href="/admin/announcements"
              >
                View All
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </Card>

        <Card className="p-5" title="Recent Notifications">
          <div className="space-y-3">
            {recentNotificationItems.length ? (
              recentNotificationItems.map((item) => (
                <div
                  className="admin-notification-card rounded-3xl border border-border bg-card p-4"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={item.type === "Announcement" ? "success" : "warning"}>
                          {item.type}
                        </Badge>
                        {item.unread ? <Badge variant="neutral">Unread</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-heading">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-text/68">{item.message}</p>
                    </div>
                    <p className="shrink-0 text-xs text-text/55">{item.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="admin-empty-state rounded-3xl border border-border bg-card p-4 text-sm text-text/68">
                No notifications available.
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
