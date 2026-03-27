"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Crown,
  RefreshCw,
  Search,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import {
  formatXPDisplay,
  getCurrentLevel,
  getLevelBadge,
} from "@/lib/level-utils";
import {
  isDemoModeEnabled,
  readStoredUser,
  type DemoUser,
} from "@/lib/rbac";

type ScopeKey = "campus" | "faculty" | "degree" | "intake";
type SortKey = "rank" | "xp";
type SortDirection = "asc" | "desc";

interface StudentLookupRecord {
  id: string;
  studentId: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface StudentScopeProfile {
  facultyId: string;
  facultyName: string;
  degreeProgramId: string;
  degreeProgramName: string;
  intakeId: string;
  intakeName: string;
}

interface LeaderboardLevel {
  number: number;
  name: string;
  title?: string;
  icon: string;
  color: string;
}

interface LeaderboardEntry {
  rank: number;
  student: {
    id: string;
    name: string;
    registrationNumber: string;
    faculty?: string;
    degreeProgram?: string;
    intake?: string;
  };
  totalXP: number;
  level: LeaderboardLevel;
  topTrophy: {
    key?: string;
    name: string;
    icon: string;
    tier: string;
  } | null;
  xpChange: {
    last7Days: number;
    last30Days: number;
  };
}

interface LeaderboardResponseData {
  scope: ScopeKey | string;
  scopeName: string | null;
  totalStudents: number;
  lastUpdated: string;
  personalRank: {
    rank: number | null;
    totalXP: number | null;
    totalStudents: number;
    percentile: number | null;
    message: string | null;
  } | null;
  leaderboard: LeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalEntries: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface AroundResponseData {
  student: {
    id: string;
    name: string;
    registrationNumber: string;
    rank: number;
    totalXP: number;
    level: LeaderboardLevel;
  };
  above: LeaderboardEntry[];
  below: LeaderboardEntry[];
}

interface StatsResponseData {
  student: {
    id: string;
    name: string;
    registrationNumber: string;
  };
  rank: number;
  totalXP: number;
  totalStudents: number;
  percentile: number;
  xpToNextRank: number;
  xpFromPreviousRank: number;
  studentsAbove: number;
  studentsBelow: number;
  topStudent: {
    name: string;
    totalXP: number;
    rank: number;
  } | null;
  message: string;
}

interface TopResponseData {
  scope: ScopeKey | string;
  topStudents: Array<{
    rank: number;
    student: {
      id: string;
      name: string;
      registrationNumber: string;
    };
    totalXP: number;
    level: {
      number: number;
      name: string;
      icon: string;
      color: string;
    };
    topTrophy: {
      name: string;
      icon: string;
      tier: string;
    } | null;
  }>;
  totalStudents: number;
  lastUpdated: string;
}

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

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
  return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
}

function buildStudentName(student: StudentLookupRecord) {
  return `${collapseSpaces(student.firstName)} ${collapseSpaces(student.lastName)}`.trim();
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

      return { id, studentId, email, firstName, lastName };
    })
    .filter((item): item is StudentLookupRecord => Boolean(item));
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
    if (emailMatch) return emailMatch;
  }

  if (sessionUsername) {
    const usernameMatch = items.find(
      (item) => normalizeText(item.studentId) === sessionUsername
    );
    if (usernameMatch) return usernameMatch;
  }

  if (sessionId) {
    const idMatch = items.find(
      (item) =>
        normalizeText(item.id) === sessionId ||
        normalizeText(item.studentId) === sessionId
    );
    if (idMatch) return idMatch;
  }

  if (sessionName) {
    const nameMatch = items.find(
      (item) => normalizeText(buildStudentName(item)) === sessionName
    );
    if (nameMatch) return nameMatch;
  }

  return items.length === 1 ? items[0] : null;
}

async function resolveStudentRecord(user: DemoUser) {
  const candidates = [user.email, user.username, user.id, user.name]
    .map((value) => collapseSpaces(value))
    .filter(Boolean);
  const seen = new Set<string>();

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
    const payload = await readJson<unknown>(response);
    if (!response.ok) {
      continue;
    }

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
    const payload = await readJson<unknown>(response);
    if (response.ok) {
      return parseStudentItems(payload)[0] ?? null;
    }
  }

  return null;
}

function parseScopeProfile(payload: unknown): StudentScopeProfile | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const row = items[0] as Record<string, unknown>;
  const facultyId = collapseSpaces(row.facultyId ?? row.facultyCode).toUpperCase();
  const facultyName = collapseSpaces(row.facultyName) || facultyId;
  const degreeProgramId = collapseSpaces(
    row.degreeProgramId ?? row.degreeCode
  ).toUpperCase();
  const degreeProgramName =
    collapseSpaces(row.degreeProgramName ?? row.degreeName) || degreeProgramId;
  const intakeId = collapseSpaces(row.intakeId);
  const intakeName = collapseSpaces(row.intakeName) || intakeId;

  if (!facultyId && !degreeProgramId && !intakeId) {
    return null;
  }

  return {
    facultyId,
    facultyName,
    degreeProgramId,
    degreeProgramName,
    intakeId,
    intakeName,
  };
}

