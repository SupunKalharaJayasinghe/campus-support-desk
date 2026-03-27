"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { readStoredUser } from "@/lib/rbac";

type PageSize = 10 | 25 | 50 | 100;
type QuizStatus = "draft" | "published" | "closed" | "archived";
type QuestionType = "mcq" | "true-false" | "short-answer";
type SortOption = "newest" | "deadline" | "title";
type ResultSortKey = "score" | "name" | "time";

interface ModuleOfferingOption {
  id: string;
  moduleCode: string;
  moduleName: string;
  intakeName: string;
  termCode: string;
}

interface QuizOptionForm {
  id: string;
  optionText: string;
  isCorrect: boolean;
}

interface QuizQuestionForm {
  id: string;
  questionText: string;
  questionType: QuestionType;
  options: QuizOptionForm[];
  correctAnswer: string;
  marks: number;
  explanation: string;
  order: number;
}

interface QuizRecord {
  id: string;
  title: string;
  description: string;
  moduleOfferingId: {
    id: string;
    moduleCode: string;
    moduleName: string;
    termCode?: string;
  } | null;
  createdBy: {
    id: string;
    name: string;
    username?: string;
  } | null;
  questions: Array<{
    _id?: string | null;
    questionText: string;
    questionType: QuestionType;
    options?: Array<{
      _id?: string | null;
      optionText: string;
      isCorrect?: boolean;
    }>;
    correctAnswer?: string;
    marks: number;
    explanation?: string;
    order: number;
  }>;
  totalMarks: number;
  passingMarks: number;
  duration: number;
  deadline: string;
  startDate: string | null;
  status: QuizStatus;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultsImmediately: boolean;
  showCorrectAnswers: boolean;
  academicYear: string | null;
  semester: 1 | 2 | null;
  tags: string[];
  questionCount: number;
  createdAt: string;
}

interface QuizResultsSummary {
  totalAttempts: number;
  uniqueStudents: number;
  averageScore: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  passCount: number;
  failCount: number;
  passRate: number;
  averageTimeTaken: number;
  onTimeCount: number;
  lateCount: number;
  scoreDistribution: Record<string, number>;
}

interface QuizResultAttemptRow {
  student: {
    id: string | null;
    name: string;
    registrationNumber: string;
  };
  score: number;
  percentage: number;
  passed: boolean;
  isOnTime: boolean;
  timeTaken: number;
  submittedAt: string | null;
  attemptNumber: number;
  status: string;
}

interface QuizResultsData {
  quiz: {
    id: string;
    title: string;
    totalMarks: number;
    passingMarks: number;
    questionCount: number;
    deadline: string | null;
  };
  summary: QuizResultsSummary;
  attempts: QuizResultAttemptRow[];
}

interface QuizFormState {
  title: string;
  description: string;
  moduleOfferingId: string;
  duration: number;
  deadline: string;
  startDate: string;
  passingMarks: string;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultsImmediately: boolean;
  showCorrectAnswers: boolean;
  academicYear: string;
  semester: "" | "1" | "2";
  tags: string;
  questions: QuizQuestionForm[];
}

