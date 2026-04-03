"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  GraduationCap,
  Medal,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { resolveCurrentStudentRecord } from "@/lib/student-session";

type PointsCategory =
  | "academic"
  | "quiz"
  | "assignment"
  | "milestone"
  | "bonus"
  | "penalty"
  | "custom";

interface PointsCategoryBreakdown {
  category: PointsCategory;
  totalXP: number;
  count: number;
}

interface RecentActivityItem {
  action: string;
  xpPoints: number;
  reason: string;
  category: PointsCategory;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface StudentPointsSummary {
  studentId: string;
  student: {
    name: string;
    registrationNumber: string;
  };
  totalXP: number;
  categoryBreakdown: PointsCategoryBreakdown[];
  recentActivity: RecentActivityItem[];
  activityCount: number;
  pointsThisMonth: number;
  pointsThisSemester: number;
  averagePointsPerModule: number;
}

interface StudentPointsResponse {
  success?: boolean;
  data?: StudentPointsSummary;
  error?: string;
}

interface ConfigActionItem {
  action: string;
  category: PointsCategory;
  xpPoints: number;
  description: string;
}

interface GamificationConfig {
  xpValues: Record<string, number>;
  actions: ConfigActionItem[];
}

interface GamificationConfigResponse {
  success?: boolean;
  data?: GamificationConfig;
  error?: string;
}

const STUDENT_PROFILE_EMPTY_TITLE = "Student profile not found";
const STUDENT_PROFILE_EMPTY_MESSAGE =
  "Please make sure you're logged in with a valid student account, or contact your administrator.";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function roundNumber(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatDisplayNumber(value: number, digits = 1) {
  const rounded = roundNumber(value, digits);
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return rounded.toFixed(digits).replace(/\.?0+$/, "");
}

function formatSignedXp(value: number, digits = 0) {
  const rendered = formatDisplayNumber(Math.abs(value), digits);
  if (value > 0) {
    return `+${rendered}`;
  }
  if (value < 0) {
    return `-${rendered}`;
  }
  return rendered;
}

function formatRelativeTime(date: Date | string) {
  const now = new Date();
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) {
    return "Just now";
  }

  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) {
    return "Just now";
  }
  if (diffMins < 60) {
    return `${diffMins} min ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
  if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
  }
  return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function useAnimatedNumber(target: number, duration = 850) {
  const [displayValue, setDisplayValue] = useState(target);
  const previousTarget = useRef(target);

  useEffect(() => {
    const start = previousTarget.current;
    const end = target;
    previousTarget.current = target;

    if (start === end) {
      const idleFrame = window.requestAnimationFrame(() => {
        setDisplayValue(end);
      });
      return () => window.cancelAnimationFrame(idleFrame);
    }

    let frame = 0;
    const startedAt = window.performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(start + (end - start) * eased);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, target]);

  return displayValue;
}

function getCategoryMeta(category: PointsCategory) {
  if (category === "academic") {
    return {
      label: "Academic",
      dot: "bg-sky-500",
      bar: "bg-sky-500",
      soft: "bg-sky-50 text-sky-700 border-sky-200",
      Icon: GraduationCap,
    };
  }
  if (category === "quiz") {
    return {
      label: "Quiz",
      dot: "bg-violet-500",
      bar: "bg-violet-500",
      soft: "bg-violet-50 text-violet-700 border-violet-200",
      Icon: BookOpen,
    };
  }
  if (category === "assignment") {
    return {
      label: "Assignment",
      dot: "bg-indigo-500",
      bar: "bg-indigo-500",
      soft: "bg-indigo-50 text-indigo-700 border-indigo-200",
      Icon: BookOpen,
    };
  }
  if (category === "milestone") {
    return {
      label: "Milestone",
      dot: "bg-amber-500",
      bar: "bg-amber-500",
      soft: "bg-amber-50 text-amber-800 border-amber-200",
      Icon: Trophy,
    };
  }
  if (category === "bonus") {
    return {
      label: "Bonus",
      dot: "bg-emerald-500",
      bar: "bg-emerald-500",
      soft: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Icon: Sparkles,
    };
  }
  if (category === "penalty") {
    return {
      label: "Penalty",
      dot: "bg-rose-500",
      bar: "bg-rose-500",
      soft: "bg-rose-50 text-rose-700 border-rose-200",
      Icon: ShieldAlert,
    };
  }
  return {
    label: "Custom",
    dot: "bg-teal-500",
    bar: "bg-teal-500",
    soft: "bg-teal-50 text-teal-700 border-teal-200",
    Icon: Star,
  };
}

function getTotalXpMeta(totalXP: number) {
  if (totalXP >= 600) {
    return {
      card: "border-amber-200 bg-[linear-gradient(180deg,rgba(255,247,237,0.95),rgba(255,255,255,0.98))]",
      badge: "bg-amber-100 text-amber-800",
      text: "text-amber-700",
    };
  }
  if (totalXP >= 100) {
    return {
      card: "border-sky-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))]",
      badge: "bg-sky-100 text-sky-800",
      text: "text-sky-700",
    };
  }
  return {
    card: "border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]",
    badge: "bg-slate-100 text-slate-700",
    text: "text-slate-700",
  };
}

function getDeltaMeta(value: number) {
  if (value > 0) {
    return {
      card: "border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))]",
      text: "text-emerald-700",
      badge: "bg-emerald-100 text-emerald-800",
    };
  }
  if (value < 0) {
    return {
      card: "border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.98))]",
      text: "text-rose-700",
      badge: "bg-rose-100 text-rose-800",
    };
  }
  return {
    card: "border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]",
    text: "text-slate-700",
    badge: "bg-slate-100 text-slate-700",
  };
}

function getNextMilestone(totalXP: number) {
  const safeTotalXP = Math.max(0, totalXP);
  if (safeTotalXP < 100) {
    return {
      currentXP: safeTotalXP,
      nextMilestone: 100,
      progress: Math.min(100, (safeTotalXP / 100) * 100),
      remaining: 100 - safeTotalXP,
      complete: false,
    };
  }
  if (safeTotalXP < 300) {
    return {
      currentXP: safeTotalXP,
      nextMilestone: 300,
      progress: Math.min(100, (safeTotalXP / 300) * 100),
      remaining: 300 - safeTotalXP,
      complete: false,
    };
  }
  if (safeTotalXP < 600) {
    return {
      currentXP: safeTotalXP,
      nextMilestone: 600,
      progress: Math.min(100, (safeTotalXP / 600) * 100),
      remaining: 600 - safeTotalXP,
      complete: false,
    };
  }
  return {
    currentXP: safeTotalXP,
    nextMilestone: 600,
    progress: 100,
    remaining: 0,
    complete: true,
  };
}

function extractMilestoneKey(description: string, xpPoints: number) {
  const match = description.match(/(\d+)\s*xp/i);
  if (match) {
    return `milestone_reached:${match[1]}`;
  }

  if (xpPoints === 20) {
    return "milestone_reached:100";
  }
  if (xpPoints === 40) {
    return "milestone_reached:300";
  }
  if (xpPoints === 60) {
    return "milestone_reached:600";
  }

  return `milestone_reached:${xpPoints}`;
}

function getAchievedActionKey(activity: RecentActivityItem) {
  if (activity.action === "milestone_reached") {
    const metadata = asObject(activity.metadata);
    const milestone = Number(metadata?.milestone);
    if (Number.isFinite(milestone) && milestone > 0) {
      return `milestone_reached:${milestone}`;
    }

    return extractMilestoneKey(activity.reason, activity.xpPoints);
  }

  return activity.action;
}

function getConfigActionKey(action: ConfigActionItem) {
  if (action.action === "milestone_reached") {
    return extractMilestoneKey(action.description, action.xpPoints);
  }

  return action.action;
}

function LoadingSkeleton() {
  return (
    <div className="student-gamification-page space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-10 w-28" />
            <Skeleton className="mt-3 h-4 w-40" />
          </Card>
        ))}
      </div>

      <Card>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="mt-5 h-24 w-full rounded-3xl" />
      </Card>

      <Card>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-5 h-44 w-full rounded-3xl" />
      </Card>

      <Card>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-5 h-72 w-full rounded-3xl" />
      </Card>

      <Card>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-5 h-96 w-full rounded-3xl" />
      </Card>
    </div>
  );
}

function StudentProfileEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="student-gamification-page">
      <Card className="border-sky-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.94),rgba(255,255,255,0.98))]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <BookOpen size={22} />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
                Student Portal / Gamification
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-heading">
                {STUDENT_PROFILE_EMPTY_TITLE}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text/72">
                {STUDENT_PROFILE_EMPTY_MESSAGE}
              </p>
            </div>
          </div>
          <Button onClick={onRetry} variant="secondary">
            Retry
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  badge?: string;
  className?: string;
  textClassName?: string;
  badgeClassName?: string;
  icon?: React.ComponentType<{ size?: number }>;
}

function StatCard({
  title,
  value,
  subtitle,
  badge,
  className,
  textClassName,
  badgeClassName,
  icon: Icon,
}: StatCardProps) {
  return (
    <Card className={cn("transition-transform duration-200 hover:-translate-y-0.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text/72">{title}</p>
          <p className={cn("mt-4 text-4xl font-semibold tracking-tight text-heading", textClassName)}>
            {value}
          </p>
          <p className="mt-3 text-sm text-text/72">{subtitle}</p>
        </div>
        {Icon ? (
          <span
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-heading",
              badgeClassName ?? "border-slate-200 bg-white"
            )}
          >
            <Icon size={20} />
          </span>
        ) : null}
      </div>

      {badge ? (
        <div className="mt-5">
          <span
            className={cn(
              "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
              badgeClassName ?? "bg-slate-100 text-slate-700"
            )}
          >
            {badge}
          </span>
        </div>
      ) : null}
    </Card>
  );
}

export default function StudentGamificationPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<StudentPointsSummary | null>(null);
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [profileMissing, setProfileMissing] = useState(false);
  const [configError, setConfigError] = useState("");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showHowToEarn, setShowHowToEarn] = useState(true);

  const totalXpValue = useAnimatedNumber(summary?.totalXP ?? 0);
  const monthlyXpValue = useAnimatedNumber(summary?.pointsThisMonth ?? 0);
  const semesterXpValue = useAnimatedNumber(summary?.pointsThisSemester ?? 0);
  const averageXpValue = useAnimatedNumber(summary?.averagePointsPerModule ?? 0);
  const activityCountValue = useAnimatedNumber(summary?.activityCount ?? 0);

  const totalXpMeta = useMemo(
    () => getTotalXpMeta(summary?.totalXP ?? 0),
    [summary]
  );
  const monthlyMeta = useMemo(
    () => getDeltaMeta(summary?.pointsThisMonth ?? 0),
    [summary]
  );
  const semesterMeta = useMemo(
    () => getDeltaMeta(summary?.pointsThisSemester ?? 0),
    [summary]
  );

  const milestoneProgress = useMemo(
    () => getNextMilestone(summary?.totalXP ?? 0),
    [summary]
  );

  const isEmptyExperience = useMemo(
    () =>
      Boolean(
        summary &&
          summary.totalXP === 0 &&
          summary.activityCount === 0 &&
          summary.recentActivity.length === 0
      ),
    [summary]
  );

  const categoryRows = useMemo(() => {
    const items = summary?.categoryBreakdown ?? [];
    const totalMagnitude = items.reduce(
      (sum, item) => sum + Math.abs(Number(item.totalXP ?? 0)),
      0
    );

    return [...items]
      .sort((left, right) => Number(right.totalXP) - Number(left.totalXP))
      .map((item) => ({
        ...item,
        share:
          totalMagnitude > 0
            ? roundNumber((Math.abs(Number(item.totalXP ?? 0)) / totalMagnitude) * 100, 1)
            : 0,
      }));
  }, [summary]);

  const visibleActivities = useMemo(() => {
    const items = summary?.recentActivity ?? [];
    return showAllActivity ? items : items.slice(0, 5);
  }, [showAllActivity, summary]);

  const achievedActionKeys = useMemo(() => {
    const items = summary?.recentActivity ?? [];
    return new Set(items.map((item) => getAchievedActionKey(item)));
  }, [summary]);

  const groupedActions = useMemo(() => {
    const categoryOrder: PointsCategory[] = [
      "academic",
      "quiz",
      "milestone",
      "bonus",
      "custom",
      "penalty",
      "assignment",
    ];

    const groups = new Map<PointsCategory, ConfigActionItem[]>();
    (config?.actions ?? []).forEach((item) => {
      const bucket = groups.get(item.category) ?? [];
      bucket.push(item);
      groups.set(item.category, bucket);
    });

    return categoryOrder
      .filter((category) => (groups.get(category) ?? []).length > 0)
      .map((category) => ({
        category,
        items: groups.get(category) ?? [],
      }));
  }, [config]);

  useEffect(() => {
    void loadGamification(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadGamification(initial = false) {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");
    setConfigError("");
    setProfileMissing(false);

    try {
      const studentRecord = await resolveCurrentStudentRecord();
      if (!studentRecord) {
        setSummary(null);
        setConfig(null);
        setProfileMissing(true);
        return;
      }

      const [pointsResult, configResult] = await Promise.allSettled([
        fetch(`/api/gamification/points/${encodeURIComponent(studentRecord.id)}`, {
          cache: "no-store",
        }),
        fetch("/api/gamification/config", {
          cache: "no-store",
        }),
      ]);

      if (pointsResult.status !== "fulfilled") {
        throw new Error("Failed to load rewards data");
      }

      const pointsPayload = await readJson<StudentPointsResponse>(pointsResult.value);
      if (!pointsResult.value.ok || !pointsPayload?.success || !pointsPayload.data) {
        throw new Error(pointsPayload?.error || "Failed to load rewards data");
      }

      setSummary(pointsPayload.data);
      setShowAllActivity(false);

      if (configResult.status === "fulfilled") {
        const configPayload = await readJson<GamificationConfigResponse>(configResult.value);
        if (configResult.value.ok && configPayload?.success && configPayload.data) {
          setConfig(configPayload.data);
          setConfigError("");
        } else {
          setConfig(null);
          setConfigError(
            configPayload?.error || "Unable to load XP configuration right now."
          );
        }
      } else {
        setConfig(null);
        setConfigError("Unable to load XP configuration right now.");
      }

      if (!initial) {
        toast({
          title: "Refreshed",
          message: "Rewards data has been updated.",
          variant: "success",
        });
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load rewards data";
      setSummary(null);
      setConfig(null);
      setProfileMissing(false);
      setError(message);
      if (!initial) {
        toast({
          title: "Failed",
          message,
          variant: "error",
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (profileMissing) {
    return <StudentProfileEmptyState onRetry={() => void loadGamification()} />;
  }

  if (error || !summary) {
    return (
      <div className="student-gamification-page space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text/55">
              Student Portal / Gamification
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-heading">
              My XP & Rewards
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text/72">
              Track your XP, milestones, and recent achievement activity in one place.
            </p>
          </div>
        </header>

        <Card className="border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.98))]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-rose-100 text-rose-700">
                <ShieldAlert size={26} />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-rose-800">
                  Failed to load rewards data
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-700/85">
                  {error || "Unable to load rewards data right now."}
                </p>
              </div>
            </div>
            <Button
              className="h-11 min-w-[140px] gap-2 border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
              onClick={() => {
                void loadGamification();
              }}
              variant="secondary"
            >
              <RefreshCw size={16} />
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="student-gamification-page space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text/55">
            Student Portal / Gamification
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-heading">
            My XP & Rewards
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-text/72">
            {summary.student.name} • Registration: {summary.student.registrationNumber}
          </p>
        </div>

        <Button
          className="h-11 gap-2 rounded-2xl border-slate-300 bg-white px-4 text-heading hover:bg-slate-50"
          disabled={refreshing}
          onClick={() => {
            void loadGamification();
          }}
          variant="secondary"
        >
          <RefreshCw className={refreshing ? "animate-spin" : ""} size={16} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          badge="Lifetime Points"
          badgeClassName={totalXpMeta.badge}
          className={totalXpMeta.card}
          icon={Trophy}
          subtitle="Total XP collected across your UniHub journey."
          textClassName={totalXpMeta.text}
          title="Total XP"
          value={`${formatDisplayNumber(totalXpValue, 0)} XP`}
        />
        <StatCard
          badge={summary.pointsThisMonth > 0 ? "Momentum this month" : "Current month"}
          badgeClassName={monthlyMeta.badge}
          className={monthlyMeta.card}
          icon={ArrowUpRight}
          subtitle={
            summary.pointsThisMonth > 0
              ? "You are actively building rewards this month."
              : "No new monthly rewards recorded yet."
          }
          textClassName={monthlyMeta.text}
          title="Points This Month"
          value={`${formatSignedXp(monthlyXpValue, 0)} XP`}
        />
        <StatCard
          badge="Current Semester"
          badgeClassName={semesterMeta.badge}
          className={semesterMeta.card}
          icon={Zap}
          subtitle="XP earned from this semester's academic progress."
          textClassName={semesterMeta.text}
          title="Points This Semester"
          value={`${formatSignedXp(semesterXpValue, 0)} XP`}
        />
        <StatCard
          badge="Per module average"
          badgeClassName="bg-violet-100 text-violet-800"
          className="border-violet-200 bg-[linear-gradient(180deg,rgba(245,243,255,0.96),rgba(255,255,255,0.98))]"
          icon={Target}
          subtitle="Average XP earned for each module you've completed."
          textClassName="text-violet-700"
          title="Average Per Module"
          value={`${formatDisplayNumber(averageXpValue, 1)} XP`}
        />
        <StatCard
          badge="Total Achievements"
          badgeClassName="bg-emerald-100 text-emerald-800"
          className="border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))]"
          icon={Medal}
          subtitle="Every XP award event recorded in your rewards ledger."
          textClassName="text-emerald-700"
          title="Activity Count"
          value={formatDisplayNumber(activityCountValue, 0)}
        />
      </section>

      <section>
        <Card className="border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Target size={20} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-heading">
                  Next Milestone Progress
                </h2>
                <p className="mt-1 text-sm text-text/72">
                  {milestoneProgress.complete
                    ? "All milestone rewards have been unlocked."
                    : `${formatDisplayNumber(milestoneProgress.currentXP, 0)} / ${formatDisplayNumber(milestoneProgress.nextMilestone, 0)} XP to the next milestone`}
                </p>
              </div>
            </div>
            <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-[0_10px_24px_rgba(245,158,11,0.12)]">
              {milestoneProgress.complete
                ? "All milestones achieved!"
                : `${formatDisplayNumber(milestoneProgress.remaining, 0)} XP remaining`}
            </div>
          </div>

          <div className="mt-6">
            <div className="h-4 overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9_0%,#f59e0b_100%)] transition-all duration-700"
                style={{ width: `${milestoneProgress.progress}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-text/72">
              <span>
                {formatDisplayNumber(milestoneProgress.progress, 0)}% to{" "}
                {milestoneProgress.complete
                  ? "your final milestone"
                  : `${formatDisplayNumber(milestoneProgress.nextMilestone, 0)} XP`}
              </span>
              <span className="font-medium text-heading">
                {milestoneProgress.complete
                  ? "600+ XP"
                  : `${formatDisplayNumber(milestoneProgress.currentXP, 0)} XP`}
              </span>
            </div>
          </div>
        </Card>
      </section>

      {isEmptyExperience ? (
        <section>
          <Card className="overflow-hidden border-sky-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))]">
            <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_55%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_50%)]" />
            <div className="relative flex flex-col items-center px-4 py-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-amber-100 text-amber-700 shadow-[0_12px_24px_rgba(245,158,11,0.16)]">
                <Gamepad2 size={34} />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-heading">
                Welcome to UniHub Rewards!
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text/72">
                Start earning XP by completing your modules, hitting high scores,
                and unlocking semester milestones.
              </p>
            </div>
          </Card>
        </section>
      ) : null}

      <section>
        <Card className="border-slate-200 bg-white">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-heading">
                Points Breakdown by Category
              </h2>
              <p className="mt-1 text-sm text-text/72">
                See which types of achievements contribute most to your XP.
              </p>
            </div>
            <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              {formatDisplayNumber(summary.totalXP, 0)} XP total
            </div>
          </div>

          {categoryRows.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-text/72">
              Start earning XP to see your breakdown here!
            </div>
          ) : (
            <>
              <div className="mt-6 flex h-4 overflow-hidden rounded-full bg-slate-100">
                {categoryRows.map((item) => {
                  const meta = getCategoryMeta(item.category);
                  return (
                    <div
                      className={meta.bar}
                      key={item.category}
                      style={{ width: `${item.share}%` }}
                      title={`${meta.label} — ${formatDisplayNumber(item.totalXP, 0)} XP`}
                    />
                  );
                })}
              </div>

              <div className="mt-6 space-y-3">
                {categoryRows.map((item) => {
                  const meta = getCategoryMeta(item.category);
                  const Icon = meta.Icon;
                  return (
                    <div
                      className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 md:grid-cols-[minmax(0,1fr)_160px]"
                      key={item.category}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "inline-flex h-10 w-10 items-center justify-center rounded-2xl border",
                              meta.soft
                            )}
                          >
                            <Icon size={18} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-heading">{meta.label}</p>
                            <p className="mt-1 text-sm text-text/65">
                              {item.count} achievement{item.count === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                          <div
                            className={cn("h-full rounded-full transition-all duration-700", meta.bar)}
                            style={{ width: `${Math.max(item.share, item.share > 0 ? 8 : 0)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 md:flex-col md:items-end md:justify-center">
                        <span className="text-lg font-semibold text-heading">
                          {formatSignedXp(item.totalXP, 0)} XP
                        </span>
                        <span className="text-sm text-text/65">{item.share}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </section>

      <section>
        <Card className="border-slate-200 bg-white">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-heading">Recent Activity</h2>
              <p className="mt-1 text-sm text-text/72">
                Your latest XP awards and milestone unlocks.
              </p>
            </div>
            {summary.recentActivity.length > 5 ? (
              <Button
                className="h-10 gap-2 rounded-2xl border-slate-300 bg-white text-heading hover:bg-slate-50"
                onClick={() => setShowAllActivity((current) => !current)}
                variant="secondary"
              >
                {showAllActivity ? (
                  <>
                    <ChevronUp size={16} />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    View All
                  </>
                )}
              </Button>
            ) : null}
          </div>

          {summary.recentActivity.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-text/72">
              No XP activity yet. Complete modules and quizzes to start earning points!
            </div>
          ) : (
            <>
              <div className="mt-4 text-sm text-text/65">
                Showing latest {visibleActivities.length} of{" "}
                {Math.max(summary.activityCount, summary.recentActivity.length)} activity
                records.
              </div>
              <div className="mt-6 space-y-4">
                {visibleActivities.map((item, index) => {
                  const meta = getCategoryMeta(item.category);
                  const Icon = meta.Icon;
                  const positive = item.xpPoints >= 0;
                  return (
                    <div
                      className="relative rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition-transform duration-200 hover:-translate-y-0.5"
                      key={`${item.action}-${item.createdAt}-${index}`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <div className="flex items-center gap-3 md:w-[160px] md:flex-col md:items-start md:gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-3 py-1.5 text-sm font-semibold",
                              positive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            )}
                          >
                            {formatSignedXp(item.xpPoints, 0)} XP
                          </span>
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-text/52">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold leading-6 text-heading">
                            {item.reason}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold",
                                meta.soft
                              )}
                            >
                              <Icon size={14} />
                              {meta.label}
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-text/65">
                              {collapseSpaces(item.action).replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </section>

      <section>
        <Card className="border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]">
          <button
            className="flex w-full items-center justify-between gap-4 text-left"
            onClick={() => setShowHowToEarn((current) => !current)}
            type="button"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Target size={20} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-heading">How to Earn XP</h2>
                <p className="mt-1 text-sm text-text/72">
                  See which achievements award points and which ones you have already
                  unlocked recently.
                </p>
              </div>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-700">
              {showHowToEarn ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </button>

          {showHowToEarn ? (
            <div className="mt-6 space-y-6">
              {configError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  {configError}
                </div>
              ) : null}

              {!configError && groupedActions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-amber-200 bg-white px-4 py-10 text-center text-sm text-text/72">
                  XP configuration will appear here once it becomes available.
                </div>
              ) : null}

              {groupedActions.map((group) => {
                const meta = getCategoryMeta(group.category);
                const Icon = meta.Icon;

                return (
                  <div className="space-y-4" key={group.category}>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-2xl border",
                          meta.soft
                        )}
                      >
                        <Icon size={18} />
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-heading">{meta.label}</h3>
                        <p className="text-sm text-text/65">
                          {group.items.length} reward action
                          {group.items.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-amber-100 bg-white">
                      <div className="overflow-x-auto">
                        <div className="min-w-[640px]">
                          {group.items.map((item, index) => {
                            const achieved = achievedActionKeys.has(getConfigActionKey(item));
                            return (
                              <div
                                className={cn(
                                  "grid grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-4 px-5 py-4",
                                  index !== group.items.length - 1
                                    ? "border-b border-amber-100"
                                    : ""
                                )}
                                key={`${item.category}-${item.action}-${item.description}-${item.xpPoints}`}
                              >
                                <div className="flex items-start gap-3">
                                  <span
                                    className={cn(
                                      "mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full",
                                      achieved
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-slate-100 text-slate-500"
                                    )}
                                  >
                                    {achieved ? <CheckCircle2 size={14} /> : <Sparkles size={12} />}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-heading">{item.description}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-text/52">
                                      {item.action.replace(/_/g, " ")}
                                    </p>
                                  </div>
                                </div>
                                <div className="justify-self-start md:justify-self-center">
                                  <span
                                    className={cn(
                                      "inline-flex rounded-full px-3 py-1 text-sm font-semibold",
                                      meta.soft
                                    )}
                                  >
                                    +{formatDisplayNumber(item.xpPoints, 0)} XP
                                  </span>
                                </div>
                                <div className="justify-self-start md:justify-self-end">
                                  <span
                                    className={cn(
                                      "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                                      achieved
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-slate-100 text-slate-700"
                                    )}
                                  >
                                    {achieved ? "Achieved" : "Available"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
