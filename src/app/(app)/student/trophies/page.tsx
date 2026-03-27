"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Gem,
  GraduationCap,
  Grid2X2,
  LineChart,
  Lock,
  Medal,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  Trophy,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import {
  formatXPDisplay,
  getLevelBadge,
  type LevelBadge,
  type LevelComparison,
  type LevelConfig,
  type LevelProgress,
} from "@/lib/level-utils";
import {
  isDemoModeEnabled,
  readStoredUser,
  type DemoUser,
} from "@/lib/rbac";

type TrophyTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
type TrophyCategory =
  | "academic"
  | "score"
  | "gpa"
  | "semester"
  | "milestone"
  | "level"
  | "special"
  | "custom";

type ShowcaseFilter = "all" | "earned" | "locked";
type ShowcaseView = "grid" | "list";
type ListSort = "default" | "tier" | "category" | "date";

interface StudentLookupRecord {
  id: string;
  studentId: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface TrophyDefinitionData {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: TrophyTier;
  category: TrophyCategory;
  condition: string;
  xpBonus: number;
}

interface TrophyShowcaseItem {
  definition: TrophyDefinitionData;
  earned: boolean;
  earnedAt: string | null;
  metadata: Record<string, unknown> | null;
}

interface RecentTrophyItem {
  _id?: string;
  trophyKey: string;
  trophyName: string;
  trophyDescription: string;
  trophyIcon: string;
  trophyTier: TrophyTier;
  category: TrophyCategory;
  xpBonusAwarded: number;
  condition: string;
  earnedAt: string;
  academicYear?: string;
  semester?: number;
  metadata?: Record<string, unknown> | null;
}

interface TrophyPageData {
  student: {
    id: string;
    name: string;
    registrationNumber: string;
  };
  level: {
    current: LevelConfig;
    next: LevelConfig | null;
    progress: LevelProgress;
    badge: LevelBadge;
    comparison: LevelComparison;
    totalXP: number;
  };
  trophies: {
    totalAvailable: number;
    totalEarned: number;
    earnedPercentage: number;
    items: TrophyShowcaseItem[];
    byTier: {
      bronze: { total: number; earned: number };
      silver: { total: number; earned: number };
      gold: { total: number; earned: number };
      platinum: { total: number; earned: number };
      diamond: { total: number; earned: number };
    };
    byCategory: Record<string, { total: number; earned: number }>;
    recentlyEarned: RecentTrophyItem[];
  };
}

interface TrophyPageResponse {
  success?: boolean;
  data?: TrophyPageData;
  error?: string;
}

interface MilestoneCheckResult {
  success: boolean;
  studentId: string;
  newTrophiesAwarded: Array<{
    trophyKey: string;
    trophyName: string;
    trophyIcon: string;
    trophyTier: string;
    xpBonusAwarded: number;
    message: string;
  }>;
  totalNewTrophies: number;
  totalXPBonusAwarded: number;
  existingTrophyCount: number;
  errors: string[];
}

interface MilestoneCheckResponse {
  success?: boolean;
  data?: MilestoneCheckResult;
  error?: string;
}

interface TierMeta {
  label: string;
  shortLabel: string;
  Icon: ComponentType<{ className?: string; size?: number }>;
  chip: string;
  card: string;
  glow: string;
  mutedCard: string;
  progress: string;
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

function normalizeText(value: unknown) {
  return collapseSpaces(value).toLowerCase();
}

function roundNumber(value: number, digits = 1) {
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

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function parseStudentItems(payload: unknown): StudentLookupRecord[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const row = item as Record<string, unknown>;
      const id = collapseSpaces(row.id ?? row._id);
      const studentId = collapseSpaces(row.studentId);
      const email = collapseSpaces(row.email).toLowerCase();
      const firstName = collapseSpaces(row.firstName);
      const lastName = collapseSpaces(row.lastName);
      if (!id || !studentId) {
        return null;
      }

      return {
        id,
        studentId,
        email,
        firstName,
        lastName,
      };
    })
    .filter((item): item is StudentLookupRecord => Boolean(item));
}

function buildStudentName(student: StudentLookupRecord) {
  return `${collapseSpaces(student.firstName)} ${collapseSpaces(student.lastName)}`.trim();
}

function findBestStudentMatch(items: StudentLookupRecord[], user: DemoUser) {
  if (items.length === 0) {
    return null;
  }

  const sessionEmail = normalizeText(user.email);
  const sessionUsername = normalizeText(user.username);
  const sessionId = normalizeText(user.id);
  const sessionName = normalizeText(user.name);

  if (sessionEmail) {
    const emailMatch = items.find((item) => normalizeText(item.email) === sessionEmail);
    if (emailMatch) {
      return emailMatch;
    }
  }

  if (sessionUsername) {
    const usernameMatch = items.find(
      (item) => normalizeText(item.studentId) === sessionUsername
    );
    if (usernameMatch) {
      return usernameMatch;
    }
  }

  if (sessionId) {
    const idMatch = items.find(
      (item) =>
        normalizeText(item.id) === sessionId ||
        normalizeText(item.studentId) === sessionId
    );
    if (idMatch) {
      return idMatch;
    }
  }

  if (sessionName) {
    const nameMatch = items.find(
      (item) => normalizeText(buildStudentName(item)) === sessionName
    );
    if (nameMatch) {
      return nameMatch;
    }
  }

  return items.length === 1 ? items[0] : null;
}

async function resolveStudentRecord(user: DemoUser) {
  const candidates = [user.email, user.username, user.id, user.name]
    .map((value) => collapseSpaces(value))
    .filter(Boolean);
  const seen = new Set<string>();
  let hadSuccessfulLookup = false;
  let lastLookupError = "";

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    const response = await fetch(
      `/api/students?search=${encodeURIComponent(candidate)}&page=1&pageSize=100&sort=az`,
      { cache: "no-store" }
    );
    const payload = await readJson<{ error?: string; message?: string; items?: unknown }>(
      response
    );
    if (!response.ok) {
      lastLookupError =
        collapseSpaces(payload?.error ?? payload?.message) ||
        "Failed to look up your student profile.";
      continue;
    }
    hadSuccessfulLookup = true;

    const items = parseStudentItems(payload);
    const match = findBestStudentMatch(items, user);
    if (match) {
      return match;
    }
  }

