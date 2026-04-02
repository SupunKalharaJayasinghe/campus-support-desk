"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  FileCheck2,
  Hourglass,
  PlayCircle,
  RefreshCw,
  Trophy,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { resolveCurrentStudentRecord } from "@/lib/student-session";

interface StudentLookupRecord {
  id: string;
  studentId: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface QuizDashboardData {
  available: Array<{
    quiz: {
      id: string;
      title: string;
      description: string;
      duration: number;
      totalMarks: number;
      deadline: string;
      questionCount: number;
    };
    module: { code: string; name: string };
    attemptsRemaining: number;
    timeUntilDeadline: string;
  }>;
  inProgress: Array<{
    quiz: {
      id: string;
      title: string;
      duration: number;
      totalMarks: number;
      deadline: string;
    };
    module: { code: string; name: string };
    attempt: {
      id: string;
      startedAt: string | null;
      timeRemaining: number;
    };
  }>;
  completed: Array<{
    quiz: {
      id: string;
      title: string;
      totalMarks: number;
    };
    module: { code: string; name: string };
    bestAttempt: {
      score: number;
      percentage: number;
      passed: boolean;
      submittedAt: string | null;
      xpAwarded: number;
    };
    totalAttempts: number;
  }>;
  expired: Array<{
    quiz: {
      id: string;
      title: string;
      totalMarks: number;
      deadline: string;
    };
    module: { code: string; name: string };
  }>;
  summary: {
    totalAvailable: number;
    totalInProgress: number;
    totalCompleted: number;
    totalExpired: number;
    averageScore: number;
  };
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

function formatRelativeTime(date: Date | string | null | undefined) {
  if (!date) return "Just now";
  const now = new Date();
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return "Just now";
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

function formatSeconds(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainder}s`;
  }
  return `${minutes}m ${remainder}s`;
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function buildStudentName(student: StudentLookupRecord) {
  return `${collapseSpaces(student.firstName)} ${collapseSpaces(student.lastName)}`.trim();
}


function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-10 w-20" />
            <Skeleton className="mt-3 h-4 w-36" />
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton className="h-36 w-full rounded-[28px]" />
      </Card>
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-48 w-full rounded-[28px]" />
          </Card>
        ))}
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
              Student Portal / Quizzes
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
  );
}

export default function StudentQuizzesPage() {
  const { toast } = useToast();
  const [studentRecord, setStudentRecord] = useState<StudentLookupRecord | null>(null);
  const [data, setData] = useState<QuizDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [profileMissing, setProfileMissing] = useState(false);

  useEffect(() => {
    void initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initializePage(showRefreshToast = false) {
    if (showRefreshToast) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    setProfileMissing(false);

    try {
      const resolvedStudent = await resolveCurrentStudentRecord();
      if (!resolvedStudent) {
        setStudentRecord(null);
        setData(null);
        setProfileMissing(true);
        return;
      }

      const response = await fetch(`/api/quizzes/student/${encodeURIComponent(resolvedStudent.id)}?status=all`, {
        cache: "no-store",
      });
      const payload = await readJson<{ success?: boolean; data?: QuizDashboardData; error?: string }>(
        response
      );

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(collapseSpaces(payload?.error) || "Failed to load your quizzes.");
      }

      setStudentRecord(resolvedStudent);
      setData(payload.data);
      setProfileMissing(false);

      if (showRefreshToast) {
        toast({
          title: "Updated",
          message: "Quiz dashboard refreshed.",
          variant: "success",
        });
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load quizzes.";
      setProfileMissing(false);
      setError(message);
      if (!showRefreshToast) {
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

  const summaryCards = useMemo(
    () => [
      {
        label: "Available",
        value: data?.summary.totalAvailable ?? 0,
        accent: "border-sky-200 bg-sky-50 text-sky-800",
      },
      {
        label: "In Progress",
        value: data?.summary.totalInProgress ?? 0,
        accent: "border-amber-200 bg-amber-50 text-amber-800",
      },
      {
        label: "Completed",
        value: data?.summary.totalCompleted ?? 0,
        accent: "border-emerald-200 bg-emerald-50 text-emerald-800",
      },
      {
        label: "Average Score",
        value: `${(data?.summary.averageScore ?? 0).toFixed(1)}%`,
        accent: "border-indigo-200 bg-indigo-50 text-indigo-800",
      },
    ],
    [data]
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (profileMissing) {
    return <StudentProfileEmptyState onRetry={() => void initializePage()} />;
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">
              Student Portal / Quizzes
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-red-900">
              Failed to load quizzes
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-red-900/80">{error}</p>
          </div>
          <Button onClick={() => void initializePage()} variant="secondary">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#034aa6]">
          Student Portal / Quizzes
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-heading">My Quizzes</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text/72">
              Continue active quizzes, start new ones before the deadline, and track your best scores.
            </p>
            {studentRecord ? (
              <p className="mt-2 text-sm text-text/60">
                {buildStudentName(studentRecord)} · {studentRecord.studentId}
              </p>
            ) : null}
          </div>
          <Button className="gap-2" disabled={refreshing} onClick={() => void initializePage(true)} variant="secondary">
            <RefreshCw className={cn(refreshing && "animate-spin")} size={16} />
            Refresh
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card className="border-slate-200 bg-white" key={card.label}>
            <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]", card.accent)}>
              {card.label}
            </span>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-heading">{card.value}</p>
          </Card>
        ))}
      </section>

      {data?.summary.totalInProgress ? (
        <section>
          <Card className="border-amber-200 bg-[linear-gradient(135deg,rgba(254,243,199,0.8),rgba(255,255,255,0.96))]">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Hourglass size={22} />
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-heading">
                  You have {data.summary.totalInProgress} quiz{data.summary.totalInProgress !== 1 ? "zes" : ""} in progress
                </h2>
                <p className="mt-2 text-sm leading-6 text-text/72">
                  Pick up where you left off before the timer or deadline catches up.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {data.inProgress.map((item) => (
                <Card className="border-amber-200 bg-white" key={item.attempt.id}>
                  <p className="text-lg font-semibold text-heading">{item.quiz.title}</p>
                  <p className="mt-1 text-sm text-text/65">
                    {item.module.code} · {item.module.name}
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-text/72 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-heading">Time Remaining</p>
                      <p className="mt-1">{formatSeconds(item.attempt.timeRemaining)}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-heading">Started</p>
                      <p className="mt-1">{formatRelativeTime(item.attempt.startedAt)}</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <Link href={`/student/quizzes/${encodeURIComponent(item.quiz.id)}?resume=1`}>
                      <Button className="gap-2">
                        <PlayCircle size={16} />
                        Continue
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <section>
        <Card className="border-slate-200 bg-white">
          <h2 className="text-2xl font-semibold text-heading">Available Quizzes</h2>
          <p className="mt-2 text-sm leading-6 text-text/72">
            Published quizzes that are open for you right now.
          </p>
          {data?.available.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {data.available.map((item) => (
                <Card className="border-slate-200 bg-slate-50/90" key={item.quiz.id}>
                  <p className="text-xl font-semibold text-heading">{item.quiz.title}</p>
                  <p className="mt-1 text-sm text-text/65">
                    {item.module.code} · {item.module.name}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-text/72">{item.quiz.description || "No additional instructions were provided."}</p>
                  <div className="mt-4 grid gap-3 text-sm text-text/72 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-heading">Duration</p>
                      <p className="mt-1">{item.quiz.duration} minutes</p>
                    </div>
                    <div>
                      <p className="font-semibold text-heading">Total Marks</p>
                      <p className="mt-1">{item.quiz.totalMarks} marks</p>
                    </div>
                    <div>
                      <p className="font-semibold text-heading">Attempts Remaining</p>
                      <p className="mt-1">{item.attemptsRemaining}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-heading">Deadline</p>
                      <p className={cn("mt-1", normalizeText(item.timeUntilDeadline).includes("day") ? "text-emerald-700" : normalizeText(item.timeUntilDeadline).includes("hour") ? "text-amber-700" : "text-rose-700")}>
                        {item.timeUntilDeadline}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <Link href={`/student/quizzes/${encodeURIComponent(item.quiz.id)}`}>
                      <Button className="gap-2">
                        <PlayCircle size={16} />
                        Start Quiz
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <h3 className="text-xl font-semibold text-heading">No quizzes available right now</h3>
              <p className="mt-2 text-sm text-text/65">Check back later for new published quizzes.</p>
            </div>
          )}
        </Card>
      </section>

      <section>
        <Card className="border-slate-200 bg-white">
          <h2 className="text-2xl font-semibold text-heading">Completed Quizzes</h2>
          <p className="mt-2 text-sm leading-6 text-text/72">
            Your best results so far, including quick links back into review or retry flows.
          </p>
          {data?.completed.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {data.completed.map((item) => (
                <Card className="border-slate-200 bg-slate-50/90" key={`${item.quiz.id}-${item.bestAttempt.submittedAt ?? "best"}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xl font-semibold text-heading">{item.quiz.title}</p>
                      <p className="mt-1 text-sm text-text/65">
                        {item.module.code} · {item.module.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.bestAttempt.xpAwarded > 0 ? (
                        <Badge variant="warning">+{item.bestAttempt.xpAwarded} XP</Badge>
                      ) : null}
                      <Badge variant={item.bestAttempt.passed ? "success" : "danger"}>
                        {item.bestAttempt.passed ? "Passed" : "Needs Improvement"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-text/72 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-heading">Best Score</p>
                      <p className="mt-1">
                        {item.bestAttempt.score}/{item.quiz.totalMarks} ({item.bestAttempt.percentage.toFixed(2)}%)
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-heading">Attempts Used</p>
                      <p className="mt-1">{item.totalAttempts}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={`/student/quizzes/${encodeURIComponent(item.quiz.id)}?review=1`}>
                      <Button className="gap-2" variant="secondary">
                        <FileCheck2 size={16} />
                        View Results
                      </Button>
                    </Link>
                    <Link href={`/student/quizzes/${encodeURIComponent(item.quiz.id)}?resume=1&retry=1`}>
                      <Button className="gap-2">
                        <ArrowRight size={16} />
                        Retry
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <h3 className="text-xl font-semibold text-heading">You haven&apos;t completed any quizzes yet</h3>
              <p className="mt-2 text-sm text-text/65">Your best attempts will appear here as soon as you start finishing quizzes.</p>
            </div>
          )}
        </Card>
      </section>

      <section>
        <Card className="border-slate-200 bg-white">
          <h2 className="text-2xl font-semibold text-heading">Expired Quizzes</h2>
          <p className="mt-2 text-sm leading-6 text-text/72">
            Missed deadlines stay visible here so you can track what closed before you attempted it.
          </p>
          {data?.expired.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {data.expired.map((item) => (
                <Card className="border-rose-200 bg-rose-50/70" key={`${item.quiz.id}-expired`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold text-heading">{item.quiz.title}</p>
                      <p className="mt-1 text-sm text-text/65">
                        {item.module.code} · {item.module.name}
                      </p>
                    </div>
                    <Badge variant="danger">Missed</Badge>
                  </div>
                  <div className="mt-4 text-sm text-text/72">
                    <p>Deadline: {new Date(item.quiz.deadline).toLocaleString()}</p>
                    <p className="mt-1">Total marks: {item.quiz.totalMarks}</p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <h3 className="text-xl font-semibold text-heading">No missed quizzes</h3>
              <p className="mt-2 text-sm text-text/65">You&apos;re keeping up with the published quizzes so far.</p>
            </div>
          )}
        </Card>
      </section>

      <section>
        <Card className="border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-heading">XP Boost Opportunity</h2>
              <p className="mt-2 text-sm leading-6 text-text/72">
                Complete quizzes on time and push above 80% to feed your XP streak and gamification progress.
              </p>
            </div>
            <Link href="/student/gamification">
              <Button className="gap-2" variant="secondary">
                <Trophy size={16} />
                View My XP
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