function appendScopeParams(
  params: URLSearchParams,
  scope: ScopeKey,
  profile: StudentScopeProfile | null
) {
  params.set("scope", scope);
  if (scope === "faculty" && profile?.facultyId) {
    params.set("facultyId", profile.facultyId);
  }
  if (scope === "degree" && profile?.degreeProgramId) {
    params.set("degreeProgramId", profile.degreeProgramId);
  }
  if (scope === "intake" && profile?.intakeId) {
    params.set("intakeId", profile.intakeId);
  }
}

function buildLeaderboardUrl(
  studentId: string,
  scope: ScopeKey,
  profile: StudentScopeProfile | null,
  page: number,
  limit: number
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    studentId,
  });
  appendScopeParams(params, scope, profile);
  return `/api/gamification/leaderboard?${params.toString()}`;
}

function buildAroundUrl(
  studentId: string,
  scope: ScopeKey,
  profile: StudentScopeProfile | null
) {
  const params = new URLSearchParams({ range: "5" });
  appendScopeParams(params, scope, profile);
  return `/api/gamification/leaderboard/around/${encodeURIComponent(studentId)}?${params.toString()}`;
}

function buildStatsUrl(
  studentId: string,
  scope: ScopeKey,
  profile: StudentScopeProfile | null
) {
  const params = new URLSearchParams({ studentId });
  appendScopeParams(params, scope, profile);
  return `/api/gamification/leaderboard/stats?${params.toString()}`;
}

function buildTopUrl(scope: ScopeKey, profile: StudentScopeProfile | null, limit = 3) {
  const params = new URLSearchParams({
    scope,
    limit: String(limit),
  });

  if (scope === "faculty" && profile?.facultyId) params.set("scopeId", profile.facultyId);
  if (scope === "degree" && profile?.degreeProgramId) params.set("scopeId", profile.degreeProgramId);
  if (scope === "intake" && profile?.intakeId) params.set("scopeId", profile.intakeId);

  return `/api/gamification/leaderboard/top?${params.toString()}`;
}

async function fetchApiData<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await readJson<{ success?: boolean; data?: T; error?: string }>(response);

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(collapseSpaces(payload?.error) || "Failed to fetch leaderboard data");
  }

  return payload.data;
}

function getMedal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function getInitials(name: string) {
  const parts = collapseSpaces(name).split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Card>
        <Skeleton className="h-56 w-full rounded-[28px]" />
      </Card>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-36 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-10 w-24" />
            <Skeleton className="mt-3 h-4 w-40" />
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton className="h-64 w-full rounded-[28px]" />
      </Card>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <Card>
          <Skeleton className="h-[520px] w-full rounded-[28px]" />
        </Card>
        <Card>
          <Skeleton className="h-[420px] w-full rounded-[28px]" />
        </Card>
      </div>
    </div>
  );
}

