"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  PlayCircle,
  Send,
  Trophy,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { resolveCurrentStudentRecord } from "@/lib/student-session";

type QuestionType = "mcq" | "true-false" | "short-answer";

interface StudentLookupRecord {
  id: string;
  studentId: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface StudentQuizQuestion {
  _id: string;
  questionText: string;
  questionType: QuestionType;
  options: Array<{
    _id: string;
    optionText: string;
  }>;
  marks: number;
  explanation?: string;
  order: number;
}

interface StudentQuizPreview {
  id: string;
  title: string;
  description: string;
  duration: number;
  totalMarks: number;
  passingMarks?: number;
  deadline?: string | null;
  questions: StudentQuizQuestion[];
}

interface AttemptInfo {
  id: string;
  attemptNumber: number;
  startedAt: string;
  timeLimit: number;
  deadline: string;
}

interface SubmissionResult {
  attempt: {
    id: string;
    score: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
    timeTaken: number;
    isOnTime: boolean;
    isWithinTimeLimit: boolean;
    status: string;
  };
  results: {
    answers: Array<{
      questionId: string;
      questionText: string;
      isCorrect: boolean;
      marksAwarded: number;
      questionMarks: number;
      correctAnswer?: string;
      selectedAnswer?: string;
    }>;
  } | null;
  xpAwarded?: {
    totalXP: number;
    actions: Array<{
      action: string;
      xpPoints: number;
      reason: string;
    }>;
    milestonesUnlocked: string[];
    newTotalXP: number;
  } | null;
  message: string;
}

interface ReviewAttemptData {
  attempt: {
    id: string;
    attemptNumber: number;
    status: string;
    startedAt: string | null;
    submittedAt?: string | null;
    score?: number;
    totalMarks?: number;
    percentage?: number;
    passed?: boolean;
    isOnTime?: boolean;
    isWithinTimeLimit?: boolean;
    timeTaken?: number;
    feedback?: string | null;
  };
  quiz: StudentQuizPreview & { deadline?: string | null };
  results: SubmissionResult["results"];
}

interface AnswerDraft {
  selectedOptionId?: string;
  answerText?: string;
}

const STUDENT_PROFILE_EMPTY_TITLE = "Student profile not found";
const STUDENT_PROFILE_EMPTY_MESSAGE =
  "Please make sure you're logged in with a valid student account, or contact your administrator.";
const SHORT_ANSWER_MAX_LENGTH = 500;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatTimer(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours > 0) {
    return [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
  }
  return [minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
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
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Card>
        <Skeleton className="h-56 w-full rounded-[28px]" />
      </Card>
      <Card>
        <Skeleton className="h-[520px] w-full rounded-[28px]" />
      </Card>
    </div>
  );
}

function StudentProfileEmptyState({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  return (
    <Card className="border-sky-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.94),rgba(255,255,255,0.98))]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <PlayCircle size={22} />
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
        <div className="flex gap-3">
          <Button onClick={onBack} variant="secondary">
            Back
          </Button>
          <Button onClick={onRetry} variant="secondary">
            Retry
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SubmitModal({
  answeredCount,
  totalQuestions,
  unanswered,
  onCancel,
  onConfirm,
  submitting,
}: {
  answeredCount: number;
  totalQuestions: number;
  unanswered: number[];
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="mx-auto max-w-xl rounded-[32px] border border-border bg-card p-6 shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
        <h2 className="text-2xl font-semibold text-heading">Submit Quiz?</h2>
        <p className="mt-3 text-sm leading-6 text-text/72">
          You answered {answeredCount} out of {totalQuestions} question
          {totalQuestions === 1 ? "" : "s"}.
        </p>
        {unanswered.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle size={16} />
              </span>
              <div>
                <p className="font-semibold">Some questions are still unanswered</p>
                <p className="mt-1">Questions {unanswered.join(", ")} are unanswered.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={16} />
              </span>
              <span className="font-semibold">All questions answered. You are ready to submit.</span>
            </div>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={onCancel} variant="secondary">
            Go Back &amp; Review
          </Button>
          <Button className="gap-2" disabled={submitting} onClick={onConfirm}>
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            {unanswered.length > 0 ? "Submit Anyway" : "Submit Quiz"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function StudentQuizAttemptPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const quizId = collapseSpaces(params?.id);
  const shouldResume = searchParams.get("resume") === "1";
  const shouldReview = searchParams.get("review") === "1";

  const [studentRecord, setStudentRecord] = useState<StudentLookupRecord | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<StudentQuizPreview | null>(null);
  const [liveQuiz, setLiveQuiz] = useState<StudentQuizPreview | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<AttemptInfo | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [profileMissing, setProfileMissing] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [reviewData, setReviewData] = useState<ReviewAttemptData | null>(null);
  const [timeTick, setTimeTick] = useState(Date.now());
  const [timeUpOpen, setTimeUpOpen] = useState(false);
  const [displayedXpTotal, setDisplayedXpTotal] = useState(0);
  const timeUpTriggeredRef = useRef(false);
  const fiveMinuteWarningShownRef = useRef(false);
  const oneMinuteWarningShownRef = useRef(false);

  const answeredCount = useMemo(() => {
    const sourceQuestions = liveQuiz?.questions ?? [];
    return sourceQuestions.reduce((count, question) => {
      const answer = answers[question._id];
      if (!answer) return count;
      if (question.questionType === "short-answer") {
        return collapseSpaces(answer.answerText) ? count + 1 : count;
      }
      return answer.selectedOptionId ? count + 1 : count;
    }, 0);
  }, [answers, liveQuiz]);

  const unansweredQuestions = useMemo(() => {
    const sourceQuestions = liveQuiz?.questions ?? [];
    return sourceQuestions
      .filter((question) => {
        const answer = answers[question._id];
        if (!answer) return true;
        if (question.questionType === "short-answer") {
          return !collapseSpaces(answer.answerText);
        }
        return !answer.selectedOptionId;
      })
      .map((question, index) => index + 1);
  }, [answers, liveQuiz]);

  const currentQuestion = liveQuiz?.questions[currentIndex] ?? null;

  const remainingSeconds = useMemo(() => {
    if (!attemptInfo || !liveQuiz || submission || reviewData) {
      return 0;
    }
    const startedAt = new Date(attemptInfo.startedAt).getTime();
    const deadlineAt = new Date(attemptInfo.deadline).getTime();
    if (Number.isNaN(startedAt) || Number.isNaN(deadlineAt)) {
      return 0;
    }
    const attemptDeadline = startedAt + liveQuiz.duration * 60 * 1000;
    const effectiveDeadline = Math.min(attemptDeadline, deadlineAt);
    return Math.max(0, Math.floor((effectiveDeadline - timeTick) / 1000));
  }, [attemptInfo, liveQuiz, reviewData, submission, timeTick]);
  const timerWarningLevel = useMemo(() => {
    if (!attemptInfo || !liveQuiz || submission || reviewData) {
      return null;
    }

    if (remainingSeconds <= 60) {
      return "critical";
    }

    if (remainingSeconds <= 300) {
      return "warning";
    }

    return null;
  }, [attemptInfo, liveQuiz, remainingSeconds, reviewData, submission]);

  useEffect(() => {
    void initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  useEffect(() => {
    if (!attemptInfo || !liveQuiz || submission || reviewData) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimeTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [attemptInfo, liveQuiz, reviewData, submission]);

  useEffect(() => {
    if (!attemptInfo || !liveQuiz || submission || reviewData) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [attemptInfo, liveQuiz, reviewData, submission]);

  useEffect(() => {
    if (!attemptInfo) {
      return;
    }

    const key = `unihub_quiz_answers_${attemptInfo.id}`;
    window.localStorage.setItem(key, JSON.stringify(answers));
  }, [answers, attemptInfo]);

  useEffect(() => {
    const target = submission?.xpAwarded?.totalXP ?? 0;
    if (target <= 0) {
      setDisplayedXpTotal(0);
      return;
    }

    setDisplayedXpTotal(0);
    const steps = Math.min(target, 24);
    const increment = Math.max(1, Math.ceil(target / steps));
    const interval = window.setInterval(() => {
      setDisplayedXpTotal((current) => {
        if (current >= target) {
          window.clearInterval(interval);
          return target;
        }

        const next = Math.min(target, current + increment);
        if (next >= target) {
          window.clearInterval(interval);
        }
        return next;
      });
    }, 45);

    return () => {
      window.clearInterval(interval);
    };
  }, [submission?.xpAwarded?.totalXP]);

  useEffect(() => {
    if (
      !attemptInfo ||
      !liveQuiz ||
      submission ||
      reviewData ||
      remainingSeconds > 0 ||
      timeUpTriggeredRef.current
    ) {
      return;
    }

    timeUpTriggeredRef.current = true;
    setTimeUpOpen(true);
    toast({
      title: "Info",
      message: "Time's up. Your quiz is being submitted automatically.",
      variant: "info",
    });
    window.setTimeout(() => {
      void submitQuiz(true);
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptInfo, liveQuiz, remainingSeconds, reviewData, submission, toast]);

  useEffect(() => {
    if (!attemptInfo || !liveQuiz || submission || reviewData) {
      return;
    }

    if (remainingSeconds <= 60 && !oneMinuteWarningShownRef.current) {
      oneMinuteWarningShownRef.current = true;
      toast({
        title: "Final minute",
        message: "Less than 1 minute remains. Review and submit now.",
        variant: "error",
      });
      return;
    }

    if (remainingSeconds <= 300 && !fiveMinuteWarningShownRef.current) {
      fiveMinuteWarningShownRef.current = true;
      toast({
        title: "Time running low",
        message: "5 minutes remaining. Finish reviewing your answers.",
        variant: "info",
      });
    }
  }, [attemptInfo, liveQuiz, remainingSeconds, reviewData, submission, toast]);

  async function initializePage() {
    setLoading(true);
    setError("");
    setProfileMissing(false);

    try {
      const resolvedStudent = await resolveCurrentStudentRecord();
      if (!resolvedStudent) {
        setStudentRecord(null);
        setPreviewQuiz(null);
        setLiveQuiz(null);
        setAttemptInfo(null);
        setReviewData(null);
        setSubmission(null);
        setProfileMissing(true);
        return;
      }

      setStudentRecord(resolvedStudent);

      const previewResponse = await fetch(`/api/quizzes/${encodeURIComponent(quizId)}?studentView=true`, {
        cache: "no-store",
      });
      const previewPayload = await readJson<{ success?: boolean; data?: StudentQuizPreview; error?: string }>(
        previewResponse
      );
      if (!previewResponse.ok || !previewPayload?.success || !previewPayload.data) {
        throw new Error(collapseSpaces(previewPayload?.error) || "Failed to load quiz.");
      }

      setPreviewQuiz(previewPayload.data);

      if (shouldReview) {
        const storedAttemptId = window.localStorage.getItem(`unihub_quiz_last_attempt_${quizId}`);
        if (storedAttemptId) {
          await loadAttemptReview(resolvedStudent.id, storedAttemptId);
          return;
        }
      }

      if (shouldResume) {
        await startQuiz(resolvedStudent.id, true);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load quiz.";
      setProfileMissing(false);
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

  async function loadAttemptReview(studentId: string, attemptId: string) {
    const response = await fetch(
      `/api/quizzes/${encodeURIComponent(quizId)}/attempt/${encodeURIComponent(attemptId)}?studentId=${encodeURIComponent(studentId)}`,
      {
        cache: "no-store",
      }
    );
    const payload = await readJson<{ success?: boolean; data?: ReviewAttemptData; error?: string }>(response);
    if (!response.ok || !payload?.success || !payload.data) {
      throw new Error(collapseSpaces(payload?.error) || "Failed to load quiz review.");
    }

    if (payload.data.attempt.status === "in_progress") {
      setLiveQuiz(payload.data.quiz);
      setAttemptInfo({
        id: payload.data.attempt.id,
        attemptNumber: payload.data.attempt.attemptNumber,
        startedAt: payload.data.attempt.startedAt ?? new Date().toISOString(),
        timeLimit: payload.data.quiz.duration,
        deadline: payload.data.quiz.deadline ?? new Date().toISOString(),
      });
      setTimeTick(Date.now());
      setTimeUpOpen(false);
      timeUpTriggeredRef.current = false;
      fiveMinuteWarningShownRef.current = false;
      oneMinuteWarningShownRef.current = false;
      const storedAnswers = window.localStorage.getItem(`unihub_quiz_answers_${payload.data.attempt.id}`);
      if (storedAnswers) {
        setAnswers(JSON.parse(storedAnswers) as Record<string, AnswerDraft>);
      }
      return;
    }

    setReviewData(payload.data);
  }

  async function startQuiz(studentId: string, silent = false) {
    setStarting(true);
    setError("");

    try {
      const response = await fetch(`/api/quizzes/${encodeURIComponent(quizId)}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const payload = await readJson<{
        success?: boolean;
        data?: {
          attempt: AttemptInfo;
          quiz: StudentQuizPreview;
        };
        error?: string;
      }>(response);

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(collapseSpaces(payload?.error) || "Failed to start quiz.");
      }

      setAttemptInfo(payload.data.attempt);
      setLiveQuiz(payload.data.quiz);
      setCurrentIndex(0);
      setSubmission(null);
      setReviewData(null);
      setTimeTick(Date.now());
      setTimeUpOpen(false);
      timeUpTriggeredRef.current = false;
      fiveMinuteWarningShownRef.current = false;
      oneMinuteWarningShownRef.current = false;

      const storedAnswers = window.localStorage.getItem(`unihub_quiz_answers_${payload.data.attempt.id}`);
      setAnswers(storedAnswers ? (JSON.parse(storedAnswers) as Record<string, AnswerDraft>) : {});

      if (!silent) {
        toast({
          title: "Started",
          message: "Your quiz timer has started.",
          variant: "info",
        });
      }
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : "Failed to start quiz.";
      setError(message);
      toast({
        title: "Failed",
        message,
        variant: "error",
      });
    } finally {
      setStarting(false);
    }
  }

  function updateAnswer(questionId: string, patch: AnswerDraft) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: {
        ...previous[questionId],
        ...patch,
        ...(typeof patch.answerText === "string"
          ? { answerText: patch.answerText.slice(0, SHORT_ANSWER_MAX_LENGTH) }
          : {}),
      },
    }));
  }

  function handleReviewFromSubmitModal() {
    setSubmitModalOpen(false);
    if (unansweredQuestions.length > 0) {
      setCurrentIndex(Math.max(0, unansweredQuestions[0] - 1));
    }
  }

  async function submitQuiz(isAutomatic = false) {
    if (!attemptInfo || !studentRecord || !liveQuiz) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/quizzes/${encodeURIComponent(quizId)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attemptInfo.id,
          studentId: studentRecord.id,
          answers: liveQuiz.questions.map((question) => ({
            questionId: question._id,
            ...(answers[question._id]?.selectedOptionId
              ? { selectedOptionId: answers[question._id]?.selectedOptionId }
              : {}),
            ...(collapseSpaces(answers[question._id]?.answerText)
              ? { answerText: collapseSpaces(answers[question._id]?.answerText) }
              : {}),
          })),
        }),
      });
      const payload = await readJson<{ success?: boolean; data?: SubmissionResult; error?: string }>(response);

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(collapseSpaces(payload?.error) || "Failed to submit quiz.");
      }

      setSubmission(payload.data);
      setSubmitModalOpen(false);
      setTimeUpOpen(false);
      window.localStorage.removeItem(`unihub_quiz_answers_${attemptInfo.id}`);
      window.localStorage.setItem(`unihub_quiz_last_attempt_${quizId}`, payload.data.attempt.id);

      toast({
        title: "Submitted",
        message: isAutomatic ? "Time expired. Your quiz was auto-submitted." : payload.data.message,
        variant: "success",
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to submit quiz.";
      setError(message);
      toast({
        title: "Failed",
        message,
        variant: "error",
      });
      timeUpTriggeredRef.current = false;
      setTimeUpOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (profileMissing) {
    return (
      <StudentProfileEmptyState
        onBack={() => router.push("/student/quizzes")}
        onRetry={() => void initializePage()}
      />
    );
  }

  if (error && !previewQuiz && !liveQuiz && !reviewData && !submission) {
    return (
      <Card className="border-red-200 bg-red-50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">
              Student Portal / Quizzes
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-red-900">
              Failed to load quiz
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-red-900/80">{error}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => router.push("/student/quizzes")} variant="secondary">
              Back
            </Button>
            <Button onClick={() => void initializePage()} variant="secondary">
              Retry
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const resultSource = submission
    ? {
        attempt: submission.attempt,
        quiz: liveQuiz ?? previewQuiz,
        results: submission.results,
      }
    : reviewData
      ? {
          attempt: reviewData.attempt,
          quiz: reviewData.quiz,
          results: reviewData.results,
        }
      : null;
  const earnedXp = submission?.xpAwarded ?? null;

  if (resultSource && resultSource.quiz) {
    return (
      <div className="space-y-8">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#034aa6]">
            Student Portal / Quizzes
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-heading">
            {resultSource.attempt.passed ? "Quiz Completed" : "Quiz Review"}
          </h1>
        </section>

        <Card className="border-slate-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,0.98))]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#034aa6]">
                {resultSource.quiz.title}
              </p>
              <h2 className="mt-3 text-4xl font-semibold text-heading">
                {resultSource.attempt.score ?? 0} / {resultSource.attempt.totalMarks ?? resultSource.quiz.totalMarks} (
                {(resultSource.attempt.percentage ?? 0).toFixed(2)}%)
              </h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <Badge variant={resultSource.attempt.passed ? "success" : "danger"}>
                  {resultSource.attempt.passed ? "Passed" : "Needs Improvement"}
                </Badge>
                <Badge variant={resultSource.attempt.isOnTime ? "success" : "warning"}>
                  {resultSource.attempt.isOnTime ? "Submitted before deadline" : "Late submission"}
                </Badge>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border-slate-200 bg-white" title="Time Taken">
                <p className="text-lg font-semibold text-heading">
                  {formatDuration(resultSource.attempt.timeTaken ?? 0)}
                </p>
              </Card>
              <Card className="border-slate-200 bg-white" title="Attempt">
                <p className="text-lg font-semibold text-heading">
                  #
                  {"attemptNumber" in resultSource.attempt
                    ? resultSource.attempt.attemptNumber
                    : attemptInfo?.attemptNumber ?? 1}
                </p>
              </Card>
            </div>
          </div>
        </Card>

        {earnedXp ? (
          <Card className="border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  XP Earned
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-emerald-900">
                  +{displayedXpTotal} XP
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-900/75">
                  Your quiz submission has been added to UniHub Rewards and contributes to your overall ranking.
                </p>
              </div>
              <Card className="border-emerald-200 bg-white/90" title="New Total">
                <p className="text-3xl font-semibold text-heading">{earnedXp.newTotalXP} XP</p>
              </Card>
            </div>

            <div className="mt-6 space-y-3 rounded-[24px] border border-emerald-100 bg-white/85 p-5">
              {earnedXp.actions.map((award) => (
                <div
                  className="flex items-center justify-between gap-4 border-b border-emerald-100 pb-3 last:border-b-0 last:pb-0"
                  key={`${award.action}-${award.reason}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-heading">{award.reason}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-emerald-700">
                        {award.action.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700">
                    +{award.xpPoints} XP
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                <span>Total Earned</span>
                <span>+{earnedXp.totalXP} XP</span>
              </div>
            </div>

            {earnedXp.milestonesUnlocked.length ? (
              <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-700">
                  Milestone Unlocked
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {earnedXp.milestonesUnlocked.map((milestone) => (
                    <Badge key={milestone} variant="warning">
                      {milestone}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/student/gamification">
                <Button className="gap-2" variant="secondary">
                  <Trophy size={16} />
                  View all XP
                </Button>
              </Link>
              <Link href="/student/trophies">
                <Button className="gap-2" variant="secondary">
                  <Trophy size={16} />
                  View Trophies
                </Button>
              </Link>
            </div>
          </Card>
        ) : null}

        {resultSource.results ? (
          <section className="space-y-4">
            {resultSource.results.answers.map((answer, index) => (
              <Card className="border-slate-200 bg-white" key={`${answer.questionId}-${index}`}>
                <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#034aa6]">
                      Question {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-heading">{answer.questionText}</h3>
                  </div>
                  <Badge variant={answer.isCorrect ? "success" : "danger"}>
                    {answer.marksAwarded}/{answer.questionMarks}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className={cn("rounded-2xl border px-4 py-3 text-sm", answer.isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
                    <p className="font-semibold">Your Answer</p>
                    <p className="mt-1">{answer.selectedAnswer || "No answer submitted"}</p>
                  </div>
                  {answer.correctAnswer ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-text/75">
                      <p className="font-semibold text-heading">Correct Answer</p>
                      <p className="mt-1">{answer.correctAnswer}</p>
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </section>
        ) : (
          <Card className="border-slate-200 bg-white">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <CheckCircle2 size={22} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-heading">Quiz submitted successfully</h2>
                <p className="mt-2 text-sm leading-6 text-text/72">
                  Your results are currently hidden. They will appear once your lecturer releases them.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card className="border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-heading">
                {earnedXp ? "Keep the Streak Going" : "XP Preview"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-text/72">
                {earnedXp
                  ? "Keep finishing quizzes on time and pushing above 80% to climb the leaderboard faster."
                  : "Completing quizzes on time and pushing above 80% can unlock bonus XP in the gamification system."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/student/quizzes">
                <Button variant="secondary">Back to Quizzes</Button>
              </Link>
              <Link href={`/student/quizzes/${encodeURIComponent(quizId)}?resume=1&retry=1`}>
                <Button className="gap-2">
                  <ArrowRight size={16} />
                  Retry
                </Button>
              </Link>
              <Link href="/student/gamification">
                <Button className="gap-2" variant="secondary">
                  <Trophy size={16} />
                  My XP
                </Button>
              </Link>
              <Link href="/student/trophies">
                <Button className="gap-2" variant="secondary">
                  <Trophy size={16} />
                  Trophies
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!previewQuiz) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#034aa6]">
          Student Portal / Quizzes
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-heading">{previewQuiz.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text/72">
              {previewQuiz.description || "Read the instructions carefully before you begin."}
            </p>
            {studentRecord ? (
              <p className="mt-2 text-sm text-text/60">
                {buildStudentName(studentRecord)} · {studentRecord.studentId}
              </p>
            ) : null}
          </div>
          <Link href="/student/quizzes">
            <Button className="gap-2" variant="secondary">
              <ArrowLeft size={16} />
              Back to Quizzes
            </Button>
          </Link>
        </div>
      </section>

      {attemptInfo && liveQuiz ? (
        <>
          <section className="sticky top-4 z-30">
            <Card className="border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-lg font-semibold text-heading">{liveQuiz.title}</p>
                  <p className="mt-1 text-sm text-text/65">
                    Question {currentIndex + 1} of {liveQuiz.questions.length}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold", remainingSeconds > liveQuiz.duration * 60 * 0.5 ? "bg-emerald-100 text-emerald-800" : remainingSeconds > liveQuiz.duration * 60 * 0.25 ? "bg-amber-100 text-amber-800" : "animate-pulse bg-rose-100 text-rose-800")}>
                    <Clock3 size={16} />
                    {formatTimer(remainingSeconds)} remaining
                  </div>
                  <Button className="gap-2" onClick={() => setSubmitModalOpen(true)}>
                    <Send size={16} />
                    Submit Quiz
                  </Button>
                </div>
              </div>
            </Card>
          </section>

          {timerWarningLevel ? (
            <Card
              className={cn(
                timerWarningLevel === "critical"
                  ? "border-rose-200 bg-rose-50"
                  : "border-amber-200 bg-amber-50"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-2xl",
                    timerWarningLevel === "critical"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-700"
                  )}
                >
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <p
                    className={cn(
                      "text-sm font-semibold uppercase tracking-[0.12em]",
                      timerWarningLevel === "critical" ? "text-rose-700" : "text-amber-700"
                    )}
                  >
                    {timerWarningLevel === "critical" ? "Final Minute" : "Time Running Low"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text/72">
                    {timerWarningLevel === "critical"
                      ? "Less than one minute remains. Submit as soon as you are ready."
                      : "Five minutes remain. Review unanswered questions and prepare to submit."}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {currentQuestion ? (
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <Card className="border-slate-200 bg-white">
                <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#034aa6]">
                      Question {currentIndex + 1}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-heading">{currentQuestion.questionText}</h2>
                  </div>
                  <Badge variant="primary">{currentQuestion.marks} marks</Badge>
                </div>

                <div className="mt-6">
                  {currentQuestion.questionType === "short-answer" ? (
                    <div className="space-y-2">
                      <textarea
                        className="min-h-[180px] w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-text outline-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-focus"
                        maxLength={SHORT_ANSWER_MAX_LENGTH}
                        onChange={(event) =>
                          updateAnswer(currentQuestion._id, {
                            answerText: event.target.value,
                          })
                        }
                        placeholder="Type your answer here"
                        value={answers[currentQuestion._id]?.answerText ?? ""}
                      />
                      <div className="flex justify-between text-xs text-text/60">
                        <span>Short answers can be left blank, but they are trimmed before submission.</span>
                        <span
                          className={cn(
                            (answers[currentQuestion._id]?.answerText?.length ?? 0) >= 450 &&
                              "font-semibold text-amber-700"
                          )}
                        >
                          {(answers[currentQuestion._id]?.answerText?.length ?? 0)} / {SHORT_ANSWER_MAX_LENGTH}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentQuestion.options.map((option) => {
                        const selected = answers[currentQuestion._id]?.selectedOptionId === option._id;
                        return (
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-[20px] border px-4 py-4 transition-colors",
                              selected
                                ? "border-primary bg-primary/8 text-primary"
                                : "border-slate-200 bg-slate-50 text-text/78 hover:bg-white"
                            )}
                            key={option._id}
                          >
                            <input
                              checked={selected}
                              className="h-4 w-4 accent-[#034aa6]"
                              name={`question-${currentQuestion._id}`}
                              onChange={() =>
                                updateAnswer(currentQuestion._id, { selectedOptionId: option._id })
                              }
                              type="radio"
                            />
                            <span className="text-sm font-medium">{option.optionText}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() =>
                      setCurrentIndex((value) => Math.min(liveQuiz.questions.length - 1, value + 1))
                    }
                    variant={currentIndex === liveQuiz.questions.length - 1 ? "secondary" : "primary"}
                  >
                    Next
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </Card>

              <Card className="border-slate-200 bg-white">
                <h3 className="text-lg font-semibold text-heading">Question Navigator</h3>
                <p className="mt-2 text-sm text-text/72">
                  Answered questions turn blue. Jump to any question before submitting.
                </p>
                <div className="mt-5 grid grid-cols-5 gap-3">
                  {liveQuiz.questions.map((question, index) => {
                    const answer = answers[question._id];
                    const answered =
                      question.questionType === "short-answer"
                        ? Boolean(collapseSpaces(answer?.answerText))
                        : Boolean(answer?.selectedOptionId);
                    return (
                      <button
                        className={cn(
                          "inline-flex h-12 items-center justify-center rounded-2xl border text-sm font-semibold transition-colors",
                          currentIndex === index
                            ? "border-primary bg-primary text-white"
                            : answered
                              ? "border-primary/20 bg-primary/10 text-primary"
                              : "border-slate-200 bg-slate-50 text-text/70"
                        )}
                        key={question._id}
                        onClick={() => setCurrentIndex(index)}
                        type="button"
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-text/72">
                  {answeredCount} / {liveQuiz.questions.length} answered
                </div>
              </Card>
            </section>
          ) : null}
        </>
      ) : (
        <section>
          <Card className="border-slate-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,0.98))]">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_420px]">
              <div>
                <h2 className="text-3xl font-semibold text-heading">Ready to begin?</h2>
                <p className="mt-3 text-sm leading-6 text-text/72">
                  Once you start, the timer begins immediately and continues even if you switch tabs.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-text/72">
                  <li>You have {previewQuiz.duration} minutes to complete this quiz.</li>
                  <li>You cannot pause once started, so make sure you are ready.</li>
                  <li>Keep a stable internet connection and submit before time runs out.</li>
                </ul>
                <div className="mt-6">
                  <Button
                    className="gap-2"
                    disabled={starting || !studentRecord}
                    onClick={() => {
                      if (!studentRecord) return;
                      if (!window.confirm("Start this quiz now? The timer will begin immediately.")) return;
                      void startQuiz(studentRecord.id);
                    }}
                  >
                    {starting ? <Loader2 className="animate-spin" size={16} /> : <PlayCircle size={16} />}
                    Start Quiz
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="border-slate-200 bg-white" title="Questions">
                  <p className="text-3xl font-semibold text-heading">{previewQuiz.questions.length}</p>
                </Card>
                <Card className="border-slate-200 bg-white" title="Duration">
                  <p className="text-3xl font-semibold text-heading">{previewQuiz.duration}m</p>
                </Card>
                <Card className="border-slate-200 bg-white" title="Total Marks">
                  <p className="text-3xl font-semibold text-heading">{previewQuiz.totalMarks}</p>
                </Card>
                <Card className="border-slate-200 bg-white" title="Passing Marks">
                  <p className="text-3xl font-semibold text-heading">{previewQuiz.passingMarks ?? Math.ceil(previewQuiz.totalMarks * 0.5)}</p>
                </Card>
              </div>
            </div>
          </Card>
        </section>
      )}

      {submitModalOpen ? (
        <SubmitModal
          answeredCount={answeredCount}
          onCancel={handleReviewFromSubmitModal}
          onConfirm={() => void submitQuiz()}
          submitting={submitting}
          totalQuestions={liveQuiz?.questions.length ?? previewQuiz.questions.length}
          unanswered={unansweredQuestions}
        />
      ) : null}

      {timeUpOpen ? (
        <div className="fixed inset-0 z-[120] bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-md rounded-[32px] border border-border bg-card p-6 text-center shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <AlertTriangle size={24} />
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-heading">Time&apos;s Up</h2>
            <p className="mt-3 text-sm leading-6 text-text/72">
              Your remaining answers are being submitted now.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
