"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { authHeaders, updateStoredUser } from "@/models/rbac";
import {
  listLatestAnnouncements,
  type AnnouncementRecord,
} from "@/models/announcement-center";
import {
  getStudentPortalSessionUser,
  type StudentPortalEnrollment,
  resolveCurrentStudentRecord,
} from "@/lib/student-session";

interface DashboardPerformanceData {
  student: {
    name: string;
    registrationNumber: string;
  };
  overview: {
    cumulativeGPA: number;
    progressPercentage: number;
    classification: string;
    totalCreditsCompleted: number;
  };
  atRiskModules: {
    totalAtRisk: number;
    hasAnyRisk: boolean;
  };
  riskReport: {
    summary: string;
  };
}

interface DashboardPointsData {
  totalXP: number;
  activityCount: number;
  recentActivity: Array<{
    reason: string;
    xpPoints: number;
    createdAt: string;
  }>;
}

interface DashboardQuizData {
  summary: {
    totalAvailable: number;
    totalInProgress: number;
    totalCompleted: number;
    averageScore: number;
  };
}

interface DashboardTrophyData {
  trophies: {
    totalEarned: number;
    recentlyEarned: Array<{
      trophyName: string;
      earnedAt: string;
    }>;
  };
}

interface DashboardCommunityPost {
  _id?: string;
  title?: string;
  createdAt?: string;
}

interface DashboardState {
  studentName: string;
  registrationNumber: string;
  modules: Array<{
    id: string;
    moduleCode: string;
    moduleName: string;
    termCode: string;
    lecturerCount: number;
  }> | null;
  performance: DashboardPerformanceData | null;
  points: DashboardPointsData | null;
  quizzes: DashboardQuizData | null;
  trophies: DashboardTrophyData | null;
  communityPosts: DashboardCommunityPost[] | null;
}