  if (isDemoModeEnabled()) {
    const response = await fetch("/api/students?page=1&pageSize=100&sort=az", {
      cache: "no-store",
    });
    const payload = await readJson<{ error?: string; message?: string; items?: unknown }>(
      response
    );
    if (response.ok) {
      hadSuccessfulLookup = true;
      return parseStudentItems(payload)[0] ?? null;
    }

    lastLookupError =
      collapseSpaces(payload?.error ?? payload?.message) ||
      "Failed to look up your student profile.";
  }

  if (!hadSuccessfulLookup && lastLookupError) {
    throw new Error(lastLookupError);
  }

  return null;
}

function useAnimatedNumber(target: number, duration = 900) {
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

function getTierMeta(tier: TrophyTier): TierMeta {
  if (tier === "bronze") {
    return {
      label: "Bronze",
      shortLabel: "Bronze",
      Icon: Medal,
      chip: "bg-amber-100 text-amber-800",
      card: "border-orange-300 bg-[linear-gradient(180deg,rgba(255,247,237,0.96),rgba(255,255,255,0.98))]",
      glow: "shadow-[0_18px_42px_rgba(234,88,12,0.14)]",
      mutedCard: "border-orange-100 bg-slate-50",
      progress: "bg-orange-500",
    };
  }
  if (tier === "silver") {
    return {
      label: "Silver",
      shortLabel: "Silver",
      Icon: Award,
      chip: "bg-slate-200 text-slate-700",
      card: "border-slate-300 bg-[linear-gradient(180deg,rgba(241,245,249,0.98),rgba(255,255,255,0.98))]",
      glow: "shadow-[0_18px_42px_rgba(100,116,139,0.16)]",
      mutedCard: "border-slate-200 bg-slate-50",
      progress: "bg-slate-500",
    };
  }
  if (tier === "gold") {
    return {
      label: "Gold",
      shortLabel: "Gold",
      Icon: Trophy,
      chip: "bg-yellow-100 text-yellow-800",
      card: "border-yellow-300 bg-[linear-gradient(180deg,rgba(254,249,195,0.98),rgba(255,255,255,0.98))]",
      glow: "shadow-[0_18px_42px_rgba(234,179,8,0.16)]",
      mutedCard: "border-yellow-100 bg-slate-50",
      progress: "bg-yellow-500",
    };
  }
  if (tier === "platinum") {
    return {
      label: "Platinum",
      shortLabel: "Platinum",
      Icon: Star,
      chip: "bg-indigo-100 text-indigo-800",
      card: "border-indigo-300 bg-[linear-gradient(180deg,rgba(224,231,255,0.98),rgba(255,255,255,0.98))]",
      glow: "shadow-[0_18px_42px_rgba(99,102,241,0.16)]",
      mutedCard: "border-indigo-100 bg-slate-50",
      progress: "bg-indigo-500",
    };
  }
  return {
    label: "Diamond",
    shortLabel: "Diamond",
    Icon: Gem,
    chip: "bg-cyan-100 text-cyan-800",
    card: "border-cyan-300 bg-[linear-gradient(180deg,rgba(236,254,255,0.98),rgba(255,255,255,0.98))]",
    glow: "shadow-[0_18px_42px_rgba(6,182,212,0.16)]",
    mutedCard: "border-cyan-100 bg-slate-50",
    progress: "bg-cyan-500",
  };
}

function getCategoryMeta(category: TrophyCategory) {
  if (category === "academic") {
    return {
      label: "Academic",
      Icon: GraduationCap,
      chip: "bg-sky-100 text-sky-800",
      soft: "border-sky-200 bg-sky-50 text-sky-700",
      progress: "bg-sky-500",
    };
  }
  if (category === "score") {
    return {
      label: "Score",
      Icon: Target,
      chip: "bg-emerald-100 text-emerald-800",
      soft: "border-emerald-200 bg-emerald-50 text-emerald-700",
      progress: "bg-emerald-500",
    };
  }
  if (category === "gpa") {
    return {
      label: "GPA",
      Icon: LineChart,
      chip: "bg-violet-100 text-violet-800",
      soft: "border-violet-200 bg-violet-50 text-violet-700",
      progress: "bg-violet-500",
    };
  }
  if (category === "semester") {
    return {
      label: "Semester",
      Icon: Medal,
      chip: "bg-amber-100 text-amber-800",
      soft: "border-amber-200 bg-amber-50 text-amber-700",
      progress: "bg-amber-500",
    };
  }
  if (category === "milestone") {
    return {
      label: "Milestone",
      Icon: Trophy,
      chip: "bg-rose-100 text-rose-800",
      soft: "border-rose-200 bg-rose-50 text-rose-700",
      progress: "bg-rose-500",
    };
  }
  if (category === "level") {
    return {
      label: "Level",
      Icon: Star,
      chip: "bg-blue-100 text-blue-800",
      soft: "border-blue-200 bg-blue-50 text-blue-700",
      progress: "bg-blue-500",
    };
  }
  if (category === "special") {
    return {
      label: "Special",
      Icon: Gem,
      chip: "bg-cyan-100 text-cyan-800",
      soft: "border-cyan-200 bg-cyan-50 text-cyan-700",
      progress: "bg-cyan-500",
    };
  }
  return {
    label: "Custom",
    Icon: Award,
    chip: "bg-teal-100 text-teal-800",
    soft: "border-teal-200 bg-teal-50 text-teal-700",
    progress: "bg-teal-500",
  };
}

function getLevelIcon(level: Pick<LevelConfig, "level" | "color">) {
  if (level.level >= 4 || level.color === "amber") return Trophy;
  if (level.level === 3 || level.color === "purple") return GraduationCap;
  if (level.level === 2 || level.color === "blue") return LineChart;
  return BookOpen;
}

function getLevelHeroClasses(color: LevelConfig["color"]) {
  if (color === "blue") {
    return {
      card: "border-blue-200 bg-[linear-gradient(135deg,rgba(219,234,254,0.98),rgba(255,255,255,0.98))]",
      progress: "bg-blue-500",
      glow: "shadow-[0_18px_48px_rgba(59,130,246,0.14)]",
    };
  }
  if (color === "purple") {
    return {
      card: "border-purple-200 bg-[linear-gradient(135deg,rgba(243,232,255,0.98),rgba(255,255,255,0.98))]",
      progress: "bg-purple-500",
      glow: "shadow-[0_18px_48px_rgba(147,51,234,0.16)]",
    };
  }
  if (color === "amber") {
    return {
      card: "border-amber-200 bg-[linear-gradient(135deg,rgba(254,243,199,0.98),rgba(255,255,255,0.98))]",
      progress: "bg-amber-500",
      glow: "shadow-[0_18px_48px_rgba(245,158,11,0.18)]",
    };
  }
  return {
    card: "border-slate-200 bg-[linear-gradient(135deg,rgba(241,245,249,0.98),rgba(255,255,255,0.98))]",
    progress: "bg-slate-500",
    glow: "shadow-[0_18px_48px_rgba(100,116,139,0.14)]",
  };
}

function getRoadmapStatusMeta(status: "completed" | "current" | "locked") {
  if (status === "completed") {
    return {
      node: "border-emerald-300 bg-emerald-100 text-emerald-700",
      label: "COMPLETED",
      pill: "bg-emerald-100 text-emerald-800",
      connector: "bg-emerald-400",
    };
  }
  if (status === "current") {
    return {
      node: "border-blue-300 bg-white text-blue-700 shadow-[0_0_0_10px_rgba(191,219,254,0.55)]",
      label: "CURRENT",
      pill: "bg-blue-100 text-blue-800",
      connector: "bg-slate-200",
    };
  }
  return {
    node: "border-slate-200 bg-slate-100 text-slate-500",
    label: "LOCKED",
    pill: "bg-slate-100 text-slate-600",
    connector: "bg-slate-200",
  };
}

function getFocusTrapElements(container: HTMLDivElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("disabled"));
}

