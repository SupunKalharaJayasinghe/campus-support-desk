"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  CalendarRange,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Pencil,
  RefreshCcw,
} from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import EditTermModal, {
  type EditTermDraft,
  type NotifyBeforeDays as EditNotifyBeforeDays,
} from "@/components/admin/academic-terms/EditTermModal";
import TermPolicyPanel, {
  type TermPoliciesView,
} from "@/components/admin/academic-terms/TermPolicyPanel";
import TermScheduleTable, {
  type NotifyBeforeDays,
  type TermScheduleRowView,
  type TermScheduleStatus,
} from "@/components/admin/academic-terms/TermScheduleTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";

type TermCode =
  | "Y1S1"
  | "Y1S2"
  | "Y2S1"
  | "Y2S2"
  | "Y3S1"
  | "Y3S2"
  | "Y4S1"
  | "Y4S2";

type PageSize = 10 | 25 | 50 | 100;
type SummaryTone = "sky" | "teal" | "amber" | "green" | "rose" | "violet";

interface ScheduleApiRow {
  termCode?: string;
  startDate?: string;
  endDate?: string;
  weeks?: number;
  notifyBeforeDays?: number;
  manuallyEdited?: boolean;
  isManuallyCustomized?: boolean;
}

interface TermsApiResponse {
  intakeId?: string;
  currentTerm?: string;
  policies?: Partial<TermPoliciesView>;
  schedules?: ScheduleApiRow[];
}

interface IntakeLookupRow {
  id?: string;
  name?: string;
  facultyCode?: string;
  degreeCode?: string;
}

interface IntakeLookupResponse {
  items?: IntakeLookupRow[];
}

interface ScheduleRow {
  termCode: TermCode;
  startDate: string;
  endDate: string;
  weeks: number;
  notifyBeforeDays: NotifyBeforeDays;
  manuallyEdited: boolean;
}

const TERM_SEQUENCE: TermCode[] = [
  "Y1S1",
  "Y1S2",
  "Y2S1",
  "Y2S2",
  "Y3S1",
  "Y3S2",
  "Y4S1",
  "Y4S2",
];

const DEFAULT_POLICIES: TermPoliciesView = {
  autoJump: true,
  lockPastTerms: true,
  defaultWeeksPerTerm: 16,
  defaultNotifyBeforeDays: 3,
  autoGenerateFutureTerms: true,
};

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function collapseSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeTermCode(value: unknown): TermCode {
  const term = String(value ?? "").toUpperCase();
  return TERM_SEQUENCE.find((item) => item === term) ?? "Y1S1";
}

function sanitizeDateOnly(value: unknown) {
  const input = String(value ?? "").trim();
  if (!input) return "";
  const parsed = input.includes("T")
    ? new Date(input)
    : new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function sanitizeWeeks(value: unknown) {
  const parsed = Number(value);
  if (parsed === 12 || parsed === 14 || parsed === 16 || parsed === 18) {
    return parsed;
  }
  if (!Number.isFinite(parsed)) {
    return 16;
  }

  return Math.max(1, Math.min(52, Math.floor(parsed)));
}

function sanitizeNotifyBefore(value: unknown): NotifyBeforeDays {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 3 || parsed === 7) {
    return parsed;
  }
  return 3;
}

function addDaysToDateOnly(value: string, days: number) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function calculateEndDateFromWeeks(startDate: string, weeks: number) {
  if (!startDate) return "";
  return addDaysToDateOnly(startDate, sanitizeWeeks(weeks) * 7 - 1);
}

