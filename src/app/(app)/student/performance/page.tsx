"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Minus,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { resolveCurrentStudentRecord } from "@/lib/student-session";

type TrendState = "improving" | "declining" | "stable" | "insufficient_data";
type StandingLevel = "good" | "satisfactory" | "warning" | "probation";
type RiskLevel = "none" | "low" | "medium" | "high" | "critical";
type ModuleStatus = "pass" | "fail" | "pro-rata" | "repeat";

interface AcademicStanding {
  standing: string;
  level: StandingLevel;
  color: string;
  message: string;
  recommendations: string[];
}

interface PerformanceStudent {
  id: string;
  name: string;
  registrationNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: string;
}

interface OverviewData {
  cumulativeGPA: number;
  classification: string;
  academicStanding: AcademicStanding;
  totalModulesTaken: number;
  totalModulesPassed: number;
  totalModulesFailed: number;
  totalProRata: number;
  totalRepeat: number;
  totalCreditsCompleted: number;
  totalCreditsRequired?: number;
  progressPercentage: number;
  trend: TrendState;
}

interface SemesterModule {
  gradeId: string;
  moduleCode: string;
  moduleName: string;
  caMarks: number;
  finalExamMarks: number;
  totalMarks: number;
  gradeLetter: string;
  gradePoint: number;
  status: ModuleStatus;
  gradedBy: string | null;
  gradedAt: string | null;
}

interface SemesterSummary {
  totalModules: number;
  passCount: number;
  failCount: number;
  proRataCount: number;
  repeatCount: number;
  averageMarks: number;
  highestMarks: {
    moduleName: string;
    marks: number;
  } | null;
  lowestMarks: {
    moduleName: string;
    marks: number;
  } | null;
}

interface SemesterBreakdownItem {
  academicYear: string;
  semester: number;
  semesterGPA: number;
  modules: SemesterModule[];
  summary: SemesterSummary;
}

interface AtRiskModule {
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

interface AtRiskModules {
  proRataModules: AtRiskModule[];
  repeatModules: AtRiskModule[];
  failedModules: AtRiskModule[];
  totalAtRisk: number;
  hasAnyRisk: boolean;
}

interface SemesterRiskHistoryItem {
  academicYear: string;
  semester: number;
  totalModules: number;
  passCount: number;
  failCount: number;
  proRataCount: number;
  repeatCount: number;
  riskPercentage: number;
  semesterStatus: "clear" | "at-risk" | "critical";
}

interface RiskReport {
  overallRiskLevel: RiskLevel;
  summary: string;
  semesterRiskHistory: SemesterRiskHistoryItem[];
}

interface SemesterWiseGPAItem {
  academicYear: string;
  semester: number;
  gpa: number;
  label: string;
}

interface PerformanceProfile {
  student: PerformanceStudent;
  overview: OverviewData;
  semesterBreakdown: SemesterBreakdownItem[];
  atRiskModules: AtRiskModules;
  riskReport: RiskReport;
  semesterWiseGPA: SemesterWiseGPAItem[];
}

interface PerformanceResponse {
  success?: boolean;
  data?: PerformanceProfile;
  error?: string;
}

interface ModuleEligibility {
  isProRata: boolean;
  isRepeat: boolean;
  isPass: boolean;
  explanation: string;
  caStatus: "passed" | "failed";
  finalStatus: "passed" | "failed";
  caDeficit: number;
  finalDeficit: number;
}

interface ModuleDetailItem {
  gradeId: string;
  moduleCode: string;
  moduleName: string;
  academicYear: string;
  semester: number;
  caMarks: number;
  finalExamMarks: number;
  totalMarks: number;
  gradeLetter: string;
  gradePoint: number;
  status: ModuleStatus;
  eligibility: ModuleEligibility;
  gradedBy: string | null;
  gradedAt: string | null;
}

interface ModuleDetailResponse {
  success?: boolean;
  data?: {
    student: {
      id: string;
      name: string;
      registrationNumber: string;
    };
    totalModules: number;
    modules: ModuleDetailItem[];
  };
  error?: string;
}

const STUDENT_PROFILE_EMPTY_TITLE = "Student profile not found";
const STUDENT_PROFILE_EMPTY_MESSAGE =
  "Please make sure you're logged in with a valid student account, or contact your administrator.";

const GRADE_ORDER = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "F",
] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function roundNumber(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatFixed(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits);
}

function formatDisplayNumber(value: number, digits = 2) {
  const rounded = roundNumber(value, digits);
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return rounded.toFixed(digits).replace(/\.?0+$/, "");
}