function getMotivationalMessage(item: TrophyShowcaseItem) {
  if (item.definition.tier === "diamond" || item.definition.tier === "platinum") {
    return "This is a rare achievement. Only the most consistent students earn it.";
  }

  return "Keep going! You're building momentum toward this unlock.";
}

function getProgressHint(
  item: TrophyShowcaseItem,
  totalXP: number
): { label: string; percentage: number } | null {
  const thresholds: Record<string, number> = {
    xp_beginner: 100,
    xp_intermediate: 300,
    xp_champion: 600,
    level_2_reached: 100,
    level_3_reached: 300,
    level_4_reached: 600,
  };

  const threshold = thresholds[item.definition.key];
  if (!threshold) {
    return null;
  }

  return {
    label: `${formatXPDisplay(totalXP)} / ${formatXPDisplay(threshold)}`,
    percentage: Math.min(100, roundNumber((Math.max(0, totalXP) / threshold) * 100, 1)),
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      <Card>
        <Skeleton className="h-56 w-full rounded-[28px]" />
      </Card>

      <Card>
        <Skeleton className="h-56 w-full rounded-[28px]" />
      </Card>

      <Card>
        <Skeleton className="h-20 w-full rounded-[28px]" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-56 w-full rounded-[28px]" />
          ))}
        </div>
      </Card>
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
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
              Student Portal / Trophies
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-heading">
              {STUDENT_PROFILE_EMPTY_TITLE}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text/72">
              {STUDENT_PROFILE_EMPTY_MESSAGE}
            </p>
          </div>
        </div>
        <Button className="gap-2" onClick={onRetry} variant="secondary">
          <RefreshCw size={16} />
          Retry
        </Button>
      </div>
    </Card>
  );
}