export default function StudentLeaderboardPage() {
  const { toast } = useToast();
  const [studentRecord, setStudentRecord] = useState<StudentLookupRecord | null>(null);
  const [scopeProfile, setScopeProfile] = useState<StudentScopeProfile | null>(null);
  const [activeScope, setActiveScope] = useState<ScopeKey>("campus");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponseData | null>(null);
  const [aroundData, setAroundData] = useState<AroundResponseData | null>(null);
  const [statsData, setStatsData] = useState<StatsResponseData | null>(null);
  const [topData, setTopData] = useState<TopResponseData | null>(null);
  const [scopeCounts, setScopeCounts] = useState<Partial<Record<ScopeKey, number | null>>>({
    campus: null,
    faculty: null,
    degree: null,
    intake: null,
  });
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [search, setSearch] = useState("");

  const personalRank = leaderboardData?.personalRank ?? null;
  const heroRank = statsData?.rank ?? personalRank?.rank ?? null;
  const heroTotalStudents =
    statsData?.totalStudents ?? personalRank?.totalStudents ?? leaderboardData?.totalStudents ?? 0;
  const heroTotalXP = statsData?.totalXP ?? personalRank?.totalXP ?? 0;
  const currentLevel = useMemo(() => getCurrentLevel(heroTotalXP), [heroTotalXP]);
  const currentBadge = useMemo(() => getLevelBadge(heroTotalXP), [heroTotalXP]);

  const topPercentage = useMemo(() => {
    if (!heroRank || heroTotalStudents <= 0) {
      return null;
    }
    return roundNumber((heroRank / heroTotalStudents) * 100, 1);
  }, [heroRank, heroTotalStudents]);

  const sortedRows = useMemo(() => {
    const rows = [...(leaderboardData?.leaderboard ?? [])];
    rows.sort((left, right) => {
      const primary =
        sortKey === "xp" ? left.totalXP - right.totalXP : left.rank - right.rank;
      if (primary !== 0) {
        return sortDirection === "asc" ? primary : -primary;
      }

      return left.student.name.localeCompare(right.student.name);
    });
    return rows;
  }, [leaderboardData, sortDirection, sortKey]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);
    if (!query) {
      return sortedRows;
    }

    return sortedRows.filter((entry) =>
      `${entry.student.name} ${entry.student.registrationNumber}`
        .toLowerCase()
        .includes(query)
    );
  }, [search, sortedRows]);

  const topThree = useMemo(
    () => (topData?.topStudents ?? []).filter((item) => item.totalXP > 0).slice(0, 3),
    [topData]
  );

  const currentStudentInfo = useMemo(() => {
    if (statsData?.student) {
      return statsData.student;
    }
    if (!studentRecord) {
      return null;
    }

    return {
      id: studentRecord.id,
      name: buildStudentName(studentRecord),
      registrationNumber: studentRecord.studentId,
    };
  }, [statsData, studentRecord]);

  const summaryStats = useMemo(() => {
    const rows = leaderboardData?.leaderboard ?? [];
    const totalXP = rows.reduce((sum, row) => sum + row.totalXP, 0);
    return {
      totalParticipants: topData?.totalStudents ?? leaderboardData?.totalStudents ?? 0,
      averageXP: rows.length > 0 ? totalXP / rows.length : 0,
      highestXP: topData?.topStudents?.[0]?.totalXP ?? rows[0]?.totalXP ?? 0,
      percentileLabel:
        topPercentage !== null ? `Top ${formatDisplayNumber(topPercentage, 1)}%` : "Top —",
    };
  }, [leaderboardData, topData, topPercentage]);

  const isEmptyCompetition = useMemo(() => {
    const rows = leaderboardData?.leaderboard ?? [];
    return rows.length > 0 && rows.every((row) => row.totalXP <= 0) && heroTotalXP <= 0;
  }, [heroTotalXP, leaderboardData]);

  const scopeTabs = useMemo(
    () =>
      (["campus", "faculty", "degree", "intake"] as ScopeKey[]).map((scope) => ({
        scope,
        label:
          scope === "campus"
            ? "Campus"
            : scope === "faculty"
              ? "Faculty"
              : scope === "degree"
                ? "Degree"
                : "Intake",
        icon:
          scope === "campus"
            ? "🏫"
            : scope === "faculty"
              ? "🏛️"
              : scope === "degree"
                ? "📚"
                : "👥",
        enabled:
          scope === "campus"
            ? true
            : scope === "faculty"
              ? Boolean(scopeProfile?.facultyId)
              : scope === "degree"
                ? Boolean(scopeProfile?.degreeProgramId)
                : Boolean(scopeProfile?.intakeId),
        count:
          scope === activeScope
            ? leaderboardData?.totalStudents ?? scopeCounts[scope] ?? null
            : scopeCounts[scope] ?? null,
      })),
    [activeScope, leaderboardData, scopeCounts, scopeProfile]
  );

  useEffect(() => {
    void initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initializePage() {
    setLoading(true);
    setError("");
    setWarning("");

    try {
      const effectiveUser =
        readStoredUser() ??
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

      const resolvedStudent = await resolveStudentRecord(effectiveUser);
      if (!resolvedStudent) {
        throw new Error(
          isDemoModeEnabled()
            ? "No student records are available yet."
            : "Unable to resolve your student profile."
        );
      }

      setStudentRecord(resolvedStudent);

      const enrollmentResponse = await fetch(
        `/api/students/${encodeURIComponent(resolvedStudent.id)}/enrollments`,
        { cache: "no-store" }
      );
      const enrollmentPayload = await readJson<unknown>(enrollmentResponse);
      const profile = parseScopeProfile(enrollmentPayload);
      setScopeProfile(profile);

      await Promise.allSettled([
        loadScopeBundle({
          studentId: resolvedStudent.id,
          scope: "campus",
          profile,
          page: 1,
          limit: 50,
          surfaceErrors: false,
        }),
        loadScopeCounts(profile),
      ]);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load leaderboard";
      setError(message);
      toast({
        title: "Failed",
        message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadScopeCounts(profile: StudentScopeProfile | null) {
    const scopes = (["campus", "faculty", "degree", "intake"] as ScopeKey[]).filter(
      (scope) =>
        scope === "campus" ||
        (scope === "faculty" && profile?.facultyId) ||
        (scope === "degree" && profile?.degreeProgramId) ||
        (scope === "intake" && profile?.intakeId)
    );

    const settled = await Promise.allSettled(
      scopes.map(async (scope) => {
        const data = await fetchApiData<TopResponseData>(buildTopUrl(scope, profile, 1));
        return [scope, data.totalStudents] as const;
      })
    );

    const nextCounts: Partial<Record<ScopeKey, number | null>> = {};
    settled.forEach((result) => {
      if (result.status === "fulfilled") {
        nextCounts[result.value[0]] = result.value[1];
      }
    });

    if (Object.keys(nextCounts).length > 0) {
      setScopeCounts((current) => ({ ...current, ...nextCounts }));
    }
  }

  async function loadScopeBundle(options: {
    studentId: string;
    scope: ScopeKey;
    profile: StudentScopeProfile | null;
    page: number;
    limit: number;
    surfaceErrors: boolean;
  }) {
    const { studentId, scope, profile, page: nextPage, limit, surfaceErrors } = options;
    const settled = await Promise.allSettled([
      fetchApiData<LeaderboardResponseData>(
        buildLeaderboardUrl(studentId, scope, profile, nextPage, limit)
      ),
      fetchApiData<AroundResponseData>(buildAroundUrl(studentId, scope, profile)),
      fetchApiData<StatsResponseData>(buildStatsUrl(studentId, scope, profile)),
      fetchApiData<TopResponseData>(buildTopUrl(scope, profile, 3)),
    ]);

    const failures = settled
      .filter((item): item is PromiseRejectedResult => item.status === "rejected")
      .map((item) =>
        item.reason instanceof Error ? item.reason.message : "Request failed"
      );

    const main = settled[0].status === "fulfilled" ? settled[0].value : null;
    const around = settled[1].status === "fulfilled" ? settled[1].value : null;
    const stats = settled[2].status === "fulfilled" ? settled[2].value : null;
    const top = settled[3].status === "fulfilled" ? settled[3].value : null;

    if (!main && !around && !stats && !top) {
      throw new Error(failures[0] ?? "Failed to load leaderboard data");
    }

    if (main) {
      setLeaderboardData(main);
      setScopeCounts((current) => ({ ...current, [scope]: main.totalStudents }));
    }
    if (around) setAroundData(around);
    if (stats) setStatsData(stats);
    if (top) {
      setTopData(top);
      setScopeCounts((current) => ({ ...current, [scope]: top.totalStudents }));
    }

    if (failures.length > 0) {
      setWarning(failures[0]);
      if (surfaceErrors) {
        toast({
          title: "Partial data loaded",
          message: failures[0],
          variant: "error",
        });
      }
    } else {
      setWarning("");
    }
  }

  async function loadLeaderboardPage(nextPage: number, nextLimit: number) {
    if (!studentRecord) return;

    setTableLoading(true);
    try {
      const nextData = await fetchApiData<LeaderboardResponseData>(
        buildLeaderboardUrl(studentRecord.id, activeScope, scopeProfile, nextPage, nextLimit)
      );
      setLeaderboardData(nextData);
      setScopeCounts((current) => ({ ...current, [activeScope]: nextData.totalStudents }));
      setWarning("");
    } catch (loadError) {
      toast({
        title: "Failed",
        message:
          loadError instanceof Error
            ? loadError.message
            : "Failed to load leaderboard page",
        variant: "error",
      });
    } finally {
      setTableLoading(false);
    }
  }

  async function handleScopeChange(scope: ScopeKey) {
    const tab = scopeTabs.find((item) => item.scope === scope);
    if (!tab?.enabled || !studentRecord) return;

    setActiveScope(scope);
    setPage(1);
    setTableLoading(true);
    try {
      await loadScopeBundle({
        studentId: studentRecord.id,
        scope,
        profile: scopeProfile,
        page: 1,
        limit: pageSize,
        surfaceErrors: true,
      });
    } catch (loadError) {
      toast({
        title: "Failed",
        message:
          loadError instanceof Error
            ? loadError.message
            : "Failed to switch leaderboard scope",
        variant: "error",
      });
    } finally {
      setTableLoading(false);
    }
  }

  async function handleRefresh() {
    if (!studentRecord) return;

    setRefreshing(true);
    try {
      await Promise.allSettled([
        loadScopeBundle({
          studentId: studentRecord.id,
          scope: activeScope,
          profile: scopeProfile,
          page,
          limit: pageSize,
          surfaceErrors: true,
        }),
        loadScopeCounts(scopeProfile),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "rank" ? "asc" : "desc");
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error && !leaderboardData && !statsData && !aroundData && !topData) {
    return (
      <Card className="border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.98))]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-700">
              Student Portal / Leaderboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-heading">
              Unable to load leaderboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text/72">{error}</p>
          </div>
          <Button className="gap-2" onClick={() => void initializePage()}>
            <RefreshCw size={16} />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8 pb-4">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text/55">
          Student Portal / Leaderboard
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-heading">
              XP Leaderboard
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text/72">
              See where you stand, compare yourself against nearby peers, and
              track your rise across campus, faculty, degree, and intake
              leaderboards.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {leaderboardData?.lastUpdated ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Last updated {formatRelativeTime(leaderboardData.lastUpdated)}
              </span>
            ) : null}
            <Button
              className="gap-2"
              disabled={refreshing}
              onClick={() => void handleRefresh()}
              variant="secondary"
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} size={16} />
              Refresh
            </Button>
          </div>
        </div>
        {warning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {warning}
          </div>
        ) : null}
      </section>

      <section>
        <Card
          className={cn(
            "overflow-hidden",
            heroTotalXP > 0 && heroRank === 1
              ? "border-amber-200 bg-[linear-gradient(135deg,rgba(254,243,199,0.98),rgba(255,255,255,0.98))]"
              : heroTotalXP > 0 && heroRank !== null && heroRank / Math.max(heroTotalStudents, 1) <= 0.25
                ? "border-emerald-200 bg-[linear-gradient(135deg,rgba(220,252,231,0.98),rgba(255,255,255,0.98))]"
                : heroTotalXP > 0 && heroRank !== null && heroRank / Math.max(heroTotalStudents, 1) <= 0.5
                  ? "border-sky-200 bg-[linear-gradient(135deg,rgba(224,242,254,0.98),rgba(255,255,255,0.98))]"
                  : "border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))]"
          )}
        >
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_55%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_50%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full bg-white/85 px-3 py-1 text-sm font-semibold text-heading">
                  {heroRank === 1
                    ? "🏆 Campus Champion"
                    : heroRank && heroRank <= 3
                      ? `${getMedal(heroRank)} Podium Position`
                      : heroTotalXP > 0
                        ? "Competitive Snapshot"
                        : "Ready to Compete"}
                </span>
                {topPercentage !== null ? (
                  <span className="rounded-full bg-white/85 px-3 py-1 text-sm font-semibold text-heading">
                    Top {formatDisplayNumber(topPercentage, 1)}%
                  </span>
                ) : null}
              </div>

              <div>
                <p className="text-sm font-medium text-text/68">
                  {currentStudentInfo?.name ?? "Student"}
                  {currentStudentInfo?.registrationNumber
                    ? ` • ${currentStudentInfo.registrationNumber}`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <h2 className="text-6xl font-semibold tracking-tight text-heading">
                    {heroTotalXP > 0 && heroRank ? `#${heroRank}` : "—"}
                  </h2>
                  {heroRank === 1 ? (
                    <span className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-amber-600 shadow-[0_16px_40px_rgba(245,158,11,0.18)]">
                      <Crown size={28} />
                    </span>
                  ) : heroRank && heroRank <= 3 ? (
                    <span className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-4xl shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
                      {getMedal(heroRank)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-base text-text/72">
                  {heroTotalXP > 0 && heroRank
                    ? `out of ${heroTotalStudents} students`
                    : "Start earning XP to join the leaderboard!"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold",
                    currentBadge.borderColor,
                    currentBadge.bgColor,
                    currentBadge.textColor
                  )}
                >
                  <span role="img" aria-label={`${currentLevel.name} icon`}>
                    {currentLevel.icon}
                  </span>
                  {currentLevel.name}
                </span>
                <span className="rounded-full bg-white/90 px-3 py-2 text-sm font-semibold text-heading">
                  {formatXPDisplay(heroTotalXP)}
                </span>
              </div>
            </div>

            <div className="grid gap-3 lg:w-[420px] sm:grid-cols-2">
              <div className="rounded-2xl border border-white/70 bg-white/88 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text/52">
                  XP To Next Rank
                </p>
                <p className="mt-3 text-2xl font-semibold text-heading">
                  {heroRank === 1 ? "0" : formatDisplayNumber(statsData?.xpToNextRank ?? 0, 0)}
                </p>
                <p className="mt-1 text-sm text-text/65">
                  {heroRank === 1 ? "You're holding the #1 spot" : "Push a little more to move up"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/88 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text/52">XP Buffer</p>
                <p className="mt-3 text-2xl font-semibold text-heading">
                  {formatDisplayNumber(statsData?.xpFromPreviousRank ?? 0, 0)}
                </p>
                <p className="mt-1 text-sm text-text/65">Your cushion over the student below</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/88 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text/52">
                  Students Above
                </p>
                <p className="mt-3 text-2xl font-semibold text-heading">
                  {formatDisplayNumber(statsData?.studentsAbove ?? 0, 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/88 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text/52">
                  Students Below
                </p>
                <p className="mt-3 text-2xl font-semibold text-heading">
                  {formatDisplayNumber(statsData?.studentsBelow ?? 0, 0)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <Card className="border-slate-200 bg-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-heading">Leaderboard Scope</h2>
              <p className="mt-1 text-sm text-text/72">
                Switch between the campus board and your closest academic cohorts.
              </p>
            </div>
            <div className="text-sm text-text/65">
              {scopeProfile ? (
                <span>
                  {scopeProfile.facultyName} • {scopeProfile.degreeProgramName} •{" "}
                  {scopeProfile.intakeName}
                </span>
              ) : (
                <span>Scope information loads from your student enrollments.</span>
              )}
            </div>
          </div>

          <div aria-label="Leaderboard scope filters" className="mt-5 flex gap-3 overflow-x-auto pb-1" role="tablist">
            {scopeTabs.map((tab) => (
              <button
                aria-selected={activeScope === tab.scope}
                className={cn(
                  "inline-flex min-w-[160px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  activeScope === tab.scope
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-slate-50 text-text/72 hover:bg-white",
                  !tab.enabled && "cursor-not-allowed opacity-55"
                )}
                disabled={!tab.enabled || tableLoading}
                key={tab.scope}
                onClick={() => void handleScopeChange(tab.scope)}
                role="tab"
                type="button"
              >
                <span>
                  <span className="block text-xs uppercase tracking-[0.18em] text-text/52">
                    {tab.icon}
                  </span>
                  <span className="mt-1 block text-sm font-semibold">{tab.label}</span>
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-heading">
                  {tab.count === null ? "—" : tab.count}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </section>

      {leaderboardData ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-200 bg-white">
            <p className="text-sm font-medium text-text/68">Total Participants</p>
            <p className="mt-4 text-3xl font-semibold text-heading">
              {formatDisplayNumber(summaryStats.totalParticipants, 0)}
            </p>
          </Card>
          <Card className="border-slate-200 bg-white">
            <p className="text-sm font-medium text-text/68">Average XP</p>
            <p className="mt-4 text-3xl font-semibold text-heading">
              {formatXPDisplay(summaryStats.averageXP)}
            </p>
            <p className="mt-2 text-sm text-text/65">Based on loaded leaderboard rows</p>
          </Card>
          <Card className="border-slate-200 bg-white">
            <p className="text-sm font-medium text-text/68">Highest XP</p>
            <p className="mt-4 text-3xl font-semibold text-heading">
              {formatXPDisplay(summaryStats.highestXP)}
            </p>
          </Card>
          <Card className="border-slate-200 bg-white">
            <p className="text-sm font-medium text-text/68">Your Percentile</p>
            <p className="mt-4 text-3xl font-semibold text-heading">
              {summaryStats.percentileLabel}
            </p>
          </Card>
        </section>
      ) : null}

      {!isEmptyCompetition && topThree.length > 0 ? (
        <section>
          <Card className="border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Trophy size={20} />
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-heading">Top 3 Podium</h2>
                <p className="mt-2 text-sm leading-6 text-text/72">
                  The front-runners in the {leaderboardData?.scopeName?.toLowerCase() ?? "campus"} ranking.
                </p>
              </div>
            </div>

            <div className="mt-8 hidden grid-cols-3 items-end gap-4 md:grid">
              {[topThree[1], topThree[0], topThree[2]]
                .filter(Boolean)
                .map((item) => {
                  if (!item) return null;
                  const border =
                    item.rank === 1
                      ? "border-amber-300 bg-[linear-gradient(180deg,rgba(254,243,199,0.98),rgba(255,255,255,0.98))] md:pt-12"
                      : item.rank === 2
                        ? "border-slate-300 bg-[linear-gradient(180deg,rgba(241,245,249,0.98),rgba(255,255,255,0.98))] md:pt-8"
                        : "border-orange-300 bg-[linear-gradient(180deg,rgba(255,237,213,0.98),rgba(255,255,255,0.98))] md:pt-5";
                  return (
                    <div className={border} key={item.student.id}>
                      <div className="rounded-[28px] border px-5 py-6 text-center shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
                        <div className="text-4xl" role="img" aria-label={`Rank ${item.rank}`}>
                          {getMedal(item.rank)}
                        </div>
                        <div className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-white text-xl font-semibold text-heading shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                          {getInitials(item.student.name)}
                        </div>
                        <p className="mt-4 text-lg font-semibold text-heading">{item.student.name}</p>
                        <p className="mt-1 text-sm text-text/65">{item.student.registrationNumber}</p>
                        <p className="mt-4 text-3xl font-semibold text-heading">{formatXPDisplay(item.totalXP)}</p>
                        <span className="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-heading">
                          {item.level.icon} {item.level.name}
                        </span>
                        {item.topTrophy ? (
                          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-text/72">
                            <span role="img" aria-label={`${item.topTrophy.name} trophy`}>
                              {item.topTrophy.icon}
                            </span>
                            {item.topTrophy.name}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-6 space-y-4 md:hidden">
              {topThree.map((item) => (
                <div
                  className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
                  key={item.student.id}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl" role="img" aria-label={`Rank ${item.rank}`}>
                      {getMedal(item.rank)}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-heading">{item.student.name}</p>
                      <p className="mt-1 text-sm text-text/65">{item.student.registrationNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-heading">{formatXPDisplay(item.totalXP)}</p>
                      <p className="mt-1 text-sm text-text/65">
                        {item.level.icon} {item.level.name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      {isEmptyCompetition ? (
        <section>
          <Card className="overflow-hidden border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]">
            <div className="relative flex flex-col items-center px-4 py-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-amber-700 shadow-[0_18px_34px_rgba(245,158,11,0.14)]">
                <Trophy size={36} />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-heading">
                The leaderboard is waiting for its first champion!
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text/72">
                Start earning XP to claim your spot and turn every academic win into
                visible momentum.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                  href="/student/gamification"
                >
                  How to Earn XP
                  <ArrowRight size={16} />
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-heading transition-colors hover:bg-slate-50"
                  href="/student/trophies"
                >
                  View Trophies
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <div className="order-2 xl:order-1">
          <Card className="border-slate-200 bg-white">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-heading">Full Leaderboard</h2>
                <p className="mt-2 text-sm leading-6 text-text/72">
                  Search, sort, and page through the current leaderboard results.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative block min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-heading outline-none transition-colors focus:border-amber-300 focus:bg-white"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by student name or ID"
                    value={search}
                  />
                </label>
                <select
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-heading outline-none transition-colors focus:border-amber-300 focus:bg-white"
                  onChange={(event) => {
                    const nextSize = Number(event.target.value) || 50;
                    setPageSize(nextSize);
                    setPage(1);
                    void loadLeaderboardPage(1, nextSize);
                  }}
                  value={pageSize}
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-text/65">
              <span>
                Showing{" "}
                {leaderboardData
                  ? `${(leaderboardData.pagination.page - 1) * leaderboardData.pagination.limit + 1}-${Math.min(
                      leaderboardData.pagination.page * leaderboardData.pagination.limit,
                      leaderboardData.pagination.totalEntries
                    )}`
                  : "0-0"}{" "}
                of {leaderboardData?.pagination.totalEntries ?? 0} students
              </span>
              {search && filteredRows.length === 0 ? (
                <span>Student not on this page. Try another page or clear search.</span>
              ) : null}
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-text/52">
                    <th className="border-b border-slate-200 px-4 py-3" scope="col">
                      <button className="inline-flex items-center gap-2" onClick={() => toggleSort("rank")} type="button">
                        Rank
                        {sortKey === "rank" ? (sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : null}
                      </button>
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3" scope="col">Student</th>
                    <th className="border-b border-slate-200 px-4 py-3" scope="col">Level</th>
                    <th className="border-b border-slate-200 px-4 py-3" scope="col">
                      <button className="inline-flex items-center gap-2" onClick={() => toggleSort("xp")} type="button">
                        XP
                        {sortKey === "xp" ? (sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : null}
                      </button>
                    </th>
                    <th className="hidden border-b border-slate-200 px-4 py-3 md:table-cell" scope="col">Top Trophy</th>
                    <th className="hidden border-b border-slate-200 px-4 py-3 xl:table-cell" scope="col">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    Array.from({ length: 8 }).map((_, index) => (
                      <tr key={index}>
                        <td className="border-b border-slate-100 px-4 py-4" colSpan={6}>
                          <Skeleton className="h-14 w-full rounded-2xl" />
                        </td>
                      </tr>
                    ))
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td className="border-b border-slate-100 px-4 py-10 text-center text-sm text-text/65" colSpan={6}>
                        No students matched the current page search.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((entry) => {
                      const isCurrentStudent = entry.student.id === studentRecord?.id;
                      return (
                        <tr
                          aria-current={isCurrentStudent ? "true" : undefined}
                          className={cn(
                            "transition-colors hover:bg-slate-50/80",
                            isCurrentStudent && "border-l-4 border-l-amber-400 bg-[linear-gradient(90deg,rgba(255,251,235,0.92),rgba(255,255,255,0.98))]"
                          )}
                          key={`${entry.student.id}-${entry.rank}`}
                        >
                          <td className="border-b border-slate-100 px-4 py-4 align-top">
                            <div className="flex items-center gap-2">
                              {getMedal(entry.rank) ? (
                                <span className="text-xl" role="img" aria-label={`Rank ${entry.rank}`}>
                                  {getMedal(entry.rank)}
                                </span>
                              ) : (
                                <span className="min-w-[28px] text-sm font-semibold text-heading">#{entry.rank}</span>
                              )}
                              {isCurrentStudent ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                                  📍 You
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 align-top">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-heading">
                                {getInitials(entry.student.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-heading">{entry.student.name}</p>
                                <p className="mt-1 text-sm text-text/65">{entry.student.registrationNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 align-top">
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-heading">
                              <span role="img" aria-label={`${entry.level.name} icon`}>{entry.level.icon}</span>
                              {entry.level.name}
                            </span>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 align-top font-semibold text-heading">
                            {formatXPDisplay(entry.totalXP)}
                          </td>
                          <td className="hidden border-b border-slate-100 px-4 py-4 align-top md:table-cell">
                            {entry.topTrophy ? (
                              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-text/72">
                                <span role="img" aria-label={`${entry.topTrophy.name} trophy`}>{entry.topTrophy.icon}</span>
                                <span className="max-w-[180px] truncate">{entry.topTrophy.name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-text/45">—</span>
                            )}
                          </td>
                          <td className="hidden border-b border-slate-100 px-4 py-4 align-top xl:table-cell">
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium", entry.xpChange.last7Days > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>
                              {entry.xpChange.last7Days > 0 ? <ArrowUp size={14} /> : <ArrowRight size={14} />}
                              {entry.xpChange.last7Days > 0 ? `+${formatDisplayNumber(entry.xpChange.last7Days, 0)}` : "0"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-text/65">
                Page {leaderboardData?.pagination.page ?? 1} of {leaderboardData?.pagination.totalPages ?? 1}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="gap-2"
                  disabled={!leaderboardData?.pagination.hasPrev || tableLoading}
                  onClick={() => {
                    const nextPage = Math.max(1, page - 1);
                    setPage(nextPage);
                    void loadLeaderboardPage(nextPage, pageSize);
                  }}
                  variant="secondary"
                >
                  <ChevronLeft size={16} />
                  Previous
                </Button>
                <Button
                  className="gap-2"
                  disabled={!leaderboardData?.pagination.hasNext || tableLoading}
                  onClick={() => {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    void loadLeaderboardPage(nextPage, pageSize);
                  }}
                  variant="secondary"
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="order-1 xl:order-2">
          <Card className="border-slate-200 bg-white">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Users size={20} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-heading">Students Around You</h2>
                <p className="mt-1 text-sm text-text/72">
                  See the students directly above and below your current position.
                </p>
              </div>
            </div>

            {aroundData ? (
              <>
                <div className="mt-5 space-y-2">
                  {aroundData.above.map((entry) => (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" key={`above-${entry.student.id}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-heading">#{entry.rank} {entry.student.name}</p>
                          <p className="mt-1 text-sm text-text/65">
                            {entry.student.registrationNumber} • {entry.level.icon} {entry.level.name}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-heading">{formatXPDisplay(entry.totalXP)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="my-4 rounded-[24px] border-2 border-amber-300 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))] px-4 py-4 shadow-[0_14px_32px_rgba(245,158,11,0.12)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-heading">#{aroundData.student.rank} ★ YOU ★</p>
                      <p className="mt-1 text-sm text-text/65">
                        {aroundData.student.name} • {aroundData.student.registrationNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-heading">{formatXPDisplay(aroundData.student.totalXP)}</p>
                      <p className="mt-1 text-sm text-text/65">
                        {aroundData.student.level.icon} {aroundData.student.level.name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {aroundData.below.map((entry) => (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" key={`below-${entry.student.id}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-heading">#{entry.rank} {entry.student.name}</p>
                          <p className="mt-1 text-sm text-text/65">
                            {entry.student.registrationNumber} • {entry.level.icon} {entry.level.name}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-heading">{formatXPDisplay(entry.totalXP)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {aroundData.above.length > 0
                    ? `${formatDisplayNumber(Math.max(0, aroundData.above[aroundData.above.length - 1].totalXP - aroundData.student.totalXP), 0)} XP behind #${aroundData.above[aroundData.above.length - 1].rank}`
                    : "You're currently at the top of this leaderboard."}
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-text/65">
                Around-you comparisons will appear once the ranking data loads.
              </div>
            )}
          </Card>
        </div>
      </section>

      <section>
        <Card className="border-slate-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-heading">Keep Climbing</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text/72">
                {heroTotalXP <= 0 || !heroRank || heroTotalStudents <= 0
                  ? "🚀 Start your journey! Earn XP to appear on the leaderboard!"
                  : heroRank === 1
                    ? "🏆 You're the campus champion! Keep inspiring others!"
                    : heroRank <= 3
                      ? "🥇 You're on the podium! Can you claim the #1 spot?"
                      : heroRank <= 10
                        ? "🌟 Top 10! You're among the best. Keep pushing!"
                        : heroRank / heroTotalStudents <= 0.25
                          ? "🔥 Great performance! You're in the top quarter!"
                          : heroRank / heroTotalStudents <= 0.5
                            ? "💪 Above average! Keep climbing the ranks!"
                            : "📈 Every point counts! Complete modules and quizzes to climb!"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                href="/student/gamification"
              >
                How to Earn XP
                <ArrowRight size={16} />
              </Link>
              <Link
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-heading transition-colors hover:bg-slate-50"
                href="/student/trophies"
              >
                View Trophies
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {statsData?.message ? (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-text/72">
              <Target size={16} />
              {statsData.message}
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