function compareDateOnly(left: string, right: string) {
  const leftDate = sanitizeDateOnly(left);
  const rightDate = sanitizeDateOnly(right);
  if (!leftDate || !rightDate) return 0;
  return leftDate.localeCompare(rightDate);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toISOString().slice(0, 10);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function getTermStatus(row: Pick<ScheduleRow, "startDate" | "endDate">, today: string): TermScheduleStatus {
  if (row.endDate && compareDateOnly(row.endDate, today) < 0) {
    return "PAST";
  }

  if (
    row.startDate &&
    row.endDate &&
    compareDateOnly(row.startDate, today) <= 0 &&
    compareDateOnly(row.endDate, today) >= 0
  ) {
    return "CURRENT";
  }

  return "FUTURE";
}

function normalizePolicies(input: Partial<TermPoliciesView> | undefined): TermPoliciesView {
  return {
    autoJump: input?.autoJump !== false,
    lockPastTerms: input?.lockPastTerms !== false,
    defaultWeeksPerTerm: sanitizeWeeks(input?.defaultWeeksPerTerm ?? 16),
    defaultNotifyBeforeDays: sanitizeNotifyBefore(input?.defaultNotifyBeforeDays ?? 3),
    autoGenerateFutureTerms: input?.autoGenerateFutureTerms !== false,
  };
}

function normalizeSchedules(
  schedules: ScheduleApiRow[] | undefined,
  policies: TermPoliciesView
): ScheduleRow[] {
  const byTerm = new Map<TermCode, ScheduleApiRow>();

  (Array.isArray(schedules) ? schedules : []).forEach((row) => {
    const termCode = sanitizeTermCode(row.termCode);
    byTerm.set(termCode, row);
  });

  return TERM_SEQUENCE.map((termCode, index) => {
    const row = byTerm.get(termCode);
    const startDate = sanitizeDateOnly(row?.startDate);
    const weeks = sanitizeWeeks(row?.weeks ?? policies.defaultWeeksPerTerm);
    const endDate = startDate
      ? calculateEndDateFromWeeks(startDate, weeks)
      : sanitizeDateOnly(row?.endDate);
    const notifyBeforeDays = sanitizeNotifyBefore(
      row?.notifyBeforeDays ?? policies.defaultNotifyBeforeDays
    );
    const manuallyEdited =
      row?.manuallyEdited === true || row?.isManuallyCustomized === true;

    if (!row && index <= 1) {
      return {
        termCode,
        startDate: "",
        endDate: "",
        weeks: policies.defaultWeeksPerTerm,
        notifyBeforeDays: policies.defaultNotifyBeforeDays,
        manuallyEdited: false,
      };
    }

    return {
      termCode,
      startDate,
      endDate,
      weeks,
      notifyBeforeDays,
      manuallyEdited,
    };
  });
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

  return payload as T;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
  detail: string;
  tone: SummaryTone;
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
        <span className="admin-stat-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-current">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-4 text-xs text-text/60">{detail}</p>
    </Card>
  );
}