function EmptyStateTip({ item }: { item: TrophyShowcaseItem | null }) {
  if (!item) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] px-5 py-5">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
        Quick Start Tip
      </p>
      <div className="mt-3 flex items-start gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-[0_12px_24px_rgba(245,158,11,0.12)]">
          {(() => {
            const Icon = getCategoryMeta(item.definition.category).Icon;
            return <Icon size={22} />;
          })()}
        </span>
        <div>
          <h3 className="text-lg font-semibold text-heading">
            Unlock &ldquo;{item.definition.name}&rdquo;
          </h3>
          <p className="mt-1 text-sm leading-6 text-text/72">
            {item.definition.description}
          </p>
          <p className="mt-2 text-sm font-medium text-amber-800">
            Tip: {item.definition.condition}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StudentTrophiesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<TrophyPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [profileMissing, setProfileMissing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ShowcaseFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TrophyCategory>("all");
  const [tierFilter, setTierFilter] = useState<"all" | TrophyTier>("all");
  const [viewMode, setViewMode] = useState<ShowcaseView>("grid");
  const [listSort, setListSort] = useState<ListSort>("default");
  const [selectedTrophy, setSelectedTrophy] = useState<TrophyShowcaseItem | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const animatedXP = useAnimatedNumber(data?.level.totalXP ?? 0, 900);
  const animatedEarnedCount = useAnimatedNumber(data?.trophies.totalEarned ?? 0, 900);
  const animatedEarnedPercentage = useAnimatedNumber(data?.trophies.earnedPercentage ?? 0, 900);
  const currentBadge = useMemo(
    () => getLevelBadge(data?.level.totalXP ?? 0),
    [data]
  );
  const heroMeta = useMemo(
    () => getLevelHeroClasses(data?.level.current.color ?? "gray"),
    [data]
  );

  const categoryOrder: TrophyCategory[] = useMemo(
    () => ["academic", "score", "gpa", "semester", "milestone", "level", "special", "custom"],
    []
  );

  const easiestLockedTrophy = useMemo(
    () =>
      data?.trophies.items.find(
        (item) => !item.earned && item.definition.key === "first_module_passed"
      ) ??
      data?.trophies.items.find((item) => !item.earned) ??
      null,
    [data]
  );

  const filteredTrophies = useMemo(() => {
    const items = [...(data?.trophies.items ?? [])].filter((item) => {
      if (statusFilter === "earned" && !item.earned) {
        return false;
      }
      if (statusFilter === "locked" && item.earned) {
        return false;
      }
      if (categoryFilter !== "all" && item.definition.category !== categoryFilter) {
        return false;
      }
      if (tierFilter !== "all" && item.definition.tier !== tierFilter) {
        return false;
      }

      return true;
    });

    if (listSort === "tier") {
      items.sort((left, right) => {
        const tierScore =
          ["diamond", "platinum", "gold", "silver", "bronze"].indexOf(
            right.definition.tier
          ) -
          ["diamond", "platinum", "gold", "silver", "bronze"].indexOf(
            left.definition.tier
          );
        if (tierScore !== 0) {
          return tierScore;
        }
        return left.definition.name.localeCompare(right.definition.name);
      });
    } else if (listSort === "category") {
      items.sort((left, right) => {
        const categoryScore =
          categoryOrder.indexOf(left.definition.category) -
          categoryOrder.indexOf(right.definition.category);
        if (categoryScore !== 0) {
          return categoryScore;
        }
        return left.definition.name.localeCompare(right.definition.name);
      });
    } else if (listSort === "date") {
      items.sort(
        (left, right) =>
          new Date(right.earnedAt ?? 0).getTime() - new Date(left.earnedAt ?? 0).getTime()
      );
    }

    return items;
  }, [categoryFilter, categoryOrder, data, listSort, statusFilter, tierFilter]);

  const recentTrophies = useMemo(
    () => data?.trophies.recentlyEarned ?? [],
    [data]
  );

  const categorySections = useMemo(() => {
    if (!data) {
      return [];
    }

    return categoryOrder
      .filter((category) => data.trophies.byCategory[category])
      .map((category) => ({
        category,
        stats: data.trophies.byCategory[category],
        items: data.trophies.items.filter((item) => item.definition.category === category),
      }));
  }, [categoryOrder, data]);

  useEffect(() => {
    void loadTrophies(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedTrophy) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTrophy(null);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusTrapElements(modalRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTrophy]);

  async function loadTrophies(initial = false) {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");
    setProfileMissing(false);

    try {
      const sessionUser = readStoredUser();
      const effectiveUser =
        sessionUser ??
        (isDemoModeEnabled()
          ? ({
              id: "",
              name: "Demo Student",
              role: "STUDENT",
            } satisfies DemoUser)
          : null);

      if (!effectiveUser) {
        throw new Error("No student session found. Please sign in again.");
      }

      const studentRecord = await resolveStudentRecord(effectiveUser);
      if (!studentRecord) {
        setData(null);
        setProfileMissing(true);
        return;
      }

      const response = await fetch(`/api/gamification/trophies/${studentRecord.id}`, {
        cache: "no-store",
      });
      const payload = await readJson<TrophyPageResponse>(response);

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error ?? "Failed to load levels and trophies.");
      }

      setData(payload.data);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load levels and trophies.";
      setProfileMissing(false);
      setError(message);
      toast({
        title: "Failed",
        message,
        variant: "error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleCheckMilestones() {
    if (!data?.student.id) {
      return;
    }

    setChecking(true);
    try {
      const response = await fetch(
        `/api/gamification/trophies/${data.student.id}/check`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const payload = await readJson<MilestoneCheckResponse>(response);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error ?? "Failed to check for new trophies.");
      }

      if (payload.data.newTrophiesAwarded.length > 0) {
        const unlocked = payload.data.newTrophiesAwarded
          .map((item) => item.trophyName)
          .join(", ");
        toast({
          title: "New trophies unlocked",
          message: unlocked,
          variant: "success",
        });
      } else {
        toast({
          title: "All caught up",
          message: "No new trophies are available right now.",
          variant: "success",
        });
      }

      await loadTrophies(false);
    } catch (checkError) {
      const message =
        checkError instanceof Error ? checkError.message : "Failed to check trophies.";
      toast({
        title: "Failed",
        message,
        variant: "error",
      });
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (profileMissing) {
    return <StudentProfileEmptyState onRetry={() => void loadTrophies(false)} />;
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-text/55">
            Student Portal / Levels &amp; Trophies
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-heading">
            Levels &amp; Trophies
          </h1>
          <p className="max-w-2xl text-base leading-7 text-text/72">
            Track your level progression, trophy cabinet, and milestone unlocks.
          </p>
        </div>

        <Card className="border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.92),rgba(255,255,255,0.98))]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <ShieldAlert size={24} />
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-heading">
                  Failed to load levels and trophies
                </h2>
                <p className="mt-2 text-sm leading-6 text-text/72">
                  {error || "Something went wrong while loading your achievement data."}
                </p>
              </div>
            </div>
            <Button
              className="gap-2"
              onClick={() => void loadTrophies(false)}
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
    <>
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-text/55">
            Student Portal / Levels &amp; Trophies
          </p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-heading">
                Levels &amp; Trophies
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-text/72">
                {data.student.name} • {data.student.registrationNumber}
              </p>
              <p className="mt-2 max-w-3xl text-base leading-7 text-text/72">
                Explore your level progression, unlock roadmap, trophy cabinet, and recent
                achievements in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="gap-2"
                disabled={checking}
                onClick={() => void handleCheckMilestones()}
              >
                {checking ? (
                  <RefreshCw className="animate-spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                Check for New Trophies
              </Button>
              <Button
                className="gap-2"
                disabled={refreshing}
                onClick={() => void loadTrophies(false)}
                variant="secondary"
              >
                <RefreshCw className={refreshing ? "animate-spin" : ""} size={16} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <section>
          <Card className={cn("overflow-hidden", heroMeta.card, heroMeta.glow)}>
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.7),transparent_55%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.5),transparent_45%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-4">
                  <span
                    aria-label={`${data.level.current.name} level icon`}
                    className="inline-flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                  >
                    {(() => {
                      const Icon = getLevelIcon(data.level.current);
                      return <Icon size={36} />;
                    })()}
                  </span>
                  <div>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                        currentBadge.bgColor,
                        currentBadge.textColor
                      )}
                    >
                      Level {data.level.current.level}
                    </span>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
                      {data.level.current.name}
                    </h2>
                    <p className="mt-1 text-lg font-medium text-text/78">
                      {data.level.current.title}
                    </p>
                  </div>
                </div>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-text/72">
                  {data.level.current.description}
                </p>
              </div>

              <div className="w-full max-w-xl rounded-[28px] border border-white/70 bg-white/85 px-5 py-5 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-text/65">Total XP</p>
                    <p className="mt-2 text-4xl font-semibold tracking-tight text-heading">
                      {formatXPDisplay(Math.round(animatedXP))}
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    {data.level.progress.isMaxLevel
                      ? "Max Level Reached"
                      : `${formatXPDisplay(data.level.progress.xpRemainingToNextLevel)} to ${data.level.next?.name ?? "next level"}`}
                  </div>
                </div>

                <div className="mt-6">
                  <div
                    aria-label="Level progression toward the next level"
                    className="h-4 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={data.level.progress.progressPercentage}
                  >
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", heroMeta.progress)}
                      style={{ width: `${data.level.progress.progressPercentage}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-text/72">
                    <span>
                      {formatDisplayNumber(data.level.progress.progressPercentage, 1)}% through{" "}
                      {data.level.current.name}
                    </span>
                    <span>
                      {data.level.progress.isMaxLevel
                        ? "Champion tier complete"
                        : `${formatDisplayNumber(data.level.progress.xpInCurrentLevel, 0)} / ${formatDisplayNumber(data.level.progress.xpRequiredForNextLevel, 0)} XP`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {recentTrophies.length > 0 ? (
          <section>
            <Card className="border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Sparkles size={20} />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold text-heading">Recently Earned</h2>
                  <p className="mt-1 text-sm text-text/72">
                    Your latest trophy unlocks, highlighted like a hall of fame strip.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
                {recentTrophies.map((item) => {
                  const tierMeta = getTierMeta(item.trophyTier);
                  return (
                    <button
                      className={cn(
                        "min-w-[260px] rounded-[28px] border px-5 py-5 text-left transition-all duration-200 hover:-translate-y-1",
                        tierMeta.card,
                        tierMeta.glow
                      )}
                      key={`${item.trophyKey}-${item.earnedAt}`}
                      onClick={() =>
                        setSelectedTrophy(
                          data.trophies.items.find(
                            (candidate) => candidate.definition.key === item.trophyKey
                          ) ?? null
                        )
                      }
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          aria-label={`${item.trophyName} trophy`}
                          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-heading shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
                        >
                          {(() => {
                            const Icon = getCategoryMeta(item.category).Icon;
                            return <Icon size={24} />;
                          })()}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                            tierMeta.chip
                          )}
                        >
                          <tierMeta.Icon size={14} />
                          {tierMeta.shortLabel}
                        </span>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-heading">
                        {item.trophyName}
                      </h3>
                      <p className="mt-2 text-sm text-text/72">
                        Earned {formatRelativeTime(item.earnedAt)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Card>
          </section>
        ) : null}

        <section>
          <Card className="border-slate-200 bg-white">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-heading">Trophy Collection</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text/72">
                  Your personal achievement cabinet, with earned trophies displayed first and
                  aspirational trophies still visible as future targets.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-heading">
                  {formatDisplayNumber(animatedEarnedCount, 0)} /{" "}
                  {data.trophies.totalAvailable} Trophies Earned
                </div>
                <div className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
                  {formatDisplayNumber(animatedEarnedPercentage, 1)}% complete
                </div>
              </div>
            </div>

            <div
              aria-label="Trophy collection completion"
              className="mt-6 h-4 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#8b5cf6_55%,#06b6d4_100%)] transition-all duration-700"
                style={{ width: `${data.trophies.earnedPercentage}%` }}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
              {(["bronze", "silver", "gold", "platinum", "diamond"] as TrophyTier[]).map(
                (tier) => {
                  const tierMeta = getTierMeta(tier);
                  const stats = data.trophies.byTier[tier];
                  return (
                    <span
                      className={cn("rounded-full px-3 py-1", tierMeta.chip)}
                      key={tier}
                    >
                      <span className="inline-flex items-center gap-2">
                        <tierMeta.Icon size={14} />
                        {tierMeta.shortLabel} {stats.earned} / {stats.total}
                      </span>
                    </span>
                  );
                }
              )}
            </div>

            <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-3 md:grid-cols-3">
                {(["all", "earned", "locked"] as ShowcaseFilter[]).map((filter) => (
                  <button
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors",
                      statusFilter === filter
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-text/75 hover:bg-slate-50"
                    )}
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    type="button"
                  >
                    {filter === "all"
                      ? "All"
                      : filter === "earned"
                        ? "Earned"
                        : "Locked"}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <select
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-heading outline-none"
                  onChange={(event) =>
                    setCategoryFilter(event.target.value as "all" | TrophyCategory)
                  }
                  value={categoryFilter}
                >
                  <option value="all">All Categories</option>
                  {categoryOrder.map((category) => (
                    <option key={category} value={category}>
                      {getCategoryMeta(category).label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-heading outline-none"
                  onChange={(event) =>
                    setTierFilter(event.target.value as "all" | TrophyTier)
                  }
                  value={tierFilter}
                >
                  <option value="all">All Tiers</option>
                  {(["bronze", "silver", "gold", "platinum", "diamond"] as TrophyTier[]).map(
                    (tier) => (
                      <option key={tier} value={tier}>
                        {getTierMeta(tier).label}
                      </option>
                    )
                  )}
                </select>
                <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <button
                    className={cn(
                      "inline-flex h-11 items-center gap-2 px-4 text-sm font-semibold transition-colors",
                      viewMode === "grid"
                        ? "bg-slate-900 text-white"
                        : "text-text/72 hover:bg-slate-50"
                    )}
                    onClick={() => setViewMode("grid")}
                    type="button"
                  >
                    <Grid2X2 size={16} />
                    Grid
                  </button>
                  <button
                    className={cn(
                      "inline-flex h-11 items-center gap-2 px-4 text-sm font-semibold transition-colors",
                      viewMode === "list"
                        ? "bg-slate-900 text-white"
                        : "text-text/72 hover:bg-slate-50"
                    )}
                    onClick={() => setViewMode("list")}
                    type="button"
                  >
                    <Medal size={16} />
                    List
                  </button>
                </div>
                {viewMode === "list" ? (
                  <select
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-heading outline-none"
                    onChange={(event) => setListSort(event.target.value as ListSort)}
                    value={listSort}
                  >
                    <option value="default">Default order</option>
                    <option value="tier">Sort by tier</option>
                    <option value="category">Sort by category</option>
                    <option value="date">Sort by date</option>
                  </select>
                ) : null}
              </div>
            </div>

            {data.trophies.totalEarned === 0 ? (
              <div className="mt-8 space-y-5">
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-4xl">🏆</p>
                  <h3 className="mt-4 text-2xl font-semibold text-heading">
                    Your trophy cabinet is waiting!
                  </h3>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text/72">
                    Complete modules and earn XP to unlock your first trophy. Every big
                    achievement starts with the first one.
                  </p>
                </div>
                <EmptyStateTip item={easiestLockedTrophy} />
              </div>
            ) : null}

            <div className="mt-8">
              {viewMode === "grid" ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredTrophies.map((item) => {
                    const tierMeta = getTierMeta(item.definition.tier);
                    const categoryMeta = getCategoryMeta(item.definition.category);
                    return (
                      <button
                        className={cn(
                          "group relative overflow-hidden rounded-[28px] border px-5 py-5 text-left transition-all duration-200 hover:-translate-y-1",
                          item.earned
                            ? cn(tierMeta.card, tierMeta.glow)
                            : cn("opacity-90", tierMeta.mutedCard)
                        )}
                        key={item.definition.key}
                        onClick={() => setSelectedTrophy(item)}
                        type="button"
                      >
                        <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.45),transparent_55%)]" />
                        <div className="relative">
                          <div className="flex items-start justify-between gap-3">
                            <span
                              aria-label={`${item.definition.name} icon`}
                              className={cn(
                                "inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-transform duration-200",
                                item.earned ? "group-hover:scale-105" : "opacity-60"
                              )}
                            >
                              {(() => {
                                const Icon = categoryMeta.Icon;
                                return <Icon size={26} />;
                              })()}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "rounded-full px-3 py-1 text-xs font-semibold",
                                  tierMeta.chip
                                )}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <tierMeta.Icon size={14} />
                                  {tierMeta.shortLabel}
                                </span>
                              </span>
                              {!item.earned ? (
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-500">
                                  <Lock size={16} />
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <h3 className="mt-5 text-lg font-semibold text-heading">
                            {item.definition.name}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-text/72">
                            {item.definition.description}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span
                              className={cn(
                                "rounded-full px-3 py-1 text-xs font-semibold",
                                categoryMeta.chip
                              )}
                            >
                              {categoryMeta.label}
                            </span>
                            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-text/72">
                              +{formatDisplayNumber(item.definition.xpBonus, 0)} XP
                            </span>
                          </div>

                          <div className="mt-5 rounded-2xl bg-white/80 px-4 py-3 text-sm text-text/72">
                            {item.earned ? (
                              <>
                                <p className="font-semibold text-heading">Earned</p>
                                <p className="mt-1">
                                  {formatDate(item.earnedAt) ?? "Achievement recorded"}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-semibold text-heading">Condition</p>
                                <p className="mt-1">{item.definition.condition}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-[960px] w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-text/52">
                        <tr>
                          <th className="px-4 py-3">Trophy</th>
                          <th className="px-4 py-3">Tier</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Condition</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Earned Date</th>
                          <th className="px-4 py-3">XP Bonus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTrophies.map((item) => {
                          const tierMeta = getTierMeta(item.definition.tier);
                          const categoryMeta = getCategoryMeta(item.definition.category);
                          return (
                            <tr
                              className={cn(
                                "cursor-pointer border-t border-slate-200 transition-colors hover:bg-slate-50",
                                item.earned ? "" : "opacity-80"
                              )}
                              key={item.definition.key}
                              onClick={() => setSelectedTrophy(item)}
                            >
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <span
                                    aria-label={`${item.definition.name} icon`}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-heading"
                                  >
                                    <categoryMeta.Icon size={18} />
                                  </span>
                                  <div>
                                    <p className="font-semibold text-heading">
                                      {item.definition.name}
                                    </p>
                                    <p className="mt-1 text-xs text-text/60">
                                      {item.definition.description}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={cn(
                                    "rounded-full px-3 py-1 text-xs font-semibold",
                                    tierMeta.chip
                                  )}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <tierMeta.Icon size={14} />
                                    {tierMeta.shortLabel}
                                  </span>
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={cn(
                                    "rounded-full px-3 py-1 text-xs font-semibold",
                                    categoryMeta.chip
                                  )}
                                >
                                  {categoryMeta.label}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-text/72">
                                {item.definition.condition}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                                    item.earned
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                  )}
                                >
                                  {item.earned ? <CheckCircle2 size={14} /> : <Lock size={14} />}
                                  {item.earned ? "Earned" : "Locked"}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-text/72">
                                {formatDate(item.earnedAt) ?? "—"}
                              </td>
                              <td className="px-4 py-4 font-semibold text-heading">
                                +{formatDisplayNumber(item.definition.xpBonus, 0)} XP
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>

        <section>
          <Card className="border-slate-200 bg-white">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-heading">
                <Star size={22} />
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-heading">Level Roadmap</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text/72">
                  Follow your journey from novice scholar to campus champion. Completed
                  levels are locked in, your current level is highlighted, and future levels
                  stay visible as targets.
                </p>
              </div>
            </div>

            <div className="mt-8 hidden lg:flex lg:items-start lg:justify-between lg:gap-4">
              {data.level.comparison.levels.map((item, index) => {
                const statusMeta = getRoadmapStatusMeta(item.status);
                const badge = getLevelBadge(item.config.minXP);
                const hasNext = index < data.level.comparison.levels.length - 1;
                return (
                  <div className="flex flex-1 items-center gap-4" key={item.config.level}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col items-center text-center">
                        <span
                          className={cn(
                            "inline-flex h-20 w-20 items-center justify-center rounded-[28px] border",
                            item.status === "current"
                              ? cn(statusMeta.node, badge.borderColor)
                              : statusMeta.node
                          )}
                          role="img"
                          aria-label={`${item.config.name} level`}
                        >
                          {(() => {
                            if (item.status === "completed") {
                              return <CheckCircle2 size={28} />;
                            }
                            if (item.status === "locked") {
                              return <Lock size={26} />;
                            }
                            const Icon = getLevelIcon(item.config);
                            return <Icon size={32} />;
                          })()}
                        </span>
                        <p className="mt-4 text-lg font-semibold text-heading">
                          {item.config.name}
                        </p>
                        <p className="mt-1 text-sm text-text/65">{item.config.title}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-text/52">
                          {formatXPDisplay(item.config.minXP)}
                        </p>
                        <span
                          className={cn(
                            "mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                            statusMeta.pill
                          )}
                        >
                          {statusMeta.label}
                        </span>
                        {item.status === "current" ? (
                          <div className="mt-4 w-full max-w-[180px]">
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={cn("h-full rounded-full transition-all duration-700", heroMeta.progress)}
                                style={{ width: `${item.progressInLevel}%` }}
                              />
                            </div>
                            <p className="mt-2 text-xs text-text/60">
                              {formatDisplayNumber(item.progressInLevel, 1)}% complete
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {hasNext ? (
                      <div className="flex flex-1 items-center pt-10">
                        <div
                          className={cn(
                            "h-1.5 w-full rounded-full",
                            item.status === "completed" ? "bg-emerald-400" : "bg-slate-200"
                          )}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 space-y-4 lg:hidden">
              {data.level.comparison.levels.map((item, index) => {
                const statusMeta = getRoadmapStatusMeta(item.status);
                const hasNext = index < data.level.comparison.levels.length - 1;
                return (
                  <div className="relative pl-16" key={item.config.level}>
                    <span
                      className={cn(
                        "absolute left-0 top-0 inline-flex h-12 w-12 items-center justify-center rounded-2xl border",
                        statusMeta.node
                      )}
                      role="img"
                      aria-label={`${item.config.name} level`}
                    >
                      {(() => {
                        if (item.status === "completed") {
                          return <CheckCircle2 size={20} />;
                        }
                        if (item.status === "locked") {
                          return <Lock size={18} />;
                        }
                        const Icon = getLevelIcon(item.config);
                        return <Icon size={20} />;
                      })()}
                    </span>
                    {hasNext ? (
                      <span className="absolute left-[23px] top-14 h-[calc(100%-2.5rem)] w-[2px] rounded-full bg-slate-200" />
                    ) : null}
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-heading">{item.config.name}</p>
                          <p className="mt-1 text-sm text-text/65">{item.config.title}</p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                            statusMeta.pill
                          )}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-text/52">
                        Starts at {formatXPDisplay(item.config.minXP)}
                      </p>
                      {item.status === "current" ? (
                        <div className="mt-4">
                          <div className="h-2 overflow-hidden rounded-full bg-white">
                            <div
                              className={cn("h-full rounded-full transition-all duration-700", heroMeta.progress)}
                              style={{ width: `${item.progressInLevel}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        <section>
          <Card className="border-slate-200 bg-white">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-heading">
                <BookOpen size={20} />
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-heading">Trophy Progress by Category</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text/72">
                  Track how close you are to clearing each trophy category and see which
                  categories already have strong momentum.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {categorySections.map((section) => {
                const meta = getCategoryMeta(section.category);
                const Icon = meta.Icon as ComponentType<{ size?: number }>;
                const percentage =
                  section.stats.total > 0
                    ? roundNumber((section.stats.earned / section.stats.total) * 100, 1)
                    : 0;

                return (
                  <div
                    className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5"
                    key={section.category}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl border", meta.soft)}>
                          <Icon size={18} />
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold text-heading">{meta.label}</h3>
                          <p className="mt-1 text-sm text-text/65">
                            {section.stats.earned} / {section.stats.total} trophies earned
                          </p>
                        </div>
                      </div>
                      <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", meta.chip)}>
                        {formatDisplayNumber(percentage, 1)}%
                      </span>
                    </div>

                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={`${meta.label} trophy progress`}>
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", meta.progress)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                        {section.items.map((item) => (
                          <button
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                            item.earned
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-text/68 hover:bg-slate-100"
                          )}
                          key={item.definition.key}
                          onClick={() => setSelectedTrophy(item)}
                          type="button"
                          >
                          <span
                            aria-label={`${item.definition.name} icon`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-heading"
                          >
                            {(() => {
                              const Icon = getCategoryMeta(item.definition.category).Icon;
                              return <Icon size={14} />;
                            })()}
                          </span>
                          <span className="max-w-[180px] truncate">{item.definition.name}</span>
                          {item.earned ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      </div>

      {selectedTrophy ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTrophy(null);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
            ref={modalRef}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text/55">
                Trophy Details
              </p>
              <button
                aria-label="Close trophy details"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
                onClick={() => setSelectedTrophy(null)}
                ref={closeButtonRef}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-6 sm:px-8 sm:py-8">
              {(() => {
                const tierMeta = getTierMeta(selectedTrophy.definition.tier);
                const categoryMeta = getCategoryMeta(selectedTrophy.definition.category);
                const progressHint = getProgressHint(selectedTrophy, data.level.totalXP);
                const metadataEntries = Object.entries(selectedTrophy.metadata ?? {});
                return (
                  <div className="space-y-6">
                    <div
                      className={cn(
                        "rounded-[32px] border px-6 py-6",
                        selectedTrophy.earned ? cn(tierMeta.card, tierMeta.glow) : tierMeta.mutedCard
                      )}
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                          <span
                            aria-label={`${selectedTrophy.definition.name} icon`}
                            className={cn(
                              "inline-flex h-24 w-24 items-center justify-center rounded-[30px] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]",
                              selectedTrophy.earned ? "" : "opacity-60"
                            )}
                          >
                            <categoryMeta.Icon size={40} />
                          </span>
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", tierMeta.chip)}>
                                <tierMeta.Icon size={14} />
                                {tierMeta.shortLabel}
                              </span>
                              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", categoryMeta.chip)}>
                                {categoryMeta.label}
                              </span>
                            </div>
                            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-heading">
                              {selectedTrophy.definition.name}
                            </h2>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-text/72">
                              {selectedTrophy.definition.description}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white/85 px-4 py-4 text-sm text-text/72">
                          <p className="font-semibold text-heading">
                            {selectedTrophy.earned ? "Earned" : "Locked"}
                          </p>
                          <p className="mt-2">
                            {selectedTrophy.earned
                              ? formatDate(selectedTrophy.earnedAt) ?? "Achievement recorded"
                              : "What you need to do"}
                          </p>
                          <p className="mt-3 font-medium text-heading">
                            +{formatDisplayNumber(selectedTrophy.definition.xpBonus, 0)} XP bonus
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                      <Card className="border-slate-200 bg-slate-50/80">
                        <h3 className="text-lg font-semibold text-heading">Achievement Detail</h3>
                        <div className="mt-4 space-y-4 text-sm leading-6 text-text/72">
                          <div>
                            <p className="font-semibold text-heading">Condition</p>
                            <p className="mt-1">{selectedTrophy.definition.condition}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-heading">Reward</p>
                            <p className="mt-1">
                              Unlocking this trophy awards +{formatDisplayNumber(selectedTrophy.definition.xpBonus, 0)} XP.
                            </p>
                          </div>
                          {selectedTrophy.earned ? (
                            <div>
                              <p className="font-semibold text-heading">Status</p>
                              <p className="mt-1">
                                Earned {formatDate(selectedTrophy.earnedAt) ?? "recently"}.
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold text-heading">Status</p>
                              <p className="mt-1">{getMotivationalMessage(selectedTrophy)}</p>
                            </div>
                          )}
                        </div>
                      </Card>

                      <Card className="border-slate-200 bg-slate-50/80">
                        <h3 className="text-lg font-semibold text-heading">
                          {selectedTrophy.earned ? "Achievement Context" : "Progress"}
                        </h3>
                        {selectedTrophy.earned && metadataEntries.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {metadataEntries.map(([key, value]) => (
                              <div
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                                key={key}
                              >
                                <p className="text-xs uppercase tracking-[0.18em] text-text/52">
                                  {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                                </p>
                                <p className="mt-2 text-sm font-medium text-heading">
                                  {typeof value === "string" || typeof value === "number"
                                    ? String(value)
                                    : JSON.stringify(value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : progressHint ? (
                          <div className="mt-4 space-y-4">
                            <div
                              className="h-4 overflow-hidden rounded-full bg-white"
                              role="progressbar"
                              aria-label={`${selectedTrophy.definition.name} progress`}
                            >
                              <div
                                className={cn("h-full rounded-full transition-all duration-700", tierMeta.progress)}
                                style={{ width: `${progressHint.percentage}%` }}
                              />
                            </div>
                            <p className="text-sm text-text/72">{progressHint.label}</p>
                            <p className="text-sm font-medium text-heading">
                              {formatDisplayNumber(progressHint.percentage, 1)}% complete
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-sm leading-6 text-text/72">
                            {selectedTrophy.earned
                              ? "Additional metadata was not recorded for this trophy."
                              : "Progress details will appear here as more achievement data is recorded."}
                          </div>
                        )}
                      </Card>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
