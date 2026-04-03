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
import {
  getStudentPortalSessionUser,
  resolveCurrentStudentRecord,
  type StudentPortalEnrollment,
} from "@/lib/student-session";
import {
  listLatestAnnouncements,
  type AnnouncementRecord,
} from "@/models/announcement-center";
import {
  isAllAudienceNotification,
  listNotificationsForUser,
  type NotificationFeedItem,
} from "@/models/notification-center";
import { authHeaders, updateStoredUser } from "@/models/rbac";

interface DashboardRiskModule {
  gradeId: string;
  moduleCode: string;
  moduleName: string;
  caMarks: number;
  finalExamMarks: number;
  totalMarks: number;
  academicYear: string;
  semester: number;
  action: string;
}

interface DashboardPerformanceData {
  student: {
    name: string;
    registrationNumber: string;
  };
  overview: {
    cumulativeGPA: number;
    progressPercentage: number;
    classification: string;
    academicStanding: {
      standing: string;
      level: string;
      color: string;
      message: string;
      recommendations: string[];
    };
    totalCreditsCompleted: number;
    totalCreditsRequired: number;
    totalModulesTaken: number;
    totalModulesPassed: number;
    totalModulesFailed: number;
    totalProRata: number;
    totalRepeat: number;
    trend: string;
  };
  semesterBreakdown: Array<{
    academicYear: string;
    semester: number;
    semesterGPA: number;
    modules: Array<{
      gradeId: string;
      moduleCode: string;
      moduleName: string;
      caMarks: number;
      finalExamMarks: number;
      totalMarks: number;
      gradeLetter: string;
      gradePoint: number;
      status: string;
      gradedBy: string | null;
      gradedAt: string | null;
    }>;
    summary: {
      totalModules: number;
      passCount: number;
      failCount: number;
      proRataCount: number;
      repeatCount: number;
      averageMarks: number;
      highestMarks: number;
      lowestMarks: number;
    };
  }>;
  atRiskModules: {
    proRataModules: DashboardRiskModule[];
    repeatModules: DashboardRiskModule[];
    failedModules: DashboardRiskModule[];
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
  latestEnrollment: StudentPortalEnrollment | null;
  performance: DashboardPerformanceData | null;
  points: DashboardPointsData | null;
  quizzes: DashboardQuizData | null;
  trophies: DashboardTrophyData | null;
  communityPosts: DashboardCommunityPost[] | null;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function formatFriendlyDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently";
  }

  return parsed.toLocaleString();
}

function describeCurrentTerm(value: string | null | undefined) {
  const normalized = collapseSpaces(value).toUpperCase();
  const match = normalized.match(/^Y(\d+)S(\d+)$/i);

  if (!match) {
    return {
      code: normalized || "Not set",
      yearLabel: normalized ? `Based on ${normalized}` : "Year not set",
      semesterLabel: normalized || "Semester not set",
    };
  }

  const [, year, semester] = match;
  return {
    code: `Y${year}S${semester}`,
    yearLabel: `Year ${year}`,
    semesterLabel: `Semester ${semester}`,
  };
}

function formatTrend(value: string | null | undefined) {
  const normalized = collapseSpaces(value).toLowerCase();
  if (!normalized) {
    return "Trend unavailable";
  }

  if (normalized === "up") {
    return "Improving";
  }

  if (normalized === "down") {
    return "Needs attention";
  }

  if (normalized === "stable") {
    return "Stable";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getStandingClasses(level: string | null | undefined) {
  const normalized = collapseSpaces(level).toLowerCase();

  if (normalized === "critical") {
    return "student-status-critical";
  }

  if (normalized === "warning") {
    return "student-status-warning";
  }

  return "student-status-positive";
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="student-panel overflow-hidden">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-4 h-12 w-72" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-20 rounded-3xl" key={index} />
          ))}
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-24" />
            <Skeleton className="mt-3 h-4 w-36" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <Card>
          <Skeleton className="h-64 w-full rounded-3xl" />
        </Card>
        <Card>
          <Skeleton className="h-64 w-full rounded-3xl" />
        </Card>
      </div>
    </div>
  );
}

function StudentProfileEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="student-panel">
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
  const [recentAlerts, setRecentAlerts] = useState<NotificationFeedItem[]>([]);
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

  const unavailableSources = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    const missing: string[] = [];
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
        setRecentAlerts([]);
        setAnnouncements([]);
        setProfileMissing(true);
        return;
      }

      const [
        performance,
        points,
        quizzes,
        trophies,
        communityPosts,
        studentNotifications,
        latestAnnouncements,
      ] = await Promise.all([
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
        listNotificationsForUser(sessionUser, "STUDENT")
          .then((items) =>
            items.filter((item) => !isAllAudienceNotification(item)).slice(0, 4)
          )
          .catch(() => [] as NotificationFeedItem[]),
        listLatestAnnouncements(4).catch(() => [] as AnnouncementRecord[]),
      ]);

      setDashboard({
        studentName: student.fullName,
        registrationNumber: student.studentId,
        latestEnrollment: student.latestEnrollment,
        performance,
        points,
        quizzes,
        trophies,
        communityPosts,
      });
      setRecentAlerts(studentNotifications);
      setAnnouncements(latestAnnouncements);
    } catch (loadError) {
      setProfileMissing(false);
      setDashboard(null);
      setRecentAlerts([]);
      setAnnouncements([]);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load your dashboard."
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
        updateError instanceof Error ? updateError.message : "Failed to update password"
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (profileMissing) {
    return <StudentProfileEmptyState onRetry={() => void loadDashboard()} />;
  }

  if (error) {
    return (
      <Card className="student-panel">
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

  if (!dashboard) {
    return null;
  }

  const performance = dashboard.performance;
  const points = dashboard.points;
  const quizzes = dashboard.quizzes;
  const trophies = dashboard.trophies;
  const currentTerm = describeCurrentTerm(dashboard.latestEnrollment?.currentTerm);
  const semesterBreakdown = performance?.semesterBreakdown ?? [];
  const latestSemester =
    semesterBreakdown.length > 0 ? semesterBreakdown[semesterBreakdown.length - 1] : null;
  const currentModules = latestSemester?.modules.slice(0, 4) ?? [];
  const repeatModules = performance?.atRiskModules.repeatModules.slice(0, 4) ?? [];
  const proRataModules = performance?.atRiskModules.proRataModules.slice(0, 4) ?? [];
  const progressValue = Math.max(
    0,
    Math.min(100, performance?.overview.progressPercentage ?? 0)
  );

  const metricCards = [
    {
      label: "Current GPA",
      value: performance ? performance.overview.cumulativeGPA.toFixed(2) : "—",
      hint: performance?.overview.classification ?? "Performance data unavailable",
      icon: BarChart3,
      className: "student-metric-card student-metric-sky",
    },
    {
      label: "Study Progress",
      value: performance ? `${performance.overview.progressPercentage.toFixed(1)}%` : "—",
      hint: performance
        ? `${performance.overview.totalCreditsCompleted}/${performance.overview.totalCreditsRequired} credits`
        : "Progress data unavailable",
      icon: BookOpen,
      className: "student-metric-card student-metric-green",
    },
    {
      label: "Current Term",
      value: dashboard.latestEnrollment?.currentTerm || "—",
      hint: dashboard.latestEnrollment
        ? `${currentTerm.yearLabel} • ${currentTerm.semesterLabel}`
        : "Enrollment details unavailable",
      icon: Sparkles,
      className: "student-metric-card student-metric-violet",
    },
    {
      label: "Academic Flags",
      value: performance
        ? String(performance.overview.totalRepeat + performance.overview.totalProRata)
        : "—",
      hint: performance
        ? `${performance.overview.totalRepeat} repeat • ${performance.overview.totalProRata} pro-rata`
        : "Risk data unavailable",
      icon: AlertTriangle,
      className: "student-metric-card student-metric-amber",
    },
  ];

  const academicFacts = [
    {
      label: "Degree Program",
      value: dashboard.latestEnrollment?.degreeProgramName || "Not available",
    },
    {
      label: "Faculty",
      value: dashboard.latestEnrollment?.facultyName || "Not available",
    },
    {
      label: "Intake",
      value: dashboard.latestEnrollment?.intakeName || "Not available",
    },
    {
      label: "Current Year",
      value: currentTerm.yearLabel,
    },
    {
      label: "Current Term",
      value: dashboard.latestEnrollment?.currentTerm || "Not available",
    },
    {
      label: "Stream / Subgroup",
      value: [
        dashboard.latestEnrollment?.stream || "Stream not set",
        dashboard.latestEnrollment?.subgroup || "No subgroup",
      ].join(" / "),
    },
  ];

  const activityItems = [
    {
      label: "Community Posts",
      hint: "Posts linked to your user account",
      value: dashboard.communityPosts ? String(dashboard.communityPosts.length) : "—",
      icon: MessageSquare,
    },
    {
      label: "Available Quizzes",
      hint: quizzes ? `${quizzes.summary.totalInProgress} in progress` : "Quiz data unavailable",
      value: quizzes ? String(quizzes.summary.totalAvailable) : "—",
      icon: BookOpen,
    },
    {
      label: "Completed Quizzes",
      hint: quizzes ? "Best-attempt record count" : "Quiz data unavailable",
      value: quizzes ? String(quizzes.summary.totalCompleted) : "—",
      icon: BookOpen,
    },
    {
      label: "Total XP",
      hint: points ? `${points.activityCount} activity records` : "XP data unavailable",
      value: points ? String(points.totalXP) : "—",
      icon: Sparkles,
    },
    {
      label: "Trophies Earned",
      hint: trophies ? "Unlocked achievement count" : "Trophy data unavailable",
      value: trophies ? String(trophies.trophies.totalEarned) : "—",
      icon: Trophy,
    },
  ];

  return (
    <div className="student-dashboard space-y-6 pb-2">
      <section className="student-hero relative overflow-hidden rounded-[36px] border p-6 sm:p-8">
        <div
          aria-hidden
          className="student-hero-ambient pointer-events-none absolute right-6 top-8 hidden h-44 w-60 rotate-6 rounded-[30px] border border-white/80 bg-white/50 shadow-[0_18px_38px_rgba(15,23,42,0.08)] backdrop-blur md:block"
        />
        <div
          aria-hidden
          className="student-hero-ambient pointer-events-none absolute right-20 top-14 hidden h-44 w-60 -rotate-6 rounded-[30px] border border-white/70 bg-white/65 shadow-[0_14px_34px_rgba(15,23,42,0.06)] backdrop-blur xl:block"
        />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="student-chip inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] backdrop-blur">
              <BookOpen size={14} />
              Student workspace
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-heading sm:text-[2.8rem]">
              Student Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
              Academic overview for{" "}
              <span className="font-semibold text-heading">{dashboard.studentName}</span>
              {dashboard.registrationNumber ? ` • ${dashboard.registrationNumber}` : ""}. Keep
              track of your current term, modules, progression, and attention items from one place.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <div className="student-soft-block rounded-2xl border px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Current term
                </p>
                <p className="mt-1 text-base font-semibold text-heading">{currentTerm.code}</p>
              </div>
              <div className="student-soft-block rounded-2xl border px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Current year
                </p>
                <p className="mt-1 text-base font-semibold text-heading">{currentTerm.yearLabel}</p>
              </div>
              <div
                className={cn(
                  "student-soft-block rounded-2xl border px-4 py-3",
                  getStandingClasses(performance?.overview.academicStanding.level)
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                  Academic standing
                </p>
                <p className="mt-1 text-base font-semibold">
                  {performance?.overview.academicStanding.standing ?? "Unavailable"}
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-[1] flex w-full max-w-sm flex-col gap-3">
            <div className="student-sheet rounded-[28px] border p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Study sheet
                  </p>
                  <p className="mt-2 text-xl font-semibold text-heading">
                    {dashboard.latestEnrollment?.degreeProgramName || "Student record"}
                  </p>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BarChart3 size={18} />
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="student-soft-block rounded-2xl px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Credits
                  </p>
                  <p className="mt-1 text-lg font-semibold text-heading">
                    {performance
                      ? `${performance.overview.totalCreditsCompleted}/${performance.overview.totalCreditsRequired}`
                      : "—"}
                  </p>
                </div>
                <div className="student-soft-block rounded-2xl px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Repetition
                  </p>
                  <p className="mt-1 text-lg font-semibold text-heading">
                    {performance ? performance.overview.totalRepeat : "—"}
                  </p>
                </div>
                <div className="student-soft-block rounded-2xl px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Pro-rata
                  </p>
                  <p className="mt-1 text-lg font-semibold text-heading">
                    {performance ? performance.overview.totalProRata : "—"}
                  </p>
                </div>
              </div>
            </div>

            <Button
              className="gap-2 self-start rounded-2xl border-white/80 bg-white/85 px-5 text-heading shadow-[0_14px_30px_rgba(15,23,42,0.06)] hover:bg-white"
              disabled={refreshing}
              onClick={() => void loadDashboard(true)}
              variant="secondary"
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} size={16} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {unavailableSources.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some dashboard panels are temporarily unavailable: {unavailableSources.join(", ")}.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              className={cn("shadow-[0_16px_34px_rgba(15,23,42,0.06)]", card.className)}
              key={card.label}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-600">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-heading">{card.value}</p>
                  <p className="mt-3 text-sm text-slate-600">{card.hint}</p>
                </div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-heading shadow-[0_10px_18px_rgba(15,23,42,0.08)]">
                  <Icon size={18} />
                </span>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <Card className="student-panel">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Academic summary
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-heading">Student file</h2>
              <p className="mt-2 text-sm text-slate-600">
                Current enrollment details, progression, and module focus for this student.
              </p>
            </div>
            <div className="student-chip rounded-full border px-3 py-1 text-xs font-medium">
              Trend: {formatTrend(performance?.overview.trend)}
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {academicFacts.map((fact) => (
              <div
                className="student-soft-block rounded-2xl border px-4 py-3"
                key={fact.label}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {fact.label}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-heading">{fact.value}</p>
              </div>
            ))}
          </div>

          <div className="student-soft-block mt-6 rounded-[28px] border p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Credit completion
                </p>
                <p className="mt-2 text-2xl font-semibold text-heading">
                  {performance
                    ? `${performance.overview.totalCreditsCompleted} of ${performance.overview.totalCreditsRequired} credits`
                    : "Progress unavailable"}
                </p>
              </div>
              <div className="student-soft-block rounded-2xl border px-4 py-3 text-sm text-slate-600">
                {performance
                  ? `${performance.overview.totalModulesPassed} passed / ${performance.overview.totalModulesFailed} needing attention`
                  : "Module summary unavailable"}
              </div>
            </div>

            <div className="student-progress-track mt-5 h-3 overflow-hidden rounded-full">
              <div
                className="student-progress-fill h-full rounded-full"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Current modules
                </p>
                <p className="mt-2 text-lg font-semibold text-heading">
                  {latestSemester
                    ? `${latestSemester.academicYear} • Semester ${latestSemester.semester}`
                    : "No module records yet"}
                </p>
              </div>
              {latestSemester ? (
                <p className="text-sm text-slate-600">
                  {latestSemester.summary.totalModules} modules in the latest recorded semester
                </p>
              ) : null}
            </div>

            {currentModules.length === 0 ? (
              <div className="student-empty-block mt-4 rounded-2xl border px-4 py-5 text-sm text-slate-600">
                No semester modules are available yet for this student.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {currentModules.map((module) => (
                  <div
                    className="student-soft-block rounded-2xl border px-4 py-4"
                    key={module.gradeId || `${module.moduleCode}-${module.moduleName}`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                      {module.moduleCode || "Module"}
                    </p>
                    <p className="mt-2 text-base font-semibold text-heading">{module.moduleName}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      {collapseSpaces(module.status) || "Status unavailable"}
                      {module.gradeLetter ? ` • Grade ${module.gradeLetter}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="student-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Attention board
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-heading">Progress notes</h2>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <AlertTriangle size={18} />
            </span>
          </div>

          <div className="student-soft-block mt-4 rounded-[28px] border p-5">
            <p className="text-sm leading-6 text-slate-700">
              {performance?.overview.academicStanding.message ??
                performance?.riskReport.summary ??
                "Risk summary is not available right now."}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                Current repetition
              </p>
              <p className="mt-2 text-3xl font-semibold text-heading">
                {performance ? performance.overview.totalRepeat : "—"}
              </p>
              <p className="mt-2 text-sm text-rose-800/80">Modules marked for repeat.</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                Pro-rata details
              </p>
              <p className="mt-2 text-3xl font-semibold text-heading">
                {performance ? performance.overview.totalProRata : "—"}
              </p>
              <p className="mt-2 text-sm text-amber-800/80">Modules carrying pro-rata status.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="student-soft-block rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-heading">Repeat modules</p>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
                  {repeatModules.length}
                </span>
              </div>
              {repeatModules.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No repeat modules recorded.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {repeatModules.map((module) => (
                    <div
                      className="rounded-2xl bg-rose-50/80 px-3 py-3"
                      key={module.gradeId || `${module.moduleCode}-${module.academicYear}`}
                    >
                      <p className="text-sm font-semibold text-heading">
                        {module.moduleCode} - {module.moduleName}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {module.academicYear} Semester {module.semester} • {module.action}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="student-soft-block rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-heading">Pro-rata modules</p>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                  {proRataModules.length}
                </span>
              </div>
              {proRataModules.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No pro-rata modules recorded.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {proRataModules.map((module) => (
                    <div
                      className="rounded-2xl bg-amber-50/85 px-3 py-3"
                      key={module.gradeId || `${module.moduleCode}-${module.academicYear}`}
                    >
                      <p className="text-sm font-semibold text-heading">
                        {module.moduleCode} - {module.moduleName}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {module.academicYear} Semester {module.semester} • {module.action}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <Card className="student-panel">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Inbox
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-heading">Recent alerts</h2>
            </div>
            <span className="student-chip rounded-full border px-3 py-1 text-xs font-medium">
              {recentAlerts.length} latest
            </span>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="student-empty-block mt-4 rounded-2xl border px-4 py-5 text-sm text-slate-600">
              No student alerts available yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recentAlerts.map((item) => (
                <div
                  className="student-soft-block rounded-[26px] border px-4 py-4"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                          For you
                        </span>
                        <p className="text-sm font-semibold text-heading">{item.title}</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{item.message}</p>
                      <p className="mt-3 text-xs text-slate-500">
                        {item.targetLabel} • {formatFriendlyDateTime(item.publishedAt)}
                      </p>
                    </div>
                    <p className="shrink-0 text-[11px] font-medium text-slate-500">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="student-panel">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Engagement
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-heading">Activity snapshot</h2>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {activityItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  className="student-soft-block rounded-[24px] border px-4 py-4"
                  key={item.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-heading">
                      <Icon size={18} />
                    </span>
                    <p className="text-2xl font-semibold text-heading">{item.value}</p>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-heading">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.hint}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

        <Card className="student-panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Broadcasts
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-heading">Latest announcements</h2>
          </div>
          <span className="student-chip rounded-full border px-3 py-1 text-xs font-medium">
            All-user updates
          </span>
        </div>

        {announcements.length === 0 ? (
          <div className="student-empty-block mt-4 rounded-2xl border px-4 py-5 text-sm text-slate-600">
            No announcements available yet.
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {announcements.map((item) => (
              <div
                className="student-soft-block rounded-[26px] border px-5 py-4"
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                    All
                  </span>
                  <p className="text-base font-semibold text-heading">{item.title}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.message}</p>
                <p className="mt-3 text-xs text-slate-500">
                  {item.targetLabel} • {formatFriendlyDateTime(item.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5">
          <Link
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-medium text-heading shadow-[0_10px_22px_rgba(15,23,42,0.04)] hover:bg-tint"
            href="/student/announcements"
          >
            View All
          </Link>
        </div>
      </Card>
      <Card className="student-panel student-panel-accent">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
              Account protection
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-heading">Security settings</h2>
            <p className="mt-2 text-sm text-slate-700">
              Keep your account secure by changing your password regularly.
            </p>
          </div>
          <Button
            className="h-11 min-w-[170px] bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
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
            className="student-modal w-full max-w-xl overflow-hidden rounded-3xl border"
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