export default function AcademicTermsPage() {
  const { scope, setActiveWindow } = useAdminContext();
  const { toast } = useToast();

  const [intakeId, setIntakeId] = useState("");
  const [currentTerm, setCurrentTerm] = useState<TermCode>("Y1S1");
  const [policies, setPolicies] = useState<TermPoliciesView>(DEFAULT_POLICIES);
  const [schedules, setSchedules] = useState<ScheduleRow[]>(
    normalizeSchedules(undefined, DEFAULT_POLICIES)
  );

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);
  const [isSavingTerm, setIsSavingTerm] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);
  const [editingDraft, setEditingDraft] = useState<EditTermDraft | null>(null);
  const [isRecalculateConfirmOpen, setIsRecalculateConfirmOpen] = useState(false);
  const [overwriteManuallyEditedFuture, setOverwriteManuallyEditedFuture] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isOverlayOpen = Boolean(editingDraft || isRecalculateConfirmOpen);

  const viewRows = useMemo<TermScheduleRowView[]>(() => {
    return schedules.map((row) => {
      const status = getTermStatus(row, today);
      return {
        ...row,
        status,
        locked: policies.lockPastTerms && status === "PAST",
      };
    });
  }, [policies.lockPastTerms, schedules, today]);

  const totalItems = viewRows.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginatedRows = viewRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const contentBlurClass = isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : "";

  const currentTermRow = useMemo(() => {
    return viewRows.find((row) => row.termCode === currentTerm) ?? null;
  }, [currentTerm, viewRows]);

  const headerStatus = useMemo(() => {
    if (!currentTermRow || !currentTermRow.startDate) {
      return { label: "Planned", variant: "neutral" as const };
    }

    if (currentTermRow.status === "CURRENT") {
      return { label: "Active", variant: "success" as const };
    }

    if (currentTermRow.status === "PAST") {
      return { label: "Completed", variant: "neutral" as const };
    }

    return { label: "Planned", variant: "primary" as const };
  }, [currentTermRow]);
  const lockedTermsCount = useMemo(
    () => viewRows.filter((row) => row.locked).length,
    [viewRows]
  );
  const manuallyEditedCount = useMemo(
    () => schedules.filter((row) => row.manuallyEdited).length,
    [schedules]
  );
  const currentTermRange = currentTermRow?.startDate
    ? `${formatDate(currentTermRow.startDate)} to ${formatDate(currentTermRow.endDate)}`
    : "Start and end dates are not set yet";
  const latestConfiguredDate = useMemo(
    () =>
      schedules.reduce<string | null>((latest, row) => {
        if (!row.endDate) {
          return latest;
        }

        if (!latest || row.endDate.localeCompare(latest) > 0) {
          return row.endDate;
        }

        return latest;
      }, null),
    [schedules]
  );
  const summaryCards: Array<{
    label: string;
    value: string;
    detail: string;
    tone: SummaryTone;
    icon: ComponentType<{ size?: number }>;
  }> = [
    {
      label: "Current Term",
      value: currentTerm,
      detail: currentTermRange,
      tone: "violet",
      icon: CalendarRange,
    },
    {
      label: "Schedule Status",
      value: headerStatus.label,
      detail:
        currentTermRow?.endDate
          ? `Current cycle tracked through ${formatShortDate(currentTermRow.endDate)}`
          : "The current term schedule is still being planned",
      tone: "green",
      icon: CheckCircle2,
    },
    {
      label: "Locked Terms",
      value: lockedTermsCount.toLocaleString(),
      detail:
        lockedTermsCount > 0
          ? `${lockedTermsCount.toLocaleString()} past terms are read-only`
          : "No past terms are locked yet",
      tone: "amber",
      icon: LockKeyhole,
    },
    {
      label: "Custom Terms",
      value: manuallyEditedCount.toLocaleString(),
      detail:
        manuallyEditedCount > 0
          ? `${manuallyEditedCount.toLocaleString()} rows have manual schedule changes`
          : "No term rows have been manually adjusted",
      tone: "sky",
      icon: Pencil,
    },
  ];

  const reloadTerms = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const intakeResponse = await fetch(
        `/api/intakes?faculty=${encodeURIComponent(scope.faculty)}&degree=${encodeURIComponent(scope.degree)}&search=${encodeURIComponent(scope.intake)}&page=1&pageSize=100&sort=updated`,
        { cache: "no-store" }
      );
      const intakePayload = await readJson<IntakeLookupResponse>(intakeResponse);
      const items = Array.isArray(intakePayload.items) ? intakePayload.items : [];

      const normalizedIntake = collapseSpaces(scope.intake).toLowerCase();
      const match =
        items.find((item) => {
          const sameName = collapseSpaces(String(item.name ?? "")).toLowerCase() === normalizedIntake;
          const sameFaculty = String(item.facultyCode ?? "").toUpperCase() === scope.faculty;
          const sameDegree = String(item.degreeCode ?? "").toUpperCase() === scope.degree;
          return sameName && sameFaculty && sameDegree;
        }) ?? items[0];

      if (!match?.id) {
        throw new Error("Failed to load");
      }

      const termsResponse = await fetch(
        `/api/intakes/${encodeURIComponent(match.id)}/terms`,
        { cache: "no-store" }
      );
      const terms = await readJson<TermsApiResponse>(termsResponse);
      const nextPolicies = normalizePolicies(terms.policies);
      const nextSchedules = normalizeSchedules(terms.schedules, nextPolicies);

      setIntakeId(String(terms.intakeId ?? match.id));
      setCurrentTerm(sanitizeTermCode(terms.currentTerm));
      setPolicies(nextPolicies);
      setSchedules(nextSchedules);
      setPage(1);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [scope.degree, scope.faculty, scope.intake]);

  useEffect(() => {
    void reloadTerms();
  }, [reloadTerms]);

  useEffect(() => {
    setActiveWindow(editingDraft ? "Edit Term" : "Academic Terms");
  }, [editingDraft, setActiveWindow]);

  useEffect(() => {
    return () => {
      setActiveWindow(null);
    };
  }, [setActiveWindow]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOverlayOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (editingDraft && !isSavingTerm) {
        setEditingDraft(null);
        return;
      }

      if (isRecalculateConfirmOpen && !isRecalculating) {
        setIsRecalculateConfirmOpen(false);
      }
    };

    if (!isOverlayOpen) {
      return;
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingDraft, isOverlayOpen, isRecalculateConfirmOpen, isRecalculating, isSavingTerm]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const saveTerms = useCallback(
    async (
      nextSchedules: ScheduleRow[],
      nextPolicies: TermPoliciesView,
      options: { successTitle: string; successMessage: string }
    ) => {
      if (!intakeId) {
        throw new Error("Failed to load");
      }

      const response = await fetch(`/api/intakes/${encodeURIComponent(intakeId)}/terms`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentTerm,
          policies: {
            autoJump: nextPolicies.autoJump,
            lockPastTerms: nextPolicies.lockPastTerms,
            defaultWeeksPerTerm: nextPolicies.defaultWeeksPerTerm,
            defaultNotifyBeforeDays: nextPolicies.defaultNotifyBeforeDays,
            autoGenerateFutureTerms: nextPolicies.autoGenerateFutureTerms,
          },
          schedules: nextSchedules.map((row) => ({
            termCode: row.termCode,
            startDate: row.startDate,
            endDate: row.endDate,
            weeks: row.weeks,
            notifyBeforeDays: row.notifyBeforeDays,
            manuallyEdited: row.manuallyEdited,
          })),
        }),
      });

      const terms = await readJson<TermsApiResponse>(response);
      const normalizedPolicies = normalizePolicies(terms.policies);
      const normalizedSchedules = normalizeSchedules(terms.schedules, normalizedPolicies);

      setPolicies(normalizedPolicies);
      setSchedules(normalizedSchedules);
      setCurrentTerm(sanitizeTermCode(terms.currentTerm));

      toast({
        title: options.successTitle,
        message: options.successMessage,
        variant: "success",
      });
    },
    [currentTerm, intakeId, toast]
  );

  const onSavePolicies = async () => {
    setIsSavingPolicies(true);
    try {
      await saveTerms(schedules, policies, {
        successTitle: "Saved",
        successMessage: "Term policies updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to save policies",
        variant: "error",
      });
    } finally {
      setIsSavingPolicies(false);
    }
  };

  const onEditRow = (row: TermScheduleRowView) => {
    setEditingDraft({
      termCode: row.termCode,
      startDate: row.startDate,
      endDate: row.endDate,
      weeks: row.weeks,
      notifyBeforeDays: row.notifyBeforeDays,
      status: row.status,
      locked: row.locked,
    });
  };

  const onDraftChange = (next: EditTermDraft) => {
    const termCode = sanitizeTermCode(next.termCode);
    const startDate = sanitizeDateOnly(next.startDate);
    const weeks = sanitizeWeeks(next.weeks);
    const endDate = startDate ? calculateEndDateFromWeeks(startDate, weeks) : "";
    const notifyBeforeDays = sanitizeNotifyBefore(next.notifyBeforeDays) as EditNotifyBeforeDays;
    const status = getTermStatus({ startDate, endDate }, today);

    setEditingDraft({
      ...next,
      termCode,
      startDate,
      weeks,
      endDate,
      notifyBeforeDays,
      status,
    });
  };

  const onSaveEditedTerm = async () => {
    if (!editingDraft) {
      return;
    }

    if (!editingDraft.startDate) {
      toast({
        title: "Failed",
        message: "Start date is required.",
        variant: "error",
      });
      return;
    }

    const nextSchedules = schedules.map((row) =>
      row.termCode === editingDraft.termCode
        ? {
            ...row,
            startDate: editingDraft.startDate,
            weeks: sanitizeWeeks(editingDraft.weeks),
            endDate: calculateEndDateFromWeeks(editingDraft.startDate, editingDraft.weeks),
            notifyBeforeDays: sanitizeNotifyBefore(editingDraft.notifyBeforeDays),
            manuallyEdited: true,
          }
        : row
    );

    setIsSavingTerm(true);
    try {
      await saveTerms(nextSchedules, policies, {
        successTitle: "Saved",
        successMessage: `${editingDraft.termCode} updated successfully.`,
      });
      setEditingDraft(null);
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to save term",
        variant: "error",
      });
    } finally {
      setIsSavingTerm(false);
    }
  };

  const onConfirmRecalculate = async () => {
    if (!intakeId) {
      toast({ title: "Failed", message: "Failed to load", variant: "error" });
      return;
    }

    setIsRecalculating(true);
    try {
      const response = await fetch(
        `/api/intakes/${encodeURIComponent(intakeId)}/terms/recalculate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            overwriteManuallyEditedFuture,
          }),
        }
      );
      const terms = await readJson<TermsApiResponse>(response);
      const normalizedPolicies = normalizePolicies(terms.policies);
      const normalizedSchedules = normalizeSchedules(terms.schedules, normalizedPolicies);

      setPolicies(normalizedPolicies);
      setSchedules(normalizedSchedules);
      setCurrentTerm(sanitizeTermCode(terms.currentTerm));
      setIsRecalculateConfirmOpen(false);
      setOverwriteManuallyEditedFuture(false);
      toast({
        title: "Updated",
        message: "Future terms recalculated successfully.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to recalculate future terms",
        variant: "error",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <div className={cn("flex flex-wrap justify-end gap-2", contentBlurClass)}>
        <Badge variant="neutral">Current Term: {currentTerm}</Badge>
        <Badge variant={headerStatus.variant}>{headerStatus.label}</Badge>
      </div>

      <section
        className={cn(
          "grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]",
          contentBlurClass
        )}
      >
        <Card accent className="p-6 lg:p-7">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="neutral">Academic Structure</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                  Academic term calendar
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  Review and maintain term schedules, teaching weeks, notification timing,
                  and audit-safe calendar policies for the selected intake.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">Faculty {scope.faculty || "-"}</Badge>
                  <Badge variant="neutral">Degree {scope.degree || "-"}</Badge>
                  <Badge variant="neutral">Intake {scope.intake || "-"}</Badge>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[210px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Visible Terms
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                    {totalItems.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    {latestConfiguredDate
                      ? `Calendar configured through ${formatShortDate(latestConfiguredDate)}`
                      : "Complete term sequence for the selected intake"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-border bg-white/72 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,41,0.04)]">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                  Current Range
                </p>
                <p className="mt-2 text-sm font-medium text-heading">{currentTermRange}</p>
              </div>
              <div className="rounded-[22px] border border-border bg-white/72 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,41,0.04)]">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                  Automation
                </p>
                <p className="mt-2 text-sm font-medium text-heading">
                  {policies.autoJump ? "Auto jump enabled" : "Auto jump disabled"}
                </p>
              </div>
              <div className="rounded-[22px] border border-border bg-white/72 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,41,0.04)]">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                  Future Generation
                </p>
                <p className="mt-2 text-sm font-medium text-heading">
                  {policies.autoGenerateFutureTerms
                    ? "Future terms generate automatically"
                    : "Future terms require manual updates"}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {summaryCards.map((item) => (
            <SummaryCard
              detail={item.detail}
              icon={item.icon}
              key={item.label}
              label={item.label}
              tone={item.tone}
              value={item.value}
            />
          ))}
        </div>
      </section>

      <section
        className={cn(
          "grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]",
          contentBlurClass
        )}
      >
        <TermScheduleTable
          isLoading={isLoading}
          isSaving={isSavingPolicies || isSavingTerm || isRecalculating}
          loadError={loadError}
          onEditRow={onEditRow}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value as PageSize);
            setPage(1);
          }}
          onRetry={() => {
            void reloadTerms();
          }}
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          rows={paginatedRows}
          totalItems={totalItems}
        />

        <TermPolicyPanel
          isDisabled={
            isLoading ||
            Boolean(loadError) ||
            !intakeId ||
            isSavingPolicies ||
            isSavingTerm
          }
          isRecalculating={isRecalculating}
          isSaving={isSavingPolicies}
          onOpenRecalculate={() => setIsRecalculateConfirmOpen(true)}
          onPolicyChange={setPolicies}
          onSave={() => {
            void onSavePolicies();
          }}
          policies={policies}
        />
      </section>

      <EditTermModal
        draft={editingDraft}
        isSaving={isSavingTerm}
        onClose={() => setEditingDraft(null)}
        onDraftChange={onDraftChange}
        onSave={() => {
          void onSaveEditedTerm();
        }}
      />

      {isRecalculateConfirmOpen ? (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isRecalculating) {
              setIsRecalculateConfirmOpen(false);
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-xl overflow-hidden rounded-[30px] border border-border bg-[rgba(255,255,255,0.95)] shadow-[0_28px_72px_rgba(15,23,42,0.24)]"
            role="dialog"
          >
            <div className="px-6 py-6 sm:px-7">
              <Badge variant="warning">Recalculate Terms</Badge>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                Recalculate future terms?
              </p>
              <p className="mt-2 text-sm leading-6 text-text/68">
                Recalculate future term dates? Past terms will not change. Manually edited
                future terms will not be overwritten unless you confirm overwrite.
              </p>

              <label className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border bg-white/72 px-4 py-3 text-sm font-medium text-heading shadow-[0_10px_24px_rgba(15,23,41,0.04)]">
                <input
                  checked={overwriteManuallyEditedFuture}
                  className="h-4 w-4 rounded border-border"
                  disabled={isRecalculating}
                  onChange={(event) =>
                    setOverwriteManuallyEditedFuture(event.target.checked)
                  }
                  type="checkbox"
                />
                Overwrite manually edited future terms
              </label>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border bg-[rgba(255,255,255,0.9)] px-6 py-4 backdrop-blur-sm">
              <Button
                className="h-11 min-w-[112px] px-5"
                disabled={isRecalculating}
                onClick={() => setIsRecalculateConfirmOpen(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[172px] gap-2 px-5"
                disabled={isRecalculating}
                onClick={() => {
                  void onConfirmRecalculate();
                }}
              >
                {isRecalculating ? (
                  <>
                    <Loader2 className="animate-spin" size={15} />
                    Recalculating...
                  </>
                ) : (
                  <>
                    <RefreshCcw size={15} />
                    Recalculate Terms
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