function formatPercentage(value: number, digits = 1) {
  return `${formatFixed(value, digits)}%`;
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseAcademicYearStart(value: string) {
  const match = collapseSpaces(value).match(/^(\d{4})/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function comparePeriodsDescending(
  left: { academicYear: string; semester: number },
  right: { academicYear: string; semester: number }
) {
  const leftYear = parseAcademicYearStart(left.academicYear);
  const rightYear = parseAcademicYearStart(right.academicYear);

  if (leftYear !== null && rightYear !== null && leftYear !== rightYear) {
    return rightYear - leftYear;
  }

  const yearCompare = right.academicYear.localeCompare(left.academicYear);
  if (yearCompare !== 0) {
    return yearCompare;
  }

  return right.semester - left.semester;
}

function buildSemesterKey(item: { academicYear: string; semester: number }) {
  return `${item.academicYear}::${item.semester}`;
}

function isEmptyPerformance(profile: PerformanceProfile | null) {
  if (!profile) {
    return false;
  }

  return (
    profile.overview.totalModulesTaken === 0 &&
    profile.semesterBreakdown.length === 0 &&
    profile.semesterWiseGPA.length === 0
  );
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function getClassificationMeta(classification: string) {
  if (classification.includes("First Class")) {
    return {
      accent: "from-amber-300 via-yellow-200 to-white",
      border: "border-amber-200",
      text: "text-amber-700",
      chip: "bg-amber-100 text-amber-800",
    };
  }
  if (classification.includes("Upper")) {
    return {
      accent: "from-sky-300 via-blue-200 to-white",
      border: "border-sky-200",
      text: "text-sky-700",
      chip: "bg-sky-100 text-sky-800",
    };
  }
  if (classification.includes("Lower")) {
    return {
      accent: "from-teal-300 via-cyan-200 to-white",
      border: "border-teal-200",
      text: "text-teal-700",
      chip: "bg-teal-100 text-teal-800",
    };
  }
  if (classification === "General Pass") {
    return {
      accent: "from-slate-300 via-slate-200 to-white",
      border: "border-slate-200",
      text: "text-slate-700",
      chip: "bg-slate-100 text-slate-800",
    };
  }
  return {
    accent: "from-rose-300 via-red-200 to-white",
    border: "border-rose-200",
    text: "text-rose-700",
    chip: "bg-rose-100 text-rose-800",
  };
}

function getStandingMeta(level: StandingLevel) {
  if (level === "good") {
    return {
      card: "border-emerald-200 bg-emerald-50/80",
      icon: "text-emerald-600",
      pill: "bg-emerald-100 text-emerald-800",
    };
  }
  if (level === "satisfactory") {
    return {
      card: "border-sky-200 bg-sky-50/80",
      icon: "text-sky-600",
      pill: "bg-sky-100 text-sky-800",
    };
  }
  if (level === "warning") {
    return {
      card: "border-amber-200 bg-amber-50/80",
      icon: "text-amber-600",
      pill: "bg-amber-100 text-amber-800",
    };
  }
  return {
    card: "border-rose-200 bg-rose-50/80",
    icon: "text-rose-600",
    pill: "bg-rose-100 text-rose-800",
  };
}

function getTrendMeta(trend: TrendState) {
  if (trend === "improving") {
    return {
      label: "Improving",
      className: "text-emerald-700",
      Icon: TrendingUp,
    };
  }
  if (trend === "declining") {
    return {
      label: "Declining",
      className: "text-rose-700",
      Icon: TrendingDown,
    };
  }
  if (trend === "stable") {
    return {
      label: "Stable",
      className: "text-slate-700",
      Icon: ArrowRight,
    };
  }

  return {
    label: "Insufficient Data",
    className: "text-slate-500",
    Icon: Minus,
  };
}

function getRiskLevelMeta(level: RiskLevel) {
  if (level === "none") {
    return {
      label: "No Risk",
      description: "No immediate intervention required",
      bar: "from-emerald-500 via-emerald-400 to-emerald-300",
      text: "text-emerald-700",
    };
  }
  if (level === "low") {
    return {
      label: "Low Risk",
      description: "Minor attention areas detected",
      bar: "from-emerald-500 via-emerald-400 to-amber-300",
      text: "text-amber-700",
    };
  }
  if (level === "medium") {
    return {
      label: "Medium Risk",
      description: "Performance needs monitoring",
      bar: "from-emerald-400 via-amber-400 to-amber-500",
      text: "text-amber-700",
    };
  }
  if (level === "high") {
    return {
      label: "High Risk",
      description: "At-risk modules require timely intervention",
      bar: "from-amber-400 via-orange-400 to-rose-500",
      text: "text-rose-700",
    };
  }
  return {
    label: "Critical",
    description: "Immediate academic support is recommended",
    bar: "from-rose-500 via-red-500 to-red-600",
    text: "text-rose-700",
  };
}

function getStatusClasses(status: ModuleStatus) {
  if (status === "pass") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "repeat") {
    return "border-yellow-200 bg-yellow-50 text-yellow-800";
  }
  if (status === "pro-rata") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function getStatusIcon(status: ModuleStatus) {
  if (status === "pass") {
    return CheckCircle2;
  }
  if (status === "repeat") {
    return RotateCcw;
  }
  if (status === "pro-rata") {
    return AlertTriangle;
  }
  return XCircle;
}

function getStatusLabel(status: ModuleStatus) {
  if (status === "pro-rata") {
    return "Pro-Rata";
  }
  if (status === "repeat") {
    return "Repeat";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function deriveCreditsRequired(completed: number, percentage: number) {
  if (!completed || !percentage) {
    return 0;
  }

  const derived = completed / (percentage / 100);
  if (!Number.isFinite(derived)) {
    return 0;
  }

  return roundNumber(derived, 0);
}

function LoadingSkeleton() {
  return (
    <div className="student-performance-page space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-10 w-24" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </Card>
        ))}
      </div>

      <Card>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-5 h-28 w-full rounded-3xl" />
      </Card>

      <Card>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="mt-5 h-72 w-full rounded-3xl" />
      </Card>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="mt-4 h-16 w-full rounded-2xl" />
          </Card>
        ))}
      </div>
    </div>
  );
}

function StudentProfileEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="student-performance-page">
      <Card className="border-sky-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.94),rgba(255,255,255,0.98))]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <GraduationCap size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
                Student Portal / Performance
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-heading">
                {STUDENT_PROFILE_EMPTY_TITLE}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text/72">
                {STUDENT_PROFILE_EMPTY_MESSAGE}
              </p>
            </div>
          </div>
          <Button className="h-11 min-w-[132px] gap-2 self-start" onClick={onRetry} variant="secondary">
            <RefreshCw size={16} />
            Retry
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function StudentPerformancePage() {
  const { toast } = useToast();
  const [performance, setPerformance] = useState<PerformanceProfile | null>(null);
  const [moduleDetails, setModuleDetails] = useState<ModuleDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [profileMissing, setProfileMissing] = useState(false);
  const [expandedSemester, setExpandedSemester] = useState<string | null>(null);

  const sortedSemesters = useMemo(
    () =>
      [...(performance?.semesterBreakdown ?? [])].sort((left, right) =>
        comparePeriodsDescending(left, right)
      ),
    [performance]
  );

  const moduleDetailMap = useMemo(
    () => new Map(moduleDetails.map((item) => [item.gradeId, item])),
    [moduleDetails]
  );

  const gradeDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    sortedSemesters.forEach((semester) => {
      semester.modules.forEach((module) => {
        counts.set(module.gradeLetter, (counts.get(module.gradeLetter) ?? 0) + 1);
      });
    });

    const max = Math.max(0, ...Array.from(counts.values()));
    return GRADE_ORDER.map((gradeLetter) => ({
      gradeLetter,
      count: counts.get(gradeLetter) ?? 0,
      width:
        max > 0 ? Math.max(10, Math.round(((counts.get(gradeLetter) ?? 0) / max) * 100)) : 0,
    })).filter((item) => item.count > 0);
  }, [sortedSemesters]);

  const totalCreditsRequired = useMemo(() => {
    if (!performance) {
      return 0;
    }

    if (performance.overview.totalCreditsRequired && performance.overview.totalCreditsRequired > 0) {
      return performance.overview.totalCreditsRequired;
    }

    return deriveCreditsRequired(
      performance.overview.totalCreditsCompleted,
      performance.overview.progressPercentage
    );
  }, [performance]);

  const trendMeta = useMemo(
    () => getTrendMeta(performance?.overview.trend ?? "insufficient_data"),
    [performance]
  );

  const trendDelta = useMemo(() => {
    const items = performance?.semesterWiseGPA ?? [];
    if (items.length < 2) {
      return null;
    }

    const latest = items[items.length - 1];
    const previous = items[items.length - 2];
    return roundNumber(latest.gpa - previous.gpa, 2);
  }, [performance]);

  useEffect(() => {
    if (sortedSemesters.length === 0) {
      setExpandedSemester(null);
      return;
    }

    setExpandedSemester((current) => {
      if (current && sortedSemesters.some((item) => buildSemesterKey(item) === current)) {
        return current;
      }

      return buildSemesterKey(sortedSemesters[0]);
    });
  }, [sortedSemesters]);

  useEffect(() => {
    void loadPerformance(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPerformance(initial = false) {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");
    setProfileMissing(false);

    try {
      const studentRecord = await resolveCurrentStudentRecord();
      if (!studentRecord) {
        setPerformance(null);
        setModuleDetails([]);
        setProfileMissing(true);
        return;
      }

      const [profileResponse, modulesResponse] = await Promise.all([
        fetch(`/api/performance/${encodeURIComponent(studentRecord.id)}`, {
          cache: "no-store",
        }),
        fetch(`/api/performance/${encodeURIComponent(studentRecord.id)}/modules`, {
          cache: "no-store",
        }),
      ]);

      const profilePayload = await readJson<PerformanceResponse>(profileResponse);
      if (!profileResponse.ok || !profilePayload?.success || !profilePayload.data) {
        throw new Error(profilePayload?.error || "Failed to load performance data");
      }

      setPerformance(profilePayload.data);

      const modulesPayload = await readJson<ModuleDetailResponse>(modulesResponse);
      if (modulesResponse.ok && modulesPayload?.success && modulesPayload.data) {
        setModuleDetails(modulesPayload.data.modules);
      } else {
        setModuleDetails([]);
      }

      if (!initial) {
        toast({
          title: "Refreshed",
          message: "Performance data has been updated.",
          variant: "success",
        });
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load performance data";
      setPerformance(null);
      setModuleDetails([]);
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

  const handlePrint = () => {
    window.print();
  };

  const scrollToRiskSection = () => {
    const target = window.document.getElementById("at-risk-section");
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <>
        <style jsx global>{`
          @media print {
            header {
              display: none !important;
            }

            main {
              padding-top: 0 !important;
            }
          }
        `}</style>
        <LoadingSkeleton />
      </>
    );
  }

  if (profileMissing) {
    return <StudentProfileEmptyState onRetry={() => void loadPerformance(false)} />;
  }

  if (error || !performance) {
    return (
      <>
        <style jsx global>{`
          @media print {
            header {
              display: none !important;
            }

            main {
              padding-top: 0 !important;
            }
          }
        `}</style>
        <div className="student-performance-page space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/55">
              Student Portal / Performance
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-heading">
              My Academic Performance
            </h1>
          </div>

          <Card className="border-rose-200 bg-rose-50/80">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-rose-800">
                    Failed to load performance data
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-700">
                    {error || "The performance dashboard is currently unavailable."}
                  </p>
                </div>
              </div>

              <Button
                className="h-11 min-w-[132px] gap-2 self-start"
                disabled={refreshing}
                onClick={() => {
                  void loadPerformance(false);
                }}
              >
                <RefreshCw className={cn(refreshing && "animate-spin")} size={16} />
                Retry
              </Button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (isEmptyPerformance(performance)) {
    return (
      <>
        <style jsx global>{`
          @media print {
            header {
              display: none !important;
            }

            main {
              padding-top: 0 !important;
            }
          }
        `}</style>
        <div className="student-performance-page space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/55">
                Student Portal / Performance
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-heading">
                My Academic Performance
              </h1>
              <p className="text-sm text-text/72">
                {performance.student.name} • {performance.student.registrationNumber}
              </p>
            </div>

            <div className="flex gap-2 print:hidden">
              <Button
                className="gap-2"
                disabled={refreshing}
                onClick={() => {
                  void loadPerformance(false);
                }}
                variant="secondary"
              >
                <RefreshCw className={cn(refreshing && "animate-spin")} size={16} />
                Refresh
              </Button>
              <Button className="gap-2" onClick={handlePrint} variant="secondary">
                <Printer size={16} />
                Print
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden border-sky-200">
            <div className="student-empty-state-panel relative rounded-[28px] border px-4 py-12 text-center">
              <div className="relative flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-sky-100 text-sky-700 shadow-[0_12px_24px_rgba(14,165,233,0.16)]">
                  <BarChart3 size={34} />
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-heading">
                  No grades recorded yet
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-text/72">
                  Your academic performance data will appear here once your results
                  are published.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  const classificationMeta = getClassificationMeta(performance.overview.classification);
  const standingMeta = getStandingMeta(performance.overview.academicStanding.level);
  const riskLevelMeta = getRiskLevelMeta(performance.riskReport.overallRiskLevel);
  const passRatio =
    performance.overview.totalModulesTaken > 0
      ? (performance.overview.totalModulesPassed /
          performance.overview.totalModulesTaken) *
        100
      : 0;
  const creditsLabel =
    performance.overview.totalCreditsCompleted > 0 || totalCreditsRequired > 0
      ? `${formatDisplayNumber(performance.overview.totalCreditsCompleted, 0)} / ${formatDisplayNumber(totalCreditsRequired, 0)}`
      : "N/A";
  const riskReport = performance.riskReport;

  return (
    <>
      <style jsx global>{`
        @media print {
          header {
            display: none !important;
          }

          main {
            padding-top: 0 !important;
          }
        }
      `}</style>
      <div className="student-performance-page space-y-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/55">
              Student Portal / Performance
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-heading">
              My Academic Performance
            </h1>
            <p className="text-sm text-text/72">
              {performance.student.name} • {performance.student.registrationNumber}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              className="gap-2"
              disabled={refreshing}
              onClick={() => {
                void loadPerformance(false);
              }}
              variant="secondary"
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} size={16} />
              Refresh
            </Button>
            <Button className="gap-2" onClick={handlePrint} variant="secondary">
              <Printer size={16} />
              Print
            </Button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className={cn("overflow-hidden border", classificationMeta.border)}>
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-28 bg-gradient-to-br opacity-80",
                classificationMeta.accent
              )}
            />
            <div className="relative">
              <p className="text-sm font-medium text-text/70">Cumulative GPA</p>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-4xl font-semibold tracking-tight text-heading">
                    {formatFixed(performance.overview.cumulativeGPA)}
                  </p>
                  <p
                    className={cn(
                      "mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                      classificationMeta.chip
                    )}
                  >
                    {performance.overview.classification}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
                    classificationMeta.text
                  )}
                >
                  <GraduationCap size={22} />
                </div>
              </div>
            </div>
          </Card>

          <Card className={cn("border", standingMeta.card)}>
            <p className="text-sm font-medium text-text/70">Academic Standing</p>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold text-heading">
                  {performance.overview.academicStanding.standing}
                </p>
                <p className="mt-3 text-sm leading-6 text-text/72">
                  {performance.overview.academicStanding.message}
                </p>
              </div>
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80",
                  standingMeta.icon
                )}
              >
                {performance.overview.academicStanding.level === "good" ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <AlertTriangle size={22} />
                )}
              </div>
            </div>
            <span
              className={cn(
                "mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                standingMeta.pill
              )}
            >
              {performance.overview.academicStanding.level}
            </span>
          </Card>

          <Card className="border-slate-200 bg-white">
            <p className="text-sm font-medium text-text/70">Modules Completed</p>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-heading">
              {performance.overview.totalModulesPassed} / {performance.overview.totalModulesTaken}
            </p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
                style={{ width: `${Math.min(100, Math.max(0, passRatio))}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-text/72">
              {formatPercentage(passRatio, 0)} of modules passed so far
            </p>
          </Card>

          <Card className="border-slate-200 bg-white">
            <p className="text-sm font-medium text-text/70">Credits Progress</p>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-heading">
              {creditsLabel}
            </p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#034AA6] to-sky-400"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, performance.overview.progressPercentage)
                  )}%`,
                }}
              />
            </div>
            <p className="mt-3 text-sm text-text/72">
              {performance.overview.progressPercentage > 0
                ? `${formatPercentage(performance.overview.progressPercentage)} complete`
                : "N/A"}
            </p>
          </Card>

          <Card className="border-slate-200 bg-white">
            <p className="text-sm font-medium text-text/70">Performance Trend</p>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <p className={cn("text-2xl font-semibold", trendMeta.className)}>
                  {trendMeta.label}
                </p>
                <p className="mt-3 text-sm text-text/72">
                  {trendDelta === null
                    ? "More data will appear as more semesters are completed."
                    : `${trendDelta >= 0 ? "+" : ""}${formatFixed(trendDelta)} from last semester`}
                </p>
              </div>
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50",
                  trendMeta.className
                )}
              >
                <trendMeta.Icon size={22} />
              </div>
            </div>
          </Card>

          <Card
            className={cn(
              "border transition-transform duration-200",
              performance.atRiskModules.totalAtRisk > 0
                ? "cursor-pointer border-rose-200 bg-rose-50/80 hover:-translate-y-0.5"
                : "border-emerald-200 bg-emerald-50/80"
            )}
            onClick={() => {
              if (performance.atRiskModules.totalAtRisk > 0) {
                scrollToRiskSection();
              }
            }}
            onKeyDown={(event) => {
              if (
                performance.atRiskModules.totalAtRisk > 0 &&
                (event.key === "Enter" || event.key === " ")
              ) {
                event.preventDefault();
                scrollToRiskSection();
              }
            }}
            role={performance.atRiskModules.totalAtRisk > 0 ? "button" : undefined}
            tabIndex={performance.atRiskModules.totalAtRisk > 0 ? 0 : -1}
          >
            <p className="text-sm font-medium text-text/70">Modules At Risk</p>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-4xl font-semibold tracking-tight text-heading">
                  {performance.atRiskModules.totalAtRisk}
                </p>
                <p className="mt-3 text-sm text-text/72">
                  {performance.atRiskModules.totalAtRisk > 0
                    ? "Requires prompt academic attention"
                    : "All clear"}
                </p>
              </div>
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl",
                  performance.atRiskModules.totalAtRisk > 0
                    ? "bg-rose-100 text-rose-700"
                    : "bg-emerald-100 text-emerald-700"
                )}
              >
                {performance.atRiskModules.totalAtRisk > 0 ? (
                  <AlertTriangle size={22} />
                ) : (
                  <CheckCircle2 size={22} />
                )}
              </div>
            </div>
          </Card>
        </section>

        <Card className="border-slate-200 bg-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-heading">Overall Risk Level</h2>
              <p className="mt-1 text-sm text-text/72">{riskReport.summary}</p>
            </div>
            <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className={cn("text-sm font-semibold", riskLevelMeta.text)}>
                  {riskLevelMeta.label}
                </span>
                <span className="text-xs uppercase tracking-[0.12em] text-text/55">
                  {riskLevelMeta.description}
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r",
                    riskLevelMeta.bar
                  )}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-heading">GPA Trend</h2>
              <p className="mt-1 text-sm text-text/72">
                Semester-wise GPA progression across your recorded results.
              </p>
            </div>
            <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-text/65 sm:inline-flex">
              Registration: {performance.student.registrationNumber}
            </div>
          </div>

          {performance.semesterWiseGPA.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-text/72">
              No GPA data available yet.
            </div>
          ) : (
            <div className="mt-8 overflow-x-auto">
              <div className="relative min-w-[680px] pb-4">
                <div className="pointer-events-none absolute inset-x-0 bottom-[50%] border-t border-dashed border-amber-300">
                  <span className="absolute -top-5 left-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                    Minimum Pass 2.0
                  </span>
                </div>

                <div className="grid h-80 grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-4">
                  {performance.semesterWiseGPA.map((item) => {
                    const height = `${Math.max(6, (item.gpa / 4) * 100)}%`;
                    const barClass =
                      item.gpa >= 3
                        ? "from-emerald-500 to-emerald-300"
                        : item.gpa >= 2
                          ? "from-amber-500 to-amber-300"
                          : "from-rose-500 to-rose-300";

                    return (
                      <div
                        className="flex flex-col items-center justify-end gap-3"
                        key={item.label}
                      >
                        <span className="text-sm font-semibold text-heading">
                          {formatFixed(item.gpa)}
                        </span>
                        <div className="flex h-60 w-full items-end justify-center rounded-[28px] bg-slate-50 px-3 pb-3">
                          <div
                            className={cn(
                              "w-full rounded-[22px] bg-gradient-to-t shadow-[0_12px_24px_rgba(15,23,42,0.12)] transition-all",
                              barClass
                            )}
                            style={{ height }}
                          />
                        </div>
                        <span className="text-center text-xs font-medium text-text/72">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {performance.semesterWiseGPA.length === 1 ? (
                <p className="mt-4 text-sm text-text/72">
                  More data will appear as semesters are completed.
                </p>
              ) : null}
            </div>
          )}
        </Card>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-heading">Semester-wise Breakdown</h2>
            <p className="mt-1 text-sm text-text/72">
              One semester is expanded at a time to keep the detailed view focused.
            </p>
          </div>

          {sortedSemesters.map((semester) => {
            const key = buildSemesterKey(semester);
            const expanded = expandedSemester === key;
            const semesterStatusCount =
              semester.summary.failCount +
              semester.summary.proRataCount +
              semester.summary.repeatCount;

            return (
              <Card className="border-slate-200 bg-white" key={key}>
                <button
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-4 text-left"
                  onClick={() => setExpandedSemester(expanded ? null : key)}
                  type="button"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-heading">
                        {semester.academicYear} — Semester {semester.semester}
                      </h3>
                      {semesterStatusCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          <AlertTriangle size={14} />
                          Attention Required
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-text/72">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 font-semibold",
                          semester.semesterGPA >= 3
                            ? "bg-emerald-50 text-emerald-700"
                            : semester.semesterGPA >= 2
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        )}
                      >
                        GPA: {formatFixed(semester.semesterGPA)}
                      </span>
                      <span>{semester.summary.totalModules} Modules</span>
                    </div>
                  </div>

                  <ChevronDown
                    className={cn(
                      "text-text/65 transition-transform duration-200",
                      expanded && "rotate-180"
                    )}
                    size={22}
                  />
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                    expanded ? "mt-6 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="min-w-full text-left">
                        <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-text/55">
                          <tr>
                            <th className="px-4 py-3">Module Code</th>
                            <th className="px-4 py-3">Module Name</th>
                            <th className="px-4 py-3">CA Marks</th>
                            <th className="px-4 py-3">Final Exam</th>
                            <th className="px-4 py-3">Total</th>
                            <th className="px-4 py-3">Grade</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {semester.modules.map((module) => {
                            const detail = moduleDetailMap.get(module.gradeId);
                            const StatusIcon = getStatusIcon(module.status);

                            return (
                              <tr
                                className="border-t border-slate-100 align-top text-sm text-text"
                                key={module.gradeId}
                              >
                                <td className="px-4 py-4 font-semibold text-heading">
                                  {module.moduleCode}
                                </td>
                                <td className="px-4 py-4">
                                  <div>
                                    <p className="font-medium text-heading">
                                      {module.moduleName}
                                    </p>
                                    {module.gradedBy || module.gradedAt ? (
                                      <p className="mt-1 text-xs text-text/60">
                                        {module.gradedBy
                                          ? `Graded by ${module.gradedBy}`
                                          : "Grade published"}
                                        {module.gradedAt
                                          ? ` • ${formatDate(module.gradedAt)}`
                                          : ""}
                                      </p>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-4">{formatDisplayNumber(module.caMarks)}</td>
                                <td className="px-4 py-4">
                                  {formatDisplayNumber(module.finalExamMarks)}
                                </td>
                                <td className="px-4 py-4 font-medium text-heading">
                                  {formatDisplayNumber(module.totalMarks)}
                                </td>
                                <td className="px-4 py-4 font-semibold text-heading">
                                  {module.gradeLetter}
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                                      getStatusClasses(module.status)
                                    )}
                                  >
                                    <StatusIcon size={14} />
                                    {getStatusLabel(module.status)}
                                  </span>
                                  {detail && module.status !== "pass" ? (
                                    <p className="mt-2 max-w-xs text-xs leading-5 text-text/65">
                                      {detail.eligibility.explanation}
                                    </p>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap gap-3 text-sm text-text/72">
                        <span>Average Marks: {formatPercentage(semester.summary.averageMarks)}</span>
                        <span>Pass: {semester.summary.passCount}</span>
                        <span>Fail: {semester.summary.failCount}</span>
                        <span>Pro-Rata: {semester.summary.proRataCount}</span>
                        <span>Repeat: {semester.summary.repeatCount}</span>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 text-sm text-text/72 md:flex-row md:flex-wrap md:gap-6">
                        <span>
                          Highest:{" "}
                          {semester.summary.highestMarks
                            ? `${semester.summary.highestMarks.moduleName} (${formatDisplayNumber(semester.summary.highestMarks.marks)})`
                            : "N/A"}
                        </span>
                        <span>
                          Lowest:{" "}
                          {semester.summary.lowestMarks
                            ? `${semester.summary.lowestMarks.moduleName} (${formatDisplayNumber(semester.summary.lowestMarks.marks)})`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        {performance.atRiskModules.hasAnyRisk ? (
          <section id="at-risk-section">
            <Card className="border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.9),rgba(255,255,255,0.96))]">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-heading">
                      You have {performance.atRiskModules.totalAtRisk} module(s)
                      requiring attention
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-text/72">
                      Review the actions below and follow the academic standing
                      recommendations to recover early.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                {performance.atRiskModules.proRataModules.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                        <AlertTriangle size={16} />
                      </span>
                      <h3 className="text-lg font-semibold text-rose-800">
                        Pro-Rata — Full Module Repeat Required
                      </h3>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {performance.atRiskModules.proRataModules.map((module) => {
                        const detail = moduleDetailMap.get(module.gradeId);
                        return (
                          <div
                            className="rounded-2xl border border-rose-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(244,63,94,0.08)]"
                            key={module.gradeId}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-rose-700">
                                  {module.moduleCode}
                                </p>
                                <h4 className="mt-1 text-base font-semibold text-heading">
                                  {module.moduleName}
                                </h4>
                              </div>
                              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                                {module.academicYear} S{module.semester}
                              </span>
                            </div>
                            <p className="mt-4 text-sm text-text/72">
                              CA Marks: {formatDisplayNumber(module.caMarks)} • Final Exam:{" "}
                              {formatDisplayNumber(module.finalExamMarks)}
                            </p>
                            <p className="mt-2 text-sm text-text/72">
                              Total: {formatDisplayNumber(module.totalMarks)}
                            </p>
                            {detail ? (
                              <p className="mt-2 text-sm text-text/72">
                                CA deficit: {formatDisplayNumber(detail.eligibility.caDeficit, 0)} • Final
                                deficit: {formatDisplayNumber(detail.eligibility.finalDeficit, 0)}
                              </p>
                            ) : null}
                            <div className="mt-4 rounded-2xl bg-rose-50 px-3 py-3 text-sm font-medium text-rose-800">
                              Action: {module.action}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {performance.atRiskModules.repeatModules.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
                        <RotateCcw size={16} />
                      </span>
                      <h3 className="text-lg font-semibold text-yellow-800">
                        Repeat — Final Exam Repeat Required
                      </h3>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {performance.atRiskModules.repeatModules.map((module) => {
                        const detail = moduleDetailMap.get(module.gradeId);
                        return (
                          <div
                            className="rounded-2xl border border-yellow-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(234,179,8,0.08)]"
                            key={module.gradeId}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-yellow-700">
                                  {module.moduleCode}
                                </p>
                                <h4 className="mt-1 text-base font-semibold text-heading">
                                  {module.moduleName}
                                </h4>
                              </div>
                              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                                {module.academicYear} S{module.semester}
                              </span>
                            </div>
                            <p className="mt-4 text-sm text-text/72">
                              CA Marks: {formatDisplayNumber(module.caMarks)} • Final Exam:{" "}
                              {formatDisplayNumber(module.finalExamMarks)}
                            </p>
                            <p className="mt-2 text-sm text-text/72">
                              Total: {formatDisplayNumber(module.totalMarks)}
                            </p>
                            {detail ? (
                              <p className="mt-2 text-sm text-text/72">
                                CA status: {detail.eligibility.caStatus} • Final deficit:{" "}
                                {formatDisplayNumber(detail.eligibility.finalDeficit, 0)}
                              </p>
                            ) : null}
                            <div className="mt-4 rounded-2xl bg-yellow-50 px-3 py-3 text-sm font-medium text-yellow-800">
                              Action: {module.action}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {performance.atRiskModules.failedModules.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                        <XCircle size={16} />
                      </span>
                      <h3 className="text-lg font-semibold text-rose-800">
                        Failed — Academic Advisor Consultation Needed
                      </h3>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {performance.atRiskModules.failedModules.map((module) => {
                        const detail = moduleDetailMap.get(module.gradeId);
                        return (
                          <div
                            className="rounded-2xl border border-rose-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(244,63,94,0.08)]"
                            key={module.gradeId}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-rose-700">
                                  {module.moduleCode}
                                </p>
                                <h4 className="mt-1 text-base font-semibold text-heading">
                                  {module.moduleName}
                                </h4>
                              </div>
                              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                                {module.academicYear} S{module.semester}
                              </span>
                            </div>
                            <p className="mt-4 text-sm text-text/72">
                              CA Marks: {formatDisplayNumber(module.caMarks)} • Final Exam:{" "}
                              {formatDisplayNumber(module.finalExamMarks)}
                            </p>
                            <p className="mt-2 text-sm text-text/72">
                              Total: {formatDisplayNumber(module.totalMarks)}
                            </p>
                            {detail ? (
                              <p className="mt-2 text-sm text-text/72">
                                {detail.eligibility.explanation}
                              </p>
                            ) : null}
                            <div className="mt-4 rounded-2xl bg-rose-50 px-3 py-3 text-sm font-medium text-rose-800">
                              Action: {module.action}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                  <h3 className="text-base font-semibold text-heading">
                    Recommended Actions
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-text/72">
                    {performance.overview.academicStanding.recommendations.map(
                      (recommendation) => (
                        <li className="flex gap-2" key={recommendation}>
                          <span className="mt-1 text-sky-700">•</span>
                          <span>{recommendation}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </Card>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
          <Card className="border-slate-200 bg-white">
            <h2 className="text-xl font-semibold text-heading">Grade Distribution</h2>
            <p className="mt-1 text-sm text-text/72">
              Your overall grade pattern across completed modules.
            </p>

            {gradeDistribution.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-text/72">
                Grade distribution will appear once modules are graded.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {gradeDistribution.map((item) => {
                  const colorClass =
                    item.gradeLetter.startsWith("A")
                      ? "bg-emerald-600"
                      : item.gradeLetter.startsWith("B")
                        ? "bg-emerald-400"
                        : item.gradeLetter.startsWith("C")
                          ? "bg-amber-400"
                          : item.gradeLetter.startsWith("D")
                            ? "bg-orange-400"
                            : "bg-rose-500";

                  return (
                    <div className="grid grid-cols-[42px_1fr_auto] items-center gap-3" key={item.gradeLetter}>
                      <span className="text-sm font-semibold text-heading">
                        {item.gradeLetter}
                      </span>
                      <div className="h-9 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "flex h-full items-center justify-end rounded-full px-3 text-xs font-semibold text-white transition-all",
                            colorClass
                          )}
                          style={{ width: `${item.width}%` }}
                        >
                          {item.count}
                        </div>
                      </div>
                      <span className="text-sm text-text/72">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="border-slate-200 bg-white">
            <h2 className="text-xl font-semibold text-heading">Risk History</h2>
            <p className="mt-1 text-sm text-text/72">
              Semester-by-semester view of risk concentration.
            </p>

            {performance.riskReport.semesterRiskHistory.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-text/72">
                No semester risk history available yet.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {performance.riskReport.semesterRiskHistory.map((item) => (
                  <div
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                    key={`${item.academicYear}-${item.semester}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-heading">
                          {item.academicYear} — Semester {item.semester}
                        </p>
                        <p className="mt-1 text-sm text-text/72">
                          {item.totalModules} modules • {item.passCount} pass •{" "}
                          {item.failCount + item.proRataCount + item.repeatCount} at-risk
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          item.semesterStatus === "clear"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.semesterStatus === "at-risk"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                        )}
                      >
                        {item.semesterStatus}
                      </span>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          item.semesterStatus === "clear"
                            ? "bg-emerald-500"
                            : item.semesterStatus === "at-risk"
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        )}
                        style={{ width: `${Math.min(100, item.riskPercentage)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-text/72">
                      Risk Percentage: {formatPercentage(item.riskPercentage)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