interface DashboardAlert {
  id: string;
  title: string;
  message: string;
  time?: string;
  tone: "neutral" | "warning" | "success";
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatRelativeTime(date: string | null | undefined) {
  if (!date) {
    return "Recently";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently";
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

async function fetchOptionalApiData<T>(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const payload = await readJson<{ success?: boolean; data?: T }>(response);
    if (!response.ok || !payload?.success || !payload.data) {
      return null;
    }
    return payload.data;
  } catch {
    return null;
  }
}

async function fetchOptionalPosts(userId: string) {
  const trimmedUserId = collapseSpaces(userId);
  if (!trimmedUserId || !/^[a-f\d]{24}$/i.test(trimmedUserId)) {
    return null;
  }

  try {
    const response = await fetch(
      `/api/community-user-posts?userId=${encodeURIComponent(trimmedUserId)}`,
      {
        cache: "no-store",
      }
    );
    const payload = await readJson<DashboardCommunityPost[]>(response);
    if (!response.ok || !Array.isArray(payload)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function fetchOptionalStudentModules(enrollment: StudentPortalEnrollment | null) {
  if (!enrollment) {
    return null;
  }

  const query = new URLSearchParams({
    facultyId: enrollment.facultyId,
    degreeProgramId: enrollment.degreeProgramId,
    intakeId: enrollment.intakeId,
    termCode: enrollment.currentTerm || "",
    status: "ACTIVE",
    page: "1",
    pageSize: "100",
    sort: "module",
  });

  try {
    const response = await fetch(`/api/module-offerings?${query.toString()}`, {
      cache: "no-store",
    });
    const payload = await readJson<{
      items?: Array<{
        id?: string;
        _id?: string;
        moduleCode?: string;
        moduleName?: string;
        termCode?: string;
        lecturerCount?: number;
      }>;
    }>(response);
    if (!response.ok) {
      return null;
    }

    const rows = Array.isArray(payload?.items) ? payload.items : [];
    return rows
      .map((row) => {
        const id = collapseSpaces(row.id ?? row._id);
        const moduleCode = collapseSpaces(row.moduleCode);
        const moduleName = collapseSpaces(row.moduleName);
        const termCode = collapseSpaces(row.termCode);
        const lecturerCount = Math.max(0, Math.floor(Number(row.lecturerCount) || 0));
        if (!id || !moduleCode) {
          return null;
        }

        return {
          id,
          moduleCode,
          moduleName: moduleName || moduleCode,
          termCode,
          lecturerCount,
        };
      })
      .filter(
        (
          row
        ): row is {
          id: string;
          moduleCode: string;
          moduleName: string;
          termCode: string;
          lecturerCount: number;
        } => Boolean(row)
      );
  } catch {
    return null;
  }
}

function buildAlerts(data: DashboardState | null): DashboardAlert[] {
  if (!data) {
    return [];
  }

  const alerts: DashboardAlert[] = [];

  if (data.performance?.atRiskModules.hasAnyRisk) {
    alerts.push({
      id: "risk",
      title: "Academic attention needed",
      message:
        data.performance.atRiskModules.totalAtRisk === 1
          ? "You have 1 module that needs attention."
          : `You have ${data.performance.atRiskModules.totalAtRisk} modules that need attention.`,
      tone: "warning",
    });
  }

  if ((data.quizzes?.summary.totalInProgress ?? 0) > 0) {
    alerts.push({
      id: "quiz-in-progress",
      title: "Quiz in progress",
      message:
        data.quizzes?.summary.totalInProgress === 1
          ? "You have 1 quiz ready to resume."
          : `You have ${data.quizzes?.summary.totalInProgress ?? 0} quizzes ready to resume.`,
      tone: "warning",
    });
  }

  if ((data.quizzes?.summary.totalAvailable ?? 0) > 0) {
    alerts.push({
      id: "quiz-available",
      title: "New quiz opportunities",
      message:
        data.quizzes?.summary.totalAvailable === 1
          ? "1 quiz is currently available."
          : `${data.quizzes?.summary.totalAvailable ?? 0} quizzes are currently available.`,
      tone: "neutral",
    });
  }

  const recentTrophy = data.trophies?.trophies.recentlyEarned[0];
  if (recentTrophy) {
    alerts.push({
      id: "recent-trophy",
      title: "New trophy earned",
      message: recentTrophy.trophyName,
      time: formatRelativeTime(recentTrophy.earnedAt),
      tone: "success",
    });
  }

  const recentXp = data.points?.recentActivity[0];
  if (recentXp) {
    alerts.push({
      id: "recent-xp",
      title: "Latest XP activity",
      message: `${recentXp.reason} (${recentXp.xpPoints > 0 ? "+" : ""}${recentXp.xpPoints} XP)`,
      time: formatRelativeTime(recentXp.createdAt),
      tone: "neutral",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "healthy",
      title: "All clear",
      message: "No urgent academic or activity alerts right now.",
      tone: "success",
    });
  }

  return alerts.slice(0, 4);
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-20" />
            <Skeleton className="mt-2 h-4 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <Card>
          <Skeleton className="h-40 w-full rounded-3xl" />
        </Card>
        <Card>
          <Skeleton className="h-40 w-full rounded-3xl" />
        </Card>
      </div>
    </div>
  );
}

function StudentProfileEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-sky-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.94),rgba(255,255,255,0.98))]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <BookOpen size={22} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
              Student Portal / Dashboard
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-heading">
              Student profile not found
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text/72">
              Please make sure you&apos;re logged in with a valid student account, or contact your
              administrator.
            </p>
          </div>
        </div>
        <Button onClick={onRetry} variant="secondary">
          Retry
        </Button>
      </div>
    </Card>
  );
}

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [profileMissing, setProfileMissing] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!isSecurityModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSecurityModalOpen]);

  const alerts = useMemo(() => buildAlerts(dashboard), [dashboard]);
  const unavailableSources = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    const missing: string[] = [];
    if (dashboard.modules === null) missing.push("modules");
    if (!dashboard.performance) missing.push("performance");
    if (!dashboard.points) missing.push("points");
    if (!dashboard.quizzes) missing.push("quizzes");
    if (!dashboard.trophies) missing.push("trophies");
    if (dashboard.communityPosts === null) missing.push("community posts");
    return missing;
  }, [dashboard]);

  const closeSecurityModal = () => {
    if (isUpdatingPassword) {
      return;
    }

    setIsSecurityModalOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSecurityError("");
    setSecuritySuccess("");
  };

  const validateSecurityForm = () => {
    if (!currentPassword) {
      return "Current password is required";
    }

    if (newPassword.length < 8) {
      return "New password must be at least 8 characters";
    }

    if (confirmPassword !== newPassword) {
      return "Confirm password must match new password";
    }

    return "";
  };

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    setProfileMissing(false);

    try {
      const sessionUser = getStudentPortalSessionUser();
      if (!sessionUser) {
        throw new Error("No student session found. Please sign in again.");
      }

      const student = await resolveCurrentStudentRecord(sessionUser);
      if (!student) {
        setDashboard(null);
        setAnnouncements([]);
        setProfileMissing(true);
        return;
      }

      const [modules, performance, points, quizzes, trophies, communityPosts, latestAnnouncements] = await Promise.all([
        fetchOptionalStudentModules(student.latestEnrollment),
        fetchOptionalApiData<DashboardPerformanceData>(
          `/api/performance/${encodeURIComponent(student.id)}`
        ),
        fetchOptionalApiData<DashboardPointsData>(
          `/api/gamification/points/${encodeURIComponent(student.id)}`
        ),
        fetchOptionalApiData<DashboardQuizData>(
          `/api/quizzes/student/${encodeURIComponent(student.id)}?status=all`
        ),
        fetchOptionalApiData<DashboardTrophyData>(
          `/api/gamification/trophies/${encodeURIComponent(student.id)}`
        ),
        fetchOptionalPosts(sessionUser.id),
        listLatestAnnouncements(15).catch(() => [] as AnnouncementRecord[]),
      ]);

      setDashboard({
        studentName: student.fullName,
        registrationNumber: student.studentId,
        modules,
        performance,
        points,
        quizzes,
        trophies,
        communityPosts,
      });
      setAnnouncements(latestAnnouncements);
    } catch (loadError) {
      setProfileMissing(false);
      setDashboard(null);
      setAnnouncements([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load your dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const updatePassword = async () => {
    if (isUpdatingPassword) {
      return;
    }

    setSecurityError("");
    setSecuritySuccess("");

    const validationError = validateSecurityForm();
    if (validationError) {
      setSecurityError(validationError);
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to update password");
      }

      updateStoredUser({ mustChangePassword: false });
      setSecuritySuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (updateError) {
      setSecurityError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update password"
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const metricCards = [
    {
      label: "Current GPA",
      value:
        dashboard?.performance !== null && dashboard?.performance !== undefined
          ? dashboard.performance.overview.cumulativeGPA.toFixed(2)
          : "—",
      hint: dashboard?.performance?.overview.classification ?? "Performance data unavailable",
      icon: BarChart3,
    },
    {
      label: "Study Progress",
      value:
        dashboard?.performance !== null && dashboard?.performance !== undefined
          ? `${dashboard.performance.overview.progressPercentage.toFixed(1)}%`
          : "—",
      hint:
        dashboard?.performance !== null && dashboard?.performance !== undefined
          ? `${dashboard.performance.overview.totalCreditsCompleted} credits completed`
          : "Progress data unavailable",
      icon: BookOpen,
    },
    {
      label: "Available Quizzes",
      value:
        dashboard?.quizzes !== null && dashboard?.quizzes !== undefined
          ? String(dashboard.quizzes.summary.totalAvailable)
          : "—",
      hint:
        dashboard?.quizzes !== null && dashboard?.quizzes !== undefined
          ? `${dashboard.quizzes.summary.totalInProgress} in progress`
          : "Quiz data unavailable",
      icon: AlertTriangle,
    },
    {
      label: "Total XP",
      value:
        dashboard?.points !== null && dashboard?.points !== undefined
          ? String(dashboard.points.totalXP)
          : "—",
      hint:
        dashboard?.points !== null && dashboard?.points !== undefined
          ? `${dashboard.points.activityCount} activity records`
          : "XP data unavailable",
      icon: Sparkles,
    },
  ];

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (profileMissing) {
    return <StudentProfileEmptyState onRetry={() => void loadDashboard()} />;
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">
              Student Portal / Dashboard
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-red-900">
              Failed to load dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-red-900/80">{error}</p>
          </div>
          <Button onClick={() => void loadDashboard()} variant="secondary">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-heading">Student Dashboard</h1>
          <p className="mt-2 text-sm text-text/75">
            Live academic and engagement snapshot for{" "}
            <span className="font-medium text-heading">
              {dashboard?.studentName || "your account"}
            </span>
            {dashboard?.registrationNumber
              ? ` • ${dashboard.registrationNumber}`
              : ""}
            .
          </p>
        </div>
        <Button
          className="gap-2"
          disabled={refreshing}
          onClick={() => void loadDashboard(true)}
          variant="secondary"
        >
          <RefreshCw className={cn(refreshing && "animate-spin")} size={16} />
          Refresh
        </Button>
      </div>

      {unavailableSources.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some dashboard panels are temporarily unavailable: {unavailableSources.join(", ")}.
        </div>
      ) : null}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card accent key={card.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-text/72">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-heading">{card.value}</p>
                  <p className="mt-2 text-sm text-text/65">{card.hint}</p>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-heading shadow-sm">
                  <Icon size={18} />
                </span>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <Card title="Recent Alerts">
          <ul className="space-y-3">
            {alerts.map((item) => (
              <li
                className={cn(
                  "rounded-2xl border px-4 py-3",
                  item.tone === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : item.tone === "success"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                )}
                key={item.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text">{item.title}</p>
                    <p className="mt-1 text-sm text-text/72">{item.message}</p>
                  </div>
                  {item.time ? (
                    <p className="text-xs text-text/60">{item.time}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Activity Snapshot">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-tint px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-heading shadow-sm">
                  <MessageSquare size={18} />
                </span>
                <div>
                  <p className="text-sm font-medium text-heading">Community Posts</p>
                  <p className="text-xs text-text/65">Posts linked to your user account</p>
                </div>
              </div>
              <p className="text-xl font-semibold text-heading">
                {dashboard?.communityPosts ? dashboard.communityPosts.length : "—"}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-tint px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-heading shadow-sm">
                  <BookOpen size={18} />
                </span>
                <div>
                  <p className="text-sm font-medium text-heading">Completed Quizzes</p>
                  <p className="text-xs text-text/65">Best-attempt record count</p>
                </div>
              </div>
              <p className="text-xl font-semibold text-heading">
                {dashboard?.quizzes ? dashboard.quizzes.summary.totalCompleted : "—"}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-tint px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-heading shadow-sm">
                  <Trophy size={18} />
                </span>
                <div>
                  <p className="text-sm font-medium text-heading">Trophies Earned</p>
                  <p className="text-xs text-text/65">Unlocked achievement count</p>
                </div>
              </div>
              <p className="text-xl font-semibold text-heading">
                {dashboard?.trophies ? dashboard.trophies.trophies.totalEarned : "—"}
              </p>
            </div>
          </div>
        </Card>
      </section>

      <Card title="My Modules">
        {dashboard?.modules === null ? (
          <p className="text-sm text-text/70">Module data is temporarily unavailable.</p>
        ) : dashboard?.modules.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {dashboard.modules.map((module) => (
              <div
                className="rounded-2xl border border-border/70 bg-tint px-4 py-3"
                key={module.id}
              >
                <p className="text-sm font-semibold text-heading">{module.moduleCode}</p>
                <p className="mt-1 text-sm text-text/75">{module.moduleName}</p>
                <p className="mt-2 text-xs text-text/62">
                  {module.termCode || "Current Term"} •{" "}
                  {module.lecturerCount > 0
                    ? `${module.lecturerCount} lecturer${module.lecturerCount > 1 ? "s" : ""}`
                    : "Lecturer pending"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text/70">
            No modules assigned for your current intake/term yet.
          </p>
        )}
      </Card>

      <Card title="Latest Announcements">
        {announcements.length === 0 ? (
          <p className="text-sm text-text/70">No announcements available yet.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((item) => (
              <div className="rounded-2xl bg-tint px-4 py-3" key={item.id}>
                <p className="text-sm font-semibold text-heading">{item.title}</p>
                <p className="mt-1 text-xs text-text/72">{item.message}</p>
                <p className="mt-1 text-[11px] text-text/60">
                  {item.targetLabel} • {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-heading hover:bg-tint"
            href="/announcements"
          >
            View All
          </Link>
        </div>
      </Card>

      <Card title="Security Settings">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text/75">
            Keep your account secure by changing your password regularly.
          </p>
          <Button
            className="h-11 min-w-[160px] bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
            onClick={() => setIsSecurityModalOpen(true)}
          >
            Change Password
          </Button>
        </div>
      </Card>

      {isSecurityModalOpen ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isUpdatingPassword) {
              closeSecurityModal();
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]"
            role="dialog"
          >
            <div className="px-6 py-6">
              <p className="text-lg font-semibold text-heading">Change Password</p>
              <p className="mt-2 text-sm text-text/70">
                Update your password for better account security.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">
                    Current Password
                  </label>
                  <Input
                    className="h-12"
                    disabled={isUpdatingPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    type="password"
                    value={currentPassword}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">
                    New Password
                  </label>
                  <Input
                    className="h-12"
                    disabled={isUpdatingPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    type="password"
                    value={newPassword}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">
                    Confirm Password
                  </label>
                  <Input
                    className="h-12"
                    disabled={isUpdatingPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                    value={confirmPassword}
                  />
                </div>
              </div>

              {securityError ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {securityError}
                </p>
              ) : null}

              {securitySuccess ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {securitySuccess}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
              <Button
                className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                disabled={isUpdatingPassword}
                onClick={closeSecurityModal}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[160px] bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
                disabled={isUpdatingPassword}
                onClick={() => {
                  void updatePassword();
                }}
              >
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