interface QuizFormErrors {
  title?: string;
  moduleOfferingId?: string;
  duration?: string;
  deadline?: string;
  startDate?: string;
  passingMarks?: string;
  questions?: string;
  questionErrors: Record<string, string>;
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

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Just now";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "Just now";
  const diffMs = Date.now() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDeadlineCopy(deadline: string) {
  const target = new Date(deadline);
  if (Number.isNaN(target.getTime())) return "Invalid deadline";
  const diffMs = target.getTime() - Date.now();
  const diffDays = Math.floor(Math.abs(diffMs) / 86400000);
  if (diffMs >= 0) {
    if (diffDays === 0) return "due today";
    return `in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
  }
  return `expired ${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset();
  return new Date(parsed.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${remainder}s`;
}

function buildEmptyQuestion(type: QuestionType = "mcq", order = 1): QuizQuestionForm {
  if (type === "true-false") {
    return {
      id: createId(),
      questionText: "",
      questionType: "true-false",
      options: [
        { id: createId(), optionText: "True", isCorrect: true },
        { id: createId(), optionText: "False", isCorrect: false },
      ],
      correctAnswer: "True",
      marks: 1,
      explanation: "",
      order,
    };
  }

  return {
    id: createId(),
    questionText: "",
    questionType: type,
    options:
      type === "short-answer"
        ? []
        : [
            { id: createId(), optionText: "", isCorrect: true },
            { id: createId(), optionText: "", isCorrect: false },
          ],
    correctAnswer: "",
    marks: 1,
    explanation: "",
    order,
  };
}

function buildInitialFormState(): QuizFormState {
  return {
    title: "",
    description: "",
    moduleOfferingId: "",
    duration: 30,
    deadline: "",
    startDate: "",
    passingMarks: "",
    maxAttempts: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    showResultsImmediately: true,
    showCorrectAnswers: false,
    academicYear: "",
    semester: "",
    tags: "",
    questions: [buildEmptyQuestion("mcq", 1)],
  };
}

function calculateTotalMarks(questions: QuizQuestionForm[]) {
  return questions.reduce((sum, question) => sum + Math.max(0, Number(question.marks) || 0), 0);
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: T; error?: string; message?: string }
    | null;

  if (!response.ok || !payload?.success) {
    throw new Error(collapseSpaces(payload?.error ?? payload?.message) || "Request failed");
  }

  return payload.data as T;
}

function parseModuleOfferings(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const items = Array.isArray((payload as { items?: unknown }).items)
    ? ((payload as { items: unknown[] }).items as unknown[])
    : [];

  return items
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const id = collapseSpaces(row.id ?? row._id);
      const moduleCode = collapseSpaces(row.moduleCode);
      const moduleName = collapseSpaces(row.moduleName);
      if (!id || !moduleCode) return null;
      return {
        id,
        moduleCode,
        moduleName,
        intakeName: collapseSpaces(row.intakeName),
        termCode: collapseSpaces(row.termCode),
      } satisfies ModuleOfferingOption;
    })
    .filter((item): item is ModuleOfferingOption => Boolean(item));
}

function parseQuizzes(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      quizzes: [] as QuizRecord[],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  const data = payload as {
    quizzes?: unknown;
    pagination?: {
      total?: number;
      page?: number;
      limit?: number;
      totalPages?: number;
      hasNext?: boolean;
      hasPrev?: boolean;
    };
  };

  return {
    quizzes: Array.isArray(data.quizzes) ? (data.quizzes as QuizRecord[]) : [],
    pagination: {
      total: Number(data.pagination?.total ?? 0),
      page: Number(data.pagination?.page ?? 1),
      limit: Number(data.pagination?.limit ?? 20),
      totalPages: Math.max(1, Number(data.pagination?.totalPages ?? 1)),
      hasNext: Boolean(data.pagination?.hasNext),
      hasPrev: Boolean(data.pagination?.hasPrev),
    },
  };
}

function getStatusBadgeVariant(status: QuizStatus) {
  if (status === "published") return "success";
  if (status === "closed") return "danger";
  if (status === "archived") return "neutral";
  return "info";
}

function mapQuizToForm(quiz: QuizRecord): QuizFormState {
  return {
    title: quiz.title,
    description: quiz.description,
    moduleOfferingId: quiz.moduleOfferingId?.id ?? "",
    duration: quiz.duration,
    deadline: toDateTimeLocalValue(quiz.deadline),
    startDate: toDateTimeLocalValue(quiz.startDate),
    passingMarks: String(quiz.passingMarks ?? ""),
    maxAttempts: quiz.maxAttempts,
    shuffleQuestions: quiz.shuffleQuestions,
    shuffleOptions: quiz.shuffleOptions,
    showResultsImmediately: quiz.showResultsImmediately,
    showCorrectAnswers: quiz.showCorrectAnswers,
    academicYear: quiz.academicYear ?? "",
    semester: quiz.semester ? (String(quiz.semester) as "1" | "2") : "",
    tags: quiz.tags.join(", "),
    questions: quiz.questions.map((question, index) => ({
      id: question._id ?? createId(),
      questionText: question.questionText,
      questionType: question.questionType,
      options:
        question.questionType === "short-answer"
          ? []
          : (question.options ?? []).map((option) => ({
              id: option._id ?? createId(),
              optionText: option.optionText,
              isCorrect: Boolean(option.isCorrect),
            })),
      correctAnswer: question.correctAnswer ?? "",
      marks: question.marks,
      explanation: question.explanation ?? "",
      order: question.order || index + 1,
    })),
  };
}

function normalizeQuestionsForSave(questions: QuizQuestionForm[]) {
  return questions.map((question, index) => {
    if (question.questionType === "short-answer") {
      return {
        questionText: collapseSpaces(question.questionText),
        questionType: question.questionType,
        correctAnswer: collapseSpaces(question.correctAnswer),
        marks: Number(question.marks),
        explanation: collapseSpaces(question.explanation),
        order: index + 1,
      };
    }

    const options =
      question.questionType === "true-false"
        ? [
            { optionText: "True", isCorrect: question.correctAnswer === "True" },
            { optionText: "False", isCorrect: question.correctAnswer === "False" },
          ]
        : question.options.map((option) => ({
            optionText: collapseSpaces(option.optionText),
            isCorrect: option.isCorrect,
          }));

    return {
      questionText: collapseSpaces(question.questionText),
      questionType: question.questionType,
      options,
      marks: Number(question.marks),
      explanation: collapseSpaces(question.explanation),
      order: index + 1,
    };
  });
}

function validateQuizForm(form: QuizFormState): QuizFormErrors {
  const errors: QuizFormErrors = { questionErrors: {} };
  const totalMarks = calculateTotalMarks(form.questions);

  if (!collapseSpaces(form.title)) {
    errors.title = "Quiz title is required.";
  }
  if (!form.moduleOfferingId) {
    errors.moduleOfferingId = "Select a module offering.";
  }
  if (!Number.isFinite(form.duration) || form.duration < 1) {
    errors.duration = "Duration must be at least 1 minute.";
  }

  const deadline = form.deadline ? new Date(form.deadline) : null;
  if (!deadline || Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
    errors.deadline = "Deadline must be a valid future date.";
  }

  if (form.startDate) {
    const startDate = new Date(form.startDate);
    if (Number.isNaN(startDate.getTime())) {
      errors.startDate = "Start date must be valid.";
    } else if (deadline && startDate >= deadline) {
      errors.startDate = "Start date must be before the deadline.";
    }
  }

  if (form.passingMarks) {
    const passingMarks = Number(form.passingMarks);
    if (!Number.isFinite(passingMarks) || passingMarks < 0 || passingMarks > totalMarks) {
      errors.passingMarks = "Passing marks must stay between 0 and the total.";
    }
  }

  if (form.questions.length === 0) {
    errors.questions = "Add at least one question.";
  }

  form.questions.forEach((question, index) => {
    const key = `q-${question.id}`;
    if (!collapseSpaces(question.questionText)) {
      errors.questionErrors[`${key}-text`] = `Question ${index + 1} text is required.`;
    }
    if (!Number.isFinite(question.marks) || question.marks < 1) {
      errors.questionErrors[`${key}-marks`] = `Question ${index + 1} marks must be at least 1.`;
    }

    if (question.questionType === "short-answer") {
      if (!collapseSpaces(question.correctAnswer)) {
        errors.questionErrors[`${key}-correct`] = `Question ${index + 1} needs a correct answer.`;
      }
      return;
    }

    const optionCount =
      question.questionType === "true-false"
        ? 2
        : question.options.filter((option) => collapseSpaces(option.optionText)).length;
    if (optionCount < 2) {
      errors.questionErrors[`${key}-options`] = `Question ${index + 1} needs at least 2 options.`;
    }

    const correctCount =
      question.questionType === "true-false"
        ? Number(question.correctAnswer === "True" || question.correctAnswer === "False")
        : question.options.filter((option) => option.isCorrect).length;
    if (correctCount !== 1) {
      errors.questionErrors[`${key}-correct-option`] = `Question ${index + 1} must have exactly 1 correct option.`;
    }
  });

  return errors;
}

function LoadingTable() {
  return (
    <Card className="border-border bg-card">
      <div className="grid gap-3 border-b border-border pb-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_220px]">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton className="h-12 w-full rounded-2xl" key={index} />
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-16 w-full rounded-2xl" key={index} />
        ))}
      </div>
    </Card>
  );
}

function QuizModalShell({
  title,
  description,
  onClose,
  children,
  size = "xl",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "lg" | "xl" | "full";
}) {
  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        className={cn(
          "mx-auto flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[32px] border border-border bg-card shadow-[0_28px_70px_rgba(15,23,42,0.22)]",
          size === "lg" && "max-w-4xl",
          size === "xl" && "max-w-6xl",
          size === "full" && "max-w-[min(1200px,100%)]"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="text-2xl font-semibold text-heading">{title}</h2>
            {description ? <p className="mt-2 text-sm leading-6 text-text/72">{description}</p> : null}
          </div>
          <button
            aria-label="Close modal"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-tint text-text/75 transition-colors hover:text-heading"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

export default function AdminQuizzesPage() {
  const { toast } = useToast();
  const currentUser = useMemo(() => readStoredUser(), []);

  const [quizzes, setQuizzes] = useState<QuizRecord[]>([]);
  const [moduleOfferings, setModuleOfferings] = useState<ModuleOfferingOption[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<"" | QuizStatus>("");
  const [moduleOfferingFilter, setModuleOfferingFilter] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizRecord | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<QuizRecord | null>(null);
  const [resultsData, setResultsData] = useState<QuizResultsData | null>(null);
  const [resultsSearch, setResultsSearch] = useState("");
  const [resultsSort, setResultsSort] = useState<ResultSortKey>("score");
  const [deleteTarget, setDeleteTarget] = useState<QuizRecord | null>(null);

  const [form, setForm] = useState<QuizFormState>(() => buildInitialFormState());
  const [formErrors, setFormErrors] = useState<QuizFormErrors>({ questionErrors: {} });
  const [initialFormSnapshot, setInitialFormSnapshot] = useState("");

  const totalMarks = useMemo(() => calculateTotalMarks(form.questions), [form.questions]);
  const computedPassingMarks = useMemo(
    () => (form.passingMarks ? Number(form.passingMarks) || 0 : Math.ceil(totalMarks * 0.5)),
    [form.passingMarks, totalMarks]
  );
  const isDirty = useMemo(
    () => builderOpen && JSON.stringify(form) !== initialFormSnapshot,
    [builderOpen, form, initialFormSnapshot]
  );

  const isOverlayOpen = builderOpen || Boolean(previewQuiz || resultsData || deleteTarget);

  const sortedResultAttempts = useMemo(() => {
    const query = normalizeText(resultsSearch);
    const filtered = (resultsData?.attempts ?? []).filter((row) => {
      if (!query) {
        return true;
      }
      return normalizeText(`${row.student.name} ${row.student.registrationNumber}`).includes(query);
    });

    return [...filtered].sort((left, right) => {
      if (resultsSort === "name") {
        return left.student.name.localeCompare(right.student.name);
      }
      if (resultsSort === "time") {
        return left.timeTaken - right.timeTaken;
      }
      return right.percentage - left.percentage;
    });
  }, [resultsData, resultsSearch, resultsSort]);

  const loadModuleOfferings = useCallback(async () => {
    try {
      const response = await fetch("/api/module-offerings?page=1&pageSize=100&sort=module", {
        cache: "no-store",
      });
      const payload = await readJson<unknown>(response);
      setModuleOfferings(parseModuleOfferings(payload));
    } catch {
      setModuleOfferings([]);
    }
  }, []);

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (moduleOfferingFilter) params.set("moduleOfferingId", moduleOfferingFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (deferredSearch) params.set("search", deferredSearch);

      if (sortOption === "deadline") {
        params.set("sortBy", "deadline");
        params.set("sortOrder", "asc");
      } else if (sortOption === "title") {
        params.set("sortBy", "title");
        params.set("sortOrder", "asc");
      } else {
        params.set("sortBy", "createdAt");
        params.set("sortOrder", "desc");
      }

      const response = await fetch(`/api/quizzes?${params.toString()}`, { cache: "no-store" });
      const payload = await readJson<unknown>(response);
      const parsed = parseQuizzes(payload);
      setQuizzes(parsed.quizzes);
      setPagination(parsed.pagination);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load quizzes.";
      setError(message);
      setQuizzes([]);
      setPagination((previous) => ({
        ...previous,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }));
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, moduleOfferingFilter, page, pageSize, sortOption, statusFilter]);

  useEffect(() => {
    void loadModuleOfferings();
  }, [loadModuleOfferings]);

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOverlayOpen]);

  function openBuilder(mode: "create" | "edit", quiz?: QuizRecord) {
    const nextForm = mode === "edit" && quiz ? mapQuizToForm(quiz) : buildInitialFormState();
    setEditingQuiz(mode === "edit" && quiz ? quiz : null);
    setForm(nextForm);
    setFormErrors({ questionErrors: {} });
    setInitialFormSnapshot(JSON.stringify(nextForm));
    setBuilderOpen(true);
  }

  function closeBuilder() {
    if (saving) return;
    if (isDirty && !window.confirm("Discard your unsaved quiz changes?")) {
      return;
    }

    setBuilderOpen(false);
    setEditingQuiz(null);
    setForm(buildInitialFormState());
    setFormErrors({ questionErrors: {} });
  }

  async function handleSave(action: "draft" | "publish") {
    const errors = validateQuizForm(form);
    setFormErrors(errors);

    if (
      errors.title ||
      errors.moduleOfferingId ||
      errors.duration ||
      errors.deadline ||
      errors.startDate ||
      errors.passingMarks ||
      errors.questions ||
      Object.keys(errors.questionErrors).length > 0
    ) {
      toast({
        title: "Failed",
        message: "Fix the highlighted quiz builder errors before saving.",
        variant: "error",
      });
      return;
    }

    if (!currentUser?.id) {
      toast({
        title: "Failed",
        message: "Unable to resolve the current admin or lecturer identity.",
        variant: "error",
      });
      return;
    }

    const body = {
      title: collapseSpaces(form.title),
      description: collapseSpaces(form.description),
      moduleOfferingId: form.moduleOfferingId,
      createdBy: editingQuiz?.createdBy?.id ?? currentUser.id,
      questions: normalizeQuestionsForSave(form.questions),
      duration: Number(form.duration),
      deadline: new Date(form.deadline).toISOString(),
      ...(form.startDate ? { startDate: new Date(form.startDate).toISOString() } : {}),
      passingMarks: form.passingMarks ? Number(form.passingMarks) : undefined,
      maxAttempts: Number(form.maxAttempts),
      shuffleQuestions: form.shuffleQuestions,
      shuffleOptions: form.shuffleOptions,
      showResultsImmediately: form.showResultsImmediately,
      showCorrectAnswers: form.showCorrectAnswers,
      academicYear: collapseSpaces(form.academicYear) || undefined,
      semester: form.semester ? Number(form.semester) : undefined,
      tags: form.tags
        .split(",")
        .map((item) => collapseSpaces(item))
        .filter(Boolean),
      ...(editingQuiz ? {} : { status: "draft" }),
    };

    setSaving(true);
    try {
      const response = await fetch(
        editingQuiz ? `/api/quizzes/${encodeURIComponent(editingQuiz.id)}` : "/api/quizzes",
        {
          method: editingQuiz ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const savedQuiz = await readJson<QuizRecord>(response);

      if (action === "publish" && savedQuiz.status === "draft") {
        await readJson<QuizRecord>(
          await fetch(`/api/quizzes/${encodeURIComponent(savedQuiz.id)}/publish`, {
            method: "POST",
          })
        );
      }

      toast({
        title: "Saved",
        message:
          action === "publish"
            ? "Quiz saved and published successfully."
            : "Quiz saved as draft successfully.",
        variant: "success",
      });

      setBuilderOpen(false);
      setEditingQuiz(null);
      setForm(buildInitialFormState());
      setFormErrors({ questionErrors: {} });
      await loadQuizzes();
    } catch (saveError) {
      toast({
        title: "Failed",
        message: saveError instanceof Error ? saveError.message : "Failed to save quiz.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(quiz: QuizRecord) {
    setActionLoadingId(quiz.id);
    try {
      await readJson<QuizRecord>(
        await fetch(`/api/quizzes/${encodeURIComponent(quiz.id)}/publish`, {
          method: "POST",
        })
      );
      toast({
        title: "Published",
        message: `${quiz.title} is now available to students.`,
        variant: "success",
      });
      await loadQuizzes();
    } catch (publishError) {
      toast({
        title: "Failed",
        message: publishError instanceof Error ? publishError.message : "Failed to publish quiz.",
        variant: "error",
      });
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleCloseQuiz(quiz: QuizRecord) {
    setActionLoadingId(quiz.id);
    try {
      const data = await readJson<{ autoSubmittedAttempts: number }>(
        await fetch(`/api/quizzes/${encodeURIComponent(quiz.id)}/close`, {
          method: "POST",
        })
      );
      toast({
        title: "Closed",
        message:
          data.autoSubmittedAttempts > 0
            ? `${quiz.title} was closed and ${data.autoSubmittedAttempts} in-progress attempt(s) were auto-submitted.`
            : `${quiz.title} was closed successfully.`,
        variant: "success",
      });
      await loadQuizzes();
    } catch (closeError) {
      toast({
        title: "Failed",
        message: closeError instanceof Error ? closeError.message : "Failed to close quiz.",
        variant: "error",
      });
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleDeleteQuiz() {
    if (!deleteTarget) return;

    setActionLoadingId(deleteTarget.id);
    try {
      const data = await readJson<{ message: string }>(
        await fetch(`/api/quizzes/${encodeURIComponent(deleteTarget.id)}`, {
          method: "DELETE",
        })
      );
      toast({
        title: "Success",
        message: data.message,
        variant: "success",
      });
      setDeleteTarget(null);
      await loadQuizzes();
    } catch (deleteError) {
      toast({
        title: "Failed",
        message: deleteError instanceof Error ? deleteError.message : "Failed to delete quiz.",
        variant: "error",
      });
    } finally {
      setActionLoadingId("");
    }
  }

  async function openResults(quiz: QuizRecord) {
    setResultsLoading(true);
    try {
      const data = await readJson<QuizResultsData>(
        await fetch(`/api/quizzes/${encodeURIComponent(quiz.id)}/results`, {
          cache: "no-store",
        })
      );
      setResultsData(data);
      setResultsSearch("");
      setResultsSort("score");
    } catch (resultsError) {
      toast({
        title: "Failed",
        message:
          resultsError instanceof Error ? resultsError.message : "Failed to load quiz results.",
        variant: "error",
      });
    } finally {
      setResultsLoading(false);
    }
  }

  function exportResultsCsv() {
    if (!resultsData) return;

    const headers = [
      "Student Name",
      "Registration Number",
      "Score",
      "Percentage",
      "Passed",
      "Time Taken Seconds",
      "On Time",
      "Submitted At",
      "Attempt Number",
      "Status",
    ];
    const rows = resultsData.attempts.map((row) => [
      row.student.name,
      row.student.registrationNumber,
      String(row.score),
      String(row.percentage),
      row.passed ? "Yes" : "No",
      String(row.timeTaken),
      row.isOnTime ? "Yes" : "No",
      row.submittedAt ?? "",
      String(row.attemptNumber),
      row.status,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${collapseSpaces(resultsData.quiz.title).replace(/\s+/g, "-").toLowerCase()}-results.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function updateQuestion(questionId: string, patch: Partial<QuizQuestionForm>) {
    setForm((previous) => ({
      ...previous,
      questions: previous.questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question
      ),
    }));
  }

  function updateQuestionType(questionId: string, nextType: QuestionType) {
    setForm((previous) => ({
      ...previous,
      questions: previous.questions.map((question, index) => {
        if (question.id !== questionId) {
          return question;
        }

        if (nextType === "short-answer") {
          return { ...question, questionType: nextType, options: [], correctAnswer: "", order: index + 1 };
        }
        if (nextType === "true-false") {
          return {
            ...question,
            questionType: nextType,
            options: [
              { id: createId(), optionText: "True", isCorrect: true },
              { id: createId(), optionText: "False", isCorrect: false },
            ],
            correctAnswer: "True",
            order: index + 1,
          };
        }

        return {
          ...question,
          questionType: nextType,
          options: [
            { id: createId(), optionText: "", isCorrect: true },
            { id: createId(), optionText: "", isCorrect: false },
          ],
          correctAnswer: "",
          order: index + 1,
        };
      }),
    }));
  }

  function addQuestion(afterIndex?: number) {
    setForm((previous) => {
      const insertIndex = typeof afterIndex === "number" ? afterIndex + 1 : previous.questions.length;
      const nextQuestions = [...previous.questions];
      nextQuestions.splice(insertIndex, 0, buildEmptyQuestion("mcq", insertIndex + 1));
      return {
        ...previous,
        questions: nextQuestions.map((question, index) => ({ ...question, order: index + 1 })),
      };
    });
  }

  function duplicateQuestion(questionId: string) {
    setForm((previous) => {
      const sourceIndex = previous.questions.findIndex((question) => question.id === questionId);
      if (sourceIndex === -1) return previous;

      const source = previous.questions[sourceIndex];
      const clone: QuizQuestionForm = {
        ...source,
        id: createId(),
        options: source.options.map((option) => ({ ...option, id: createId() })),
      };
      const nextQuestions = [...previous.questions];
      nextQuestions.splice(sourceIndex + 1, 0, clone);
      return {
        ...previous,
        questions: nextQuestions.map((question, index) => ({ ...question, order: index + 1 })),
      };
    });
  }

  function removeQuestion(questionId: string) {
    setForm((previous) => {
      if (previous.questions.length === 1) return previous;
      return {
        ...previous,
        questions: previous.questions
          .filter((question) => question.id !== questionId)
          .map((question, index) => ({ ...question, order: index + 1 })),
      };
    });
  }

  function moveQuestion(questionId: string, direction: -1 | 1) {
    setForm((previous) => {
      const index = previous.questions.findIndex((question) => question.id === questionId);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= previous.questions.length) {
        return previous;
      }
      const nextQuestions = [...previous.questions];
      [nextQuestions[index], nextQuestions[targetIndex]] = [
        nextQuestions[targetIndex],
        nextQuestions[index],
      ];
      return {
        ...previous,
        questions: nextQuestions.map((question, nextIndex) => ({
          ...question,
          order: nextIndex + 1,
        })),
      };
    });
  }

  function addOption(questionId: string) {
    setForm((previous) => ({
      ...previous,
      questions: previous.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: [
                ...question.options,
                { id: createId(), optionText: "", isCorrect: false },
              ],
            }
          : question
      ),
    }));
  }

  function updateOption(questionId: string, optionId: string, patch: Partial<QuizOptionForm>) {
    setForm((previous) => ({
      ...previous,
      questions: previous.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.map((option) =>
                option.id === optionId ? { ...option, ...patch } : option
              ),
            }
          : question
      ),
    }));
  }

  function markCorrectOption(questionId: string, optionId: string) {
    setForm((previous) => ({
      ...previous,
      questions: previous.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.map((option) => ({
                ...option,
                isCorrect: option.id === optionId,
              })),
            }
          : question
      ),
    }));
  }

  function removeOption(questionId: string, optionId: string) {
    setForm((previous) => ({
      ...previous,
      questions: previous.questions.map((question) => {
        if (question.id !== questionId || question.options.length <= 2) return question;
        const nextOptions = question.options.filter((option) => option.id !== optionId);
        if (!nextOptions.some((option) => option.isCorrect)) {
          nextOptions[0] = { ...nextOptions[0], isCorrect: true };
        }
        return { ...question, options: nextOptions };
      }),
    }));
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <Button
            className="h-11 gap-2 rounded-2xl bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
            onClick={() => openBuilder("create")}
          >
            <Plus size={16} />
            Create Quiz
          </Button>
        }
        description="Build quizzes, publish them to students, and review performance from a single management workspace."
        title="Quiz Management"
      />

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                <ShieldAlert size={22} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-red-900">Failed to load quizzes</h2>
                <p className="mt-2 text-sm text-red-800/80">{error}</p>
              </div>
            </div>
            <Button onClick={() => void loadQuizzes()} variant="secondary">
              Retry
            </Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <LoadingTable />
      ) : (
        <Card className={cn("transition-all", isOverlayOpen && "pointer-events-none opacity-45 blur-[1px]")}>
          <div className="grid gap-3 border-b border-border pb-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_220px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/50" size={16} />
                <Input
                  className="h-12 pl-10"
                  onChange={(event) => {
                    setPage(1);
                    setSearch(event.target.value);
                  }}
                  placeholder="Search quiz title"
                  value={search}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Module Offering</label>
              <Select
                className="h-12"
                onChange={(event) => {
                  setPage(1);
                  setModuleOfferingFilter(event.target.value);
                }}
                value={moduleOfferingFilter}
              >
                <option value="">All module offerings</option>
                {moduleOfferings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.moduleCode} · {offering.termCode || "—"}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Status</label>
              <Select
                className="h-12"
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value as "" | QuizStatus);
                }}
                value={statusFilter}
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Sort</label>
              <Select
                className="h-12"
                onChange={(event) => {
                  setPage(1);
                  setSortOption(event.target.value as SortOption);
                }}
                value={sortOption}
              >
                <option value="newest">Newest first</option>
                <option value="deadline">Deadline soonest</option>
                <option value="title">Title A-Z</option>
              </Select>
            </div>

            <div className="rounded-2xl border border-border bg-tint px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">Total Quizzes</p>
              <p className="mt-1 text-2xl font-semibold text-heading">{pagination.total}</p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1220px] text-left text-sm">
              <thead className="border-b border-border bg-tint">
                <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  <th className="px-4 py-3">Quiz</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Marks</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10" colSpan={7}>
                      <div className="rounded-[28px] border border-dashed border-border bg-tint px-6 py-10 text-center">
                        <h2 className="text-xl font-semibold text-heading">No quizzes yet</h2>
                        <p className="mt-2 text-sm text-text/72">Create your first quiz and publish it when you are ready.</p>
                        <Button className="mt-5 gap-2" onClick={() => openBuilder("create")}>
                          <Plus size={16} />
                          Create Quiz
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  quizzes.map((quiz) => (
                    <tr className="border-b border-border/70 hover:bg-tint" key={quiz.id}>
                      <td className="px-4 py-4 align-top">
                        <p className={cn("font-semibold text-heading", quiz.status === "archived" && "line-through opacity-60")}>{quiz.title}</p>
                        <p className="mt-1 text-text/78">{quiz.moduleOfferingId?.moduleCode || "—"} · {quiz.moduleOfferingId?.moduleName || "Module offering"}</p>
                        <p className="mt-1 text-xs text-text/58">{quiz.questionCount} question{quiz.questionCount !== 1 ? "s" : ""} · {quiz.duration} minutes</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge variant={getStatusBadgeVariant(quiz.status)}>{quiz.status.toUpperCase()}</Badge>
                      </td>
                      <td className="px-4 py-4 align-top text-text/78">
                        <p className="font-semibold text-heading">{quiz.totalMarks} marks</p>
                        <p className="mt-1">Pass mark {quiz.passingMarks}</p>
                        <p className="mt-1">{quiz.maxAttempts} attempt{quiz.maxAttempts !== 1 ? "s" : ""}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-text/78">
                        <p className="font-semibold text-heading">{formatDateTime(quiz.deadline)}</p>
                        <p className="mt-1">{formatDeadlineCopy(quiz.deadline)}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-text/78">
                        <p className="font-semibold text-heading">{quiz.createdBy?.name || quiz.createdBy?.username || "Unknown"}</p>
                        <p className="mt-1">{formatRelativeTime(quiz.createdAt)}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-text/78">
                        {quiz.status === "draft" ? "Not live yet" : "Open results panel"}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            aria-label={`Preview ${quiz.title}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/75 transition-colors hover:bg-tint hover:text-heading"
                            onClick={() => setPreviewQuiz(quiz)}
                            type="button"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            aria-label={`Edit ${quiz.title}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/75 transition-colors hover:bg-tint hover:text-heading"
                            onClick={() => openBuilder("edit", quiz)}
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                          {quiz.status === "draft" ? (
                            <button
                              aria-label={`Publish ${quiz.title}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
                              disabled={actionLoadingId === quiz.id}
                              onClick={() => void handlePublish(quiz)}
                              type="button"
                            >
                              {actionLoadingId === quiz.id ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}
                            </button>
                          ) : null}
                          {quiz.status === "published" ? (
                            <button
                              aria-label={`Close ${quiz.title}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100"
                              disabled={actionLoadingId === quiz.id}
                              onClick={() => void handleCloseQuiz(quiz)}
                              type="button"
                            >
                              {actionLoadingId === quiz.id ? <Loader2 className="animate-spin" size={16} /> : <Clock3 size={16} />}
                            </button>
                          ) : null}
                          <button
                            aria-label={`Results for ${quiz.title}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/75 transition-colors hover:bg-tint hover:text-heading"
                            onClick={() => void openResults(quiz)}
                            type="button"
                          >
                            <BarChart3 size={16} />
                          </button>
                          <button
                            aria-label={`Delete ${quiz.title}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/75 transition-colors hover:bg-tint hover:text-heading"
                            onClick={() => setDeleteTarget(quiz)}
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPage(1);
              setPageSize(value as PageSize);
            }}
            page={page}
            pageCount={pagination.totalPages}
            pageSize={pageSize}
            totalItems={pagination.total}
          />
        </Card>
      )}

      {builderOpen ? (
        <QuizModalShell
          description="Create a quiz, define the settings, and build questions with inline validation before publishing."
          onClose={closeBuilder}
          size="full"
          title={editingQuiz ? "Edit Quiz" : "Create Quiz"}
        >
          <div className="space-y-6">
            <Card className="border-border bg-tint">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-heading">Title</label>
                  <Input
                    className={cn(formErrors.title && "border-red-300")}
                    onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                    placeholder="Week 3 - Data Structures Quiz"
                    value={form.title}
                  />
                  {formErrors.title ? <p className="text-xs text-red-700">{formErrors.title}</p> : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-heading">Module Offering</label>
                  <Select
                    className={cn(formErrors.moduleOfferingId && "border-red-300")}
                    onChange={(event) => setForm((previous) => ({ ...previous, moduleOfferingId: event.target.value }))}
                    value={form.moduleOfferingId}
                  >
                    <option value="">Select module offering</option>
                    {moduleOfferings.map((offering) => (
                      <option key={offering.id} value={offering.id}>
                        {offering.moduleCode} · {offering.moduleName}
                      </option>
                    ))}
                  </Select>
                  {formErrors.moduleOfferingId ? <p className="text-xs text-red-700">{formErrors.moduleOfferingId}</p> : null}
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-sm font-semibold text-heading">Description</label>
                  <textarea
                    className="min-h-[110px] w-full rounded-[16px] border border-border bg-card px-3.5 py-3 text-sm text-text outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus"
                    onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                    placeholder="Add instructions or scope notes for students."
                    value={form.description}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-heading">Duration (minutes)</label>
                  <Input className={cn(formErrors.duration && "border-red-300")} min={1} onChange={(event) => setForm((previous) => ({ ...previous, duration: Number(event.target.value) || 0 }))} type="number" value={form.duration} />
                  {formErrors.duration ? <p className="text-xs text-red-700">{formErrors.duration}</p> : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-heading">Deadline</label>
                  <Input className={cn(formErrors.deadline && "border-red-300")} onChange={(event) => setForm((previous) => ({ ...previous, deadline: event.target.value }))} type="datetime-local" value={form.deadline} />
                  {formErrors.deadline ? <p className="text-xs text-red-700">{formErrors.deadline}</p> : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-heading">Start Date</label>
                  <Input className={cn(formErrors.startDate && "border-red-300")} onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))} type="datetime-local" value={form.startDate} />
                  {formErrors.startDate ? <p className="text-xs text-red-700">{formErrors.startDate}</p> : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-heading">Passing Marks</label>
                  <Input className={cn(formErrors.passingMarks && "border-red-300")} min={0} onChange={(event) => setForm((previous) => ({ ...previous, passingMarks: event.target.value }))} placeholder={`Auto (${Math.ceil(totalMarks * 0.5)})`} type="number" value={form.passingMarks} />
                  {formErrors.passingMarks ? <p className="text-xs text-red-700">{formErrors.passingMarks}</p> : <p className="text-xs text-text/62">Leave empty to use 50% of total marks.</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-heading">Max Attempts</label>
                  <Input min={1} onChange={(event) => setForm((previous) => ({ ...previous, maxAttempts: Math.max(1, Number(event.target.value) || 1) }))} type="number" value={form.maxAttempts} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-heading">Academic Year</label>
                  <Input onChange={(event) => setForm((previous) => ({ ...previous, academicYear: event.target.value }))} placeholder="2025/2026" value={form.academicYear} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-heading">Semester</label>
                  <Select onChange={(event) => setForm((previous) => ({ ...previous, semester: event.target.value as "" | "1" | "2" }))} value={form.semester}>
                    <option value="">Not set</option>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-sm font-semibold text-heading">Tags</label>
                  <Input onChange={(event) => setForm((previous) => ({ ...previous, tags: event.target.value }))} placeholder="chapter-3, timed, revision" value={form.tags} />
                </div>
              </div>
            </Card>

            <Card className="border-border bg-card">
              <h3 className="text-lg font-semibold text-heading">Quiz Settings</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { key: "shuffleQuestions", label: "Shuffle Questions", value: form.shuffleQuestions },
                  { key: "shuffleOptions", label: "Shuffle Options", value: form.shuffleOptions },
                  { key: "showResultsImmediately", label: "Show Results Immediately", value: form.showResultsImmediately },
                  { key: "showCorrectAnswers", label: "Show Correct Answers", value: form.showCorrectAnswers },
                ].map((item) => (
                  <label className="flex items-center justify-between rounded-2xl border border-border bg-tint px-4 py-3" key={item.key}>
                    <span className="text-sm font-medium text-heading">{item.label}</span>
                    <input
                      checked={item.value}
                      className="h-4 w-4 accent-[#034aa6]"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          [item.key]: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                  </label>
                ))}
              </div>
            </Card>

            <Card className="border-border bg-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-heading">Question Builder</h3>
                  <p className="mt-1 text-sm text-text/72">Add, duplicate, remove, and reorder questions with inline validation.</p>
                </div>
                <Button className="gap-2" onClick={() => addQuestion()}>
                  <Plus size={16} />
                  Add Question
                </Button>
              </div>

              <div className="mt-6 space-y-5">
                {form.questions.map((question, index) => {
                  const key = `q-${question.id}`;
                  const textError = formErrors.questionErrors[`${key}-text`];
                  const marksError = formErrors.questionErrors[`${key}-marks`];
                  const optionsError = formErrors.questionErrors[`${key}-options`];
                  const correctError =
                    formErrors.questionErrors[`${key}-correct`] ||
                    formErrors.questionErrors[`${key}-correct-option`];

                  return (
                    <div className="rounded-[28px] border border-border bg-tint p-5" key={question.id}>
                      <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Question {index + 1}</p>
                          <p className="mt-1 text-xs text-text/60">Use the controls to reorder, duplicate, or remove this question.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-white hover:text-heading disabled:opacity-50" disabled={index === 0} onClick={() => moveQuestion(question.id, -1)} type="button"><ChevronUp size={16} /></button>
                          <button className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-white hover:text-heading disabled:opacity-50" disabled={index === form.questions.length - 1} onClick={() => moveQuestion(question.id, 1)} type="button"><ChevronDown size={16} /></button>
                          <button className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-medium text-text/75 hover:bg-white hover:text-heading" onClick={() => duplicateQuestion(question.id)} type="button">Duplicate</button>
                          <button className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-medium text-text/75 hover:bg-white hover:text-heading disabled:opacity-50" disabled={form.questions.length === 1} onClick={() => { if (window.confirm("Delete this question from the quiz?")) removeQuestion(question.id); }} type="button">Delete</button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-heading">Question Text</label>
                          <textarea className={cn("min-h-[110px] w-full rounded-[16px] border bg-card px-3.5 py-3 text-sm text-text outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus", textError ? "border-red-300" : "border-border")} onChange={(event) => updateQuestion(question.id, { questionText: event.target.value })} placeholder="Type the question exactly as students should see it." value={question.questionText} />
                          {textError ? <p className="text-xs text-red-700">{textError}</p> : null}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-heading">Type</label>
                          <Select onChange={(event) => updateQuestionType(question.id, event.target.value as QuestionType)} value={question.questionType}>
                            <option value="mcq">MCQ</option>
                            <option value="true-false">True / False</option>
                            <option value="short-answer">Short Answer</option>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-heading">Marks</label>
                          <Input className={cn(marksError && "border-red-300")} min={1} onChange={(event) => updateQuestion(question.id, { marks: Math.max(1, Number(event.target.value) || 0) })} type="number" value={question.marks} />
                          {marksError ? <p className="text-xs text-red-700">{marksError}</p> : null}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <label className="text-sm font-semibold text-heading">Explanation</label>
                        <textarea className="min-h-[90px] w-full rounded-[16px] border border-border bg-card px-3.5 py-3 text-sm text-text outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus" onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} placeholder="Optional explanation to show after grading." value={question.explanation} />
                      </div>

                      {question.questionType === "short-answer" ? (
                        <div className="mt-4 space-y-2">
                          <label className="text-sm font-semibold text-heading">Correct Answer</label>
                          <Input className={cn(correctError && "border-red-300")} onChange={(event) => updateQuestion(question.id, { correctAnswer: event.target.value })} placeholder="Exact answer used for auto-grading" value={question.correctAnswer} />
                          {correctError ? <p className="text-xs text-red-700">{correctError}</p> : null}
                        </div>
                      ) : question.questionType === "true-false" ? (
                        <div className="mt-4 space-y-3">
                          <p className="text-sm font-semibold text-heading">Correct Answer</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {["True", "False"].map((value) => (
                              <label className={cn("flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors", question.correctAnswer === value ? "border-primary bg-primary/8 text-primary" : "border-border bg-card text-text/78")} key={value}>
                                <span>{value}</span>
                                <input checked={question.correctAnswer === value} className="h-4 w-4 accent-[#034aa6]" name={`correct-${question.id}`} onChange={() => updateQuestion(question.id, { correctAnswer: value })} type="radio" />
                              </label>
                            ))}
                          </div>
                          {correctError ? <p className="text-xs text-red-700">{correctError}</p> : null}
                        </div>
                      ) : (
                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-heading">Options</p>
                            <Button className="gap-2" onClick={() => addOption(question.id)} variant="secondary">
                              <Plus size={14} />
                              Add Option
                            </Button>
                          </div>
                          <div className="mt-3 space-y-3">
                            {question.options.map((option) => (
                              <div className="grid gap-3 rounded-2xl border border-border bg-card px-4 py-3 md:grid-cols-[24px_minmax(0,1fr)_auto] md:items-center" key={option.id}>
                                <input aria-label={`Correct option for question ${index + 1}`} checked={option.isCorrect} className="h-4 w-4 accent-[#034aa6]" name={`mcq-correct-${question.id}`} onChange={() => markCorrectOption(question.id, option.id)} type="radio" />
                                <Input onChange={(event) => updateOption(question.id, option.id, { optionText: event.target.value })} placeholder="Option text" value={option.optionText} />
                                <button className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-tint px-3 text-sm font-medium text-text/75 transition-colors hover:bg-slate-100 disabled:opacity-50" disabled={question.options.length <= 2} onClick={() => removeOption(question.id, option.id)} type="button">Remove</button>
                              </div>
                            ))}
                          </div>
                          {optionsError ? <p className="mt-2 text-xs text-red-700">{optionsError}</p> : null}
                          {correctError ? <p className="mt-1 text-xs text-red-700">{correctError}</p> : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="sticky bottom-0 rounded-[28px] border border-border bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-heading">{form.questions.length} question{form.questions.length !== 1 ? "s" : ""} · {totalMarks} total marks · {form.duration} minutes</p>
                  <p className="text-xs text-text/62">Passing marks: {computedPassingMarks} · Max attempts: {form.maxAttempts}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={closeBuilder} variant="secondary">Cancel</Button>
                  <Button disabled={saving} onClick={() => void handleSave("draft")} variant="secondary">
                    {saving ? <Loader2 className="animate-spin" size={16} /> : null}
                    Save as Draft
                  </Button>
                  <Button className="gap-2" disabled={saving} onClick={() => void handleSave("publish")}>
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}
                    Save &amp; Publish
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </QuizModalShell>
      ) : null}

      {previewQuiz ? (
        <QuizModalShell description="Preview the quiz exactly as it is configured before students attempt it." onClose={() => setPreviewQuiz(null)} size="lg" title={previewQuiz.title}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border bg-tint" title="Module">
              <p className="text-sm text-text/78">{previewQuiz.moduleOfferingId?.moduleCode} · {previewQuiz.moduleOfferingId?.moduleName}</p>
            </Card>
            <Card className="border-border bg-tint" title="Duration">
              <p className="text-sm text-text/78">{previewQuiz.duration} minutes</p>
            </Card>
            <Card className="border-border bg-tint" title="Deadline">
              <p className="text-sm text-text/78">{formatDateTime(previewQuiz.deadline)}</p>
            </Card>
            <Card className="border-border bg-tint" title="Passing Marks">
              <p className="text-sm text-text/78">{previewQuiz.passingMarks} / {previewQuiz.totalMarks}</p>
            </Card>
          </div>
          <div className="mt-6 space-y-4">
            {previewQuiz.questions.slice().sort((left, right) => left.order - right.order).map((question, index) => (
              <Card className="border-border bg-tint" key={question._id ?? `${index}-${question.questionText}`}>
                <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Question {index + 1}</p>
                    <h3 className="mt-2 text-lg font-semibold text-heading">{question.questionText}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="info">{question.questionType}</Badge>
                    <Badge variant="primary">{question.marks} marks</Badge>
                  </div>
                </div>
                {question.questionType === "short-answer" ? (
                  <div className="mt-4 rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text/75">Correct answer: <span className="font-semibold text-heading">{question.correctAnswer || "—"}</span></div>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {(question.options ?? []).map((option) => (
                      <div className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm" key={option._id ?? option.optionText}>
                        <span>{option.optionText}</span>
                        <Badge variant={option.isCorrect ? "success" : "neutral"}>{option.isCorrect ? "Correct" : "Option"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {question.explanation ? <div className="mt-4 rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text/75">Explanation: {question.explanation}</div> : null}
              </Card>
            ))}
          </div>
        </QuizModalShell>
      ) : null}

      {resultsData ? (
        <QuizModalShell description="Review quiz analytics, inspect student attempts, and export the results as CSV." onClose={() => setResultsData(null)} size="full" title={`Results · ${resultsData.quiz.title}`}>
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {[
                { label: "Total Attempts", value: String(resultsData.summary.totalAttempts) },
                { label: "Average Score", value: `${resultsData.summary.averagePercentage.toFixed(1)}%` },
                { label: "Pass Rate", value: `${resultsData.summary.passRate.toFixed(1)}%` },
                { label: "Highest / Lowest", value: `${resultsData.summary.highestScore} / ${resultsData.summary.lowestScore}` },
                { label: "Average Time", value: formatDuration(resultsData.summary.averageTimeTaken) },
                { label: "On-Time", value: `${resultsData.summary.onTimeCount} / ${resultsData.summary.totalAttempts}` },
              ].map((item) => (
                <Card className="border-border bg-tint" key={item.label}>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">{item.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-heading">{item.value}</p>
                </Card>
              ))}
            </div>

            <Card className="border-border bg-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-heading">Score Distribution</h3>
                  <p className="mt-1 text-sm text-text/72">A quick visual of how students performed across the major score bands.</p>
                </div>
                <Button className="gap-2" onClick={exportResultsCsv} variant="secondary">
                  <FileDown size={16} />
                  Export Results
                </Button>
              </div>
              <div className="mt-6 space-y-3">
                {Object.entries(resultsData.summary.scoreDistribution).map(([bucket, count]) => {
                  const peak = Math.max(1, ...Object.values(resultsData.summary.scoreDistribution).map((value) => Number(value) || 0));
                  return (
                    <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_60px]" key={bucket}>
                      <div className="text-sm font-medium text-heading">{bucket}</div>
                      <div className="rounded-full bg-slate-100 p-1">
                        <div className="h-8 rounded-full bg-[linear-gradient(90deg,#034aa6,#06b6d4)] transition-all" style={{ width: `${Math.max(10, (Number(count) / peak) * 100)}%` }} />
                      </div>
                      <div className="text-sm font-semibold text-heading">{count}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="border-border bg-card">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-heading">Student Results</h3>
                  <p className="mt-1 text-sm text-text/72">Search and sort student performance for this quiz.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="relative block min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text/45" size={16} />
                    <Input className="h-11 pl-10" onChange={(event) => setResultsSearch(event.target.value)} placeholder="Search student name" value={resultsSearch} />
                  </label>
                  <Select className="h-11" onChange={(event) => setResultsSort(event.target.value as ResultSortKey)} value={resultsSort}>
                    <option value="score">Sort by score</option>
                    <option value="name">Sort by student</option>
                    <option value="time">Sort by time taken</option>
                  </Select>
                </div>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="border-b border-border bg-tint">
                    <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Percentage</th>
                      <th className="px-4 py-3">Passed</th>
                      <th className="px-4 py-3">Time Taken</th>
                      <th className="px-4 py-3">On Time</th>
                      <th className="px-4 py-3">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResultAttempts.length === 0 ? (
                      <tr><td className="px-4 py-10 text-center text-text/65" colSpan={7}>No attempts match the current search.</td></tr>
                    ) : (
                      sortedResultAttempts.map((attempt) => (
                        <tr className={cn("border-b border-border/70", attempt.passed ? "bg-emerald-50/40" : "bg-rose-50/35")} key={`${attempt.student.id ?? attempt.student.registrationNumber}-${attempt.attemptNumber}-${attempt.submittedAt ?? "pending"}`}>
                          <td className="px-4 py-4"><p className="font-semibold text-heading">{attempt.student.name}</p><p className="mt-1 text-xs text-text/60">{attempt.student.registrationNumber}</p></td>
                          <td className="px-4 py-4 font-semibold text-heading">{attempt.score}</td>
                          <td className="px-4 py-4 font-semibold text-heading">{attempt.percentage.toFixed(2)}%</td>
                          <td className="px-4 py-4"><Badge variant={attempt.passed ? "success" : "danger"}>{attempt.passed ? "Passed" : "Failed"}</Badge></td>
                          <td className="px-4 py-4 text-text/78">{formatDuration(attempt.timeTaken)}</td>
                          <td className="px-4 py-4"><Badge variant={attempt.isOnTime ? "success" : "warning"}>{attempt.isOnTime ? "On Time" : "Late"}</Badge></td>
                          <td className="px-4 py-4 text-text/78">{formatDateTime(attempt.submittedAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </QuizModalShell>
      ) : null}

      {deleteTarget ? (
        <QuizModalShell description="If the quiz already has attempts, deleting will archive it instead so existing submissions remain intact." onClose={() => setDeleteTarget(null)} size="lg" title="Delete Quiz?">
          <div className="space-y-4">
            <p className="text-sm leading-6 text-text/75">You are about to delete <span className="font-semibold text-heading">{deleteTarget.title}</span>. This action cannot be undone for quizzes without attempts.</p>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setDeleteTarget(null)} variant="secondary">Cancel</Button>
              <Button className="gap-2 bg-rose-600 hover:bg-rose-700" disabled={actionLoadingId === deleteTarget.id} onClick={() => void handleDeleteQuiz()}>
                {actionLoadingId === deleteTarget.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Delete / Archive
              </Button>
            </div>
          </div>
        </QuizModalShell>
      ) : null}

      {(saving || Boolean(actionLoadingId) || resultsLoading) ? (
        <div className="pointer-events-none fixed bottom-4 left-4 z-[98] inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text/70 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
          <Loader2 className="animate-spin" size={14} />
          Processing...
        </div>
      ) : null}
    </div>
  );
}
