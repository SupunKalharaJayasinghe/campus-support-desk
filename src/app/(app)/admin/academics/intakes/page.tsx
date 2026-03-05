"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import PageHeader from "@/components/admin/PageHeader";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";

type IntakeStatus = "ACTIVE" | "INACTIVE" | "DRAFT";
type IntakeSort = "updated" | "created" | "az" | "za";
type PageSize = 10 | 25 | 50 | 100;
type TermCode =
  | "Y1S1"
  | "Y1S2"
  | "Y2S1"
  | "Y2S2"
  | "Y3S1"
  | "Y3S2"
  | "Y4S1"
  | "Y4S2";
type NotifyBeforeDays = 1 | 3 | 7;
type TermScheduleStatus = "PAST" | "CURRENT" | "FUTURE";

interface IntakeTermScheduleRecord {
  termCode: TermCode;
  startDate: string;
  endDate: string;
  weeks: number;
  notifyBeforeDays: NotifyBeforeDays;
  isManuallyCustomized: boolean;
  notificationSentAt: string;
}

interface IntakeScheduleApiRecord {
  termCode?: string;
  startDate?: string;
  endDate?: string;
  weeks?: number;
  notifyBeforeDays?: number;
  isManuallyCustomized?: boolean;
  manuallyEdited?: boolean;
  notificationSentAt?: string;
}

interface IntakeRecord {
  id: string;
  name: string;
  facultyCode: string;
  degreeCode: string;
  intakeYear: number;
  intakeMonth: string;
  stream?: string;
  status: IntakeStatus;
  currentTerm: TermCode;
  autoJumpEnabled: boolean;
  termSchedules: IntakeTermScheduleRecord[];
  createdAt: string;
  updatedAt: string;
}

interface IntakeApiRecord {
  id?: string;
  name?: string;
  stream?: string;
  facultyCode?: string;
  degreeCode?: string;
  intakeYear?: number;
  intakeMonth?: string;
  status?: string;
  currentTerm?: string;
  autoJumpEnabled?: boolean;
  schedules?: IntakeScheduleApiRecord[];
  termSchedules?: IntakeScheduleApiRecord[];
  createdAt?: string;
  updatedAt?: string;
}

interface FacultyOption {
  code: string;
  name: string;
}

interface DegreeOption {
  code: string;
  name: string;
  facultyCode: string;
}

interface ModuleOption {
  id: string;
  code: string;
  name: string;
  syllabusVersion: "OLD" | "NEW";
  updatedAt: string;
}

interface AutoModuleSelection extends ModuleOption {
  selected: boolean;
}

interface IntakeModalState {
  mode: "add" | "edit";
  targetId?: string;
}

interface IntakeFormState {
  intakeName: string;
  facultyCode: string;
  degreeCode: string;
  status: IntakeStatus;
  autoJumpEnabled: boolean;
  autoGenerateFutureTerms: boolean;
  termSchedules: IntakeTermScheduleRecord[];
}

interface IntakeFormErrors {
  intakeName?: string;
  facultyCode?: string;
  degreeCode?: string;
  schedule?: string;
  moduleSync?: string;
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

const NOTIFY_OPTIONS: Array<{ label: string; value: NotifyBeforeDays }> = [
  { label: "1 day", value: 1 },
  { label: "3 days", value: 3 },
  { label: "7 days", value: 7 },
];

const DEFAULT_TERM_WEEKS = 16;

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
}

function collapseSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseIntakeName(value: string) {
  const normalized = collapseSpaces(value);
  const match = normalized.match(/(\d{4})\s+([A-Za-z]+)/);
  if (!match) {
    return {
      name: normalized,
      intakeYear: 0,
      intakeMonth: "",
    };
  }

  const intakeYear = Number(match[1]);
  const monthPart = String(match[2] ?? "").toLowerCase();
  const month = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ].find((item) => item.toLowerCase().startsWith(monthPart));

  return {
    name: normalized,
    intakeYear: Number.isFinite(intakeYear) ? intakeYear : 0,
    intakeMonth: month ?? "",
  };
}

function sanitizeStatus(value: unknown): IntakeStatus {
  if (value === "INACTIVE") return "INACTIVE";
  if (value === "DRAFT") return "DRAFT";
  return "ACTIVE";
}

function sanitizeTermCode(value: unknown): TermCode {
  const termCode = String(value ?? "").toUpperCase();
  return TERM_SEQUENCE.find((term) => term === termCode) ?? "Y1S1";
}

function sanitizeNotifyBeforeDays(value: unknown): NotifyBeforeDays {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 3 || parsed === 7) {
    return parsed;
  }

  return 3;
}

function parseDateOnly(value: string) {
  if (!value) return null;
  const parsed = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function compareDateOnly(left: string, right: string) {
  const leftDate = parseDateOnly(left);
  const rightDate = parseDateOnly(right);
  if (!leftDate || !rightDate) return 0;
  return leftDate.getTime() - rightDate.getTime();
}

function addMonthsToDateOnly(value: string, months: number) {
  const date = parseDateOnly(value);
  if (!date) return "";
  date.setUTCMonth(date.getUTCMonth() + months);
  return formatDateOnly(date);
}

function addDaysToDateOnly(value: string, days: number) {
  const date = parseDateOnly(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

function sanitizeWeeksCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TERM_WEEKS;
  }

  return Math.max(1, Math.min(52, Math.floor(parsed)));
}

function calculateEndDateFromWeeks(startDate: string, weeks: number) {
  if (!startDate) return "";
  return addDaysToDateOnly(startDate, sanitizeWeeksCount(weeks) * 7 - 1);
}

function sanitizeDateValue(value: unknown) {
  if (typeof value !== "string") return "";
  const parsed = parseDateOnly(value);
  if (!parsed) return "";
  return formatDateOnly(parsed);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "\u2014";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "\u2014";
  return parsed.toISOString().slice(0, 10);
}

function intakeLabel(
  intake: Pick<IntakeRecord, "name" | "intakeYear" | "intakeMonth">
) {
  if (intake.name) return intake.name;
  return `${intake.intakeYear} ${intake.intakeMonth}`;
}

function statusVariant(status: IntakeStatus) {
  if (status === "ACTIVE") return "success";
  if (status === "DRAFT") return "warning";
  return "neutral";
}

function statusLabel(status: IntakeStatus) {
  if (status === "ACTIVE") return "Active";
  if (status === "DRAFT") return "Draft";
  return "Inactive";
}

function getTermScheduleStatus(
  schedule: Pick<IntakeTermScheduleRecord, "startDate" | "endDate">,
  today: string
): TermScheduleStatus {
  if (schedule.endDate && compareDateOnly(schedule.endDate, today) < 0) {
    return "PAST";
  }

  if (
    schedule.startDate &&
    schedule.endDate &&
    compareDateOnly(schedule.startDate, today) <= 0 &&
    compareDateOnly(schedule.endDate, today) >= 0
  ) {
    return "CURRENT";
  }

  return "FUTURE";
}

function termStatusVariant(status: TermScheduleStatus) {
  if (status === "CURRENT") return "success";
  if (status === "PAST") return "neutral";
  return "primary";
}

function termStatusLabel(status: TermScheduleStatus) {
  if (status === "CURRENT") return "Current";
  if (status === "PAST") return "Past";
  return "Future";
}

function emptyScheduleRow(termCode: TermCode): IntakeTermScheduleRecord {
  return {
    termCode,
    startDate: "",
    endDate: "",
    weeks: DEFAULT_TERM_WEEKS,
    notifyBeforeDays: 3,
    isManuallyCustomized: false,
    notificationSentAt: "",
  };
}

function normalizeSchedules(
  schedules: IntakeScheduleApiRecord[] | IntakeTermScheduleRecord[] | undefined
): IntakeTermScheduleRecord[] {
  const byCode = new Map<TermCode, IntakeScheduleApiRecord | IntakeTermScheduleRecord>();

  (schedules ?? []).forEach((row) => {
    const termCode = sanitizeTermCode(row.termCode);
    byCode.set(termCode, row);
  });

  return TERM_SEQUENCE.map((termCode) => {
    const row = byCode.get(termCode);
    const weeks = sanitizeWeeksCount(row?.weeks);
    const startDate = sanitizeDateValue(row?.startDate);
    return {
      termCode,
      startDate,
      endDate: startDate
        ? calculateEndDateFromWeeks(startDate, weeks)
        : sanitizeDateValue(row?.endDate),
      weeks,
      notifyBeforeDays: sanitizeNotifyBeforeDays(row?.notifyBeforeDays),
      isManuallyCustomized:
        row?.isManuallyCustomized === true ||
        (row as IntakeScheduleApiRecord | undefined)?.manuallyEdited === true,
      notificationSentAt:
        typeof row?.notificationSentAt === "string" ? row.notificationSentAt : "",
    };
  });
}

function resolveScheduleRows(intake: IntakeApiRecord | IntakeRecord) {
  if (Array.isArray((intake as IntakeApiRecord).termSchedules)) {
    return (intake as IntakeApiRecord).termSchedules;
  }

  if (Array.isArray((intake as IntakeApiRecord).schedules)) {
    return (intake as IntakeApiRecord).schedules;
  }

  if (Array.isArray((intake as IntakeRecord).termSchedules)) {
    return (intake as IntakeRecord).termSchedules;
  }

  return [];
}

function normalizeIntakeRecord(input: IntakeApiRecord): IntakeRecord {
  const intakeYear = Number(input.intakeYear);
  const intakeMonth =
    typeof input.intakeMonth === "string" && input.intakeMonth.trim()
      ? input.intakeMonth
      : "January";
  const intakeName =
    typeof input.name === "string" && input.name.trim()
      ? collapseSpaces(input.name)
      : `${Number.isFinite(intakeYear) ? Math.floor(intakeYear) : new Date().getUTCFullYear()} ${intakeMonth}`;

  return {
    id: String(input.id ?? ""),
    name: intakeName,
    facultyCode: normalizeCode(String(input.facultyCode ?? "")),
    degreeCode: normalizeCode(String(input.degreeCode ?? "")),
    intakeYear: Number.isFinite(intakeYear)
      ? Math.max(2000, Math.min(2100, Math.floor(intakeYear)))
      : new Date().getUTCFullYear(),
    intakeMonth,
    stream:
      typeof input.stream === "string" && input.stream.trim()
        ? input.stream.trim()
        : undefined,
    status: sanitizeStatus(input.status),
    currentTerm: sanitizeTermCode(input.currentTerm),
    autoJumpEnabled: input.autoJumpEnabled !== false,
    termSchedules: normalizeSchedules(resolveScheduleRows(input)),
    createdAt: typeof input.createdAt === "string" ? input.createdAt : "",
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : "",
  };
}

function autoGenerateFutureSchedules(
  schedules: IntakeTermScheduleRecord[],
  options: {
    today: string;
    force?: boolean;
  }
): IntakeTermScheduleRecord[] {
  const baseline = schedules[0];
  if (!baseline?.startDate) {
    return schedules;
  }

  const force = options.force === true;
  const baselineWeeks = sanitizeWeeksCount(baseline.weeks);

  return schedules.map((schedule, index) => {
    if (index === 0) {
      if (!schedule.startDate || getTermScheduleStatus(schedule, options.today) === "PAST") {
        return schedule;
      }

      return {
        ...schedule,
        weeks: baselineWeeks,
        endDate: calculateEndDateFromWeeks(schedule.startDate, baselineWeeks),
      };
    }

    if (getTermScheduleStatus(schedule, options.today) !== "FUTURE") {
      return schedule;
    }

    if (!force && schedule.isManuallyCustomized) {
      return schedule;
    }

    const nextStart = addMonthsToDateOnly(baseline.startDate, index * 6);
    const nextWeeks = sanitizeWeeksCount(schedule.weeks || baselineWeeks);

    return {
      ...schedule,
      startDate: nextStart || schedule.startDate,
      weeks: nextWeeks,
      endDate: nextStart
        ? calculateEndDateFromWeeks(nextStart, nextWeeks)
        : schedule.endDate,
      isManuallyCustomized: false,
      notificationSentAt: "",
    };
  });
}

function getNextTermStartDate(intake: IntakeRecord) {
  const currentIndex = TERM_SEQUENCE.findIndex((term) => term === intake.currentTerm);
  if (currentIndex < 0 || currentIndex >= TERM_SEQUENCE.length - 1) {
    return "";
  }

  const nextTerm = TERM_SEQUENCE[currentIndex + 1];
  const schedules = Array.isArray(intake.termSchedules) ? intake.termSchedules : [];
  const row = schedules.find((schedule) => schedule.termCode === nextTerm);
  return row?.startDate ?? "";
}

function emptyFormState(): IntakeFormState {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return {
    intakeName: `${year} ${month}`,
    facultyCode: "",
    degreeCode: "",
    status: "ACTIVE",
    autoJumpEnabled: true,
    autoGenerateFutureTerms: true,
    termSchedules: TERM_SEQUENCE.map((termCode) => emptyScheduleRow(termCode)),
  };
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

  return (payload ?? ({} as T)) as T;
}

export default function IntakesPage() {
  const { setActiveWindow } = useAdminContext();
  const { toast } = useToast();

  const [items, setItems] = useState<IntakeRecord[]>([]);
  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<"" | IntakeStatus>("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [degreeFilter, setDegreeFilter] = useState("");
  const [sortBy, setSortBy] = useState<IntakeSort>("updated");
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [modal, setModal] = useState<IntakeModalState | null>(null);
  const [form, setForm] = useState<IntakeFormState>(emptyFormState);
  const [errors, setErrors] = useState<IntakeFormErrors>({});
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [didRequestRecalculate, setDidRequestRecalculate] = useState(false);
  const [autoModules, setAutoModules] = useState<AutoModuleSelection[]>([]);
  const [isLoadingAutoModules, setIsLoadingAutoModules] = useState(false);
  const [autoModuleSearch, setAutoModuleSearch] = useState("");
  const [selectedModuleTerm, setSelectedModuleTerm] = useState<TermCode>("Y1S1");
  const [moduleSyncWarning, setModuleSyncWarning] = useState("");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount);
  const isOverlayOpen = Boolean(modal || deleteTargetId);
  const deleteTarget =
    deleteTargetId === null
      ? null
      : items.find((item) => item.id === deleteTargetId) ?? null;

  const filteredDegreeOptions = useMemo(() => {
    if (!form.facultyCode) return degrees;
    return degrees.filter((degree) => degree.facultyCode === form.facultyCode);
  }, [degrees, form.facultyCode]);

  const filteredAutoModules = useMemo(() => {
    const query = autoModuleSearch.trim().toLowerCase();
    if (!query) {
      return autoModules;
    }

    return autoModules.filter((item) =>
      `${item.code} ${item.name}`.toLowerCase().includes(query)
    );
  }, [autoModuleSearch, autoModules]);

  const closeModal = useCallback(() => {
    setModal(null);
    setForm(emptyFormState());
    setErrors({});
    setShowAllTerms(false);
    setDidRequestRecalculate(false);
    setSelectedModuleTerm("Y1S1");
    setAutoModules([]);
    setAutoModuleSearch("");
    setModuleSyncWarning("");
  }, []);

  const loadReferenceData = useCallback(async () => {
    try {
      const [facultyResponse, degreeResponse] = await Promise.all([
        fetch("/api/faculties", { cache: "no-store" }),
        fetch("/api/degree-programs?page=1&pageSize=100&sort=az", {
          cache: "no-store",
        }),
      ]);

      const [facultyPayload, degreePayload] = await Promise.all([
        readJson<unknown>(facultyResponse),
        readJson<unknown>(degreeResponse),
      ]);

      const parsedFaculties = Array.isArray(facultyPayload)
        ? facultyPayload
            .filter((item): item is FacultyOption => Boolean(item && typeof item === "object"))
            .map((item) => ({
              code: normalizeCode(String(item.code ?? "")),
              name: String(item.name ?? ""),
            }))
            .filter((item) => Boolean(item.code))
        : [];

      const degreePayloadObject = asObject(degreePayload);
      const rawDegreeItems = Array.isArray(degreePayloadObject?.items)
        ? degreePayloadObject.items
        : [];
      const parsedDegrees = rawDegreeItems
        .filter((item): item is DegreeOption => Boolean(item && typeof item === "object"))
        .map((item) => ({
          code: normalizeCode(String(item.code ?? "")),
          name: String(item.name ?? ""),
          facultyCode: normalizeCode(String(item.facultyCode ?? "")),
        }))
        .filter((item) => Boolean(item.code && item.facultyCode));

      setFaculties(parsedFaculties);
      setDegrees(parsedDegrees);
    } catch {
      setFaculties([]);
      setDegrees([]);
    }
  }, []);

  const loadIntakes = useCallback(
    async (options?: { background?: boolean; silent?: boolean }) => {
      if (!options?.background) {
        setIsLoading(true);
        setLoadError(null);
      }

      try {
        const params = new URLSearchParams();
        if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
        if (statusFilter) params.set("status", statusFilter);
        if (facultyFilter) params.set("faculty", facultyFilter);
        if (degreeFilter) params.set("degree", degreeFilter);
        params.set("sort", sortBy);
        params.set("page", String(safePage));
        params.set("pageSize", String(pageSize));

        const response = await fetch(`/api/intakes?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = await readJson<unknown>(response);
        const payloadObject = asObject(payload);
        const rawItems = Array.isArray(payload)
          ? payload
          : Array.isArray(payloadObject?.items)
            ? payloadObject.items
            : [];

        const normalizedItems = rawItems
          .filter((item): item is IntakeApiRecord => Boolean(item && typeof item === "object"))
          .map((item) => normalizeIntakeRecord(item));

        const parsedTotal = Number(
          payloadObject?.total ?? payloadObject?.totalCount ?? normalizedItems.length
        );
        const parsedPage = Number(payloadObject?.page);

        setItems(normalizedItems);
        setTotalCount(Number.isFinite(parsedTotal) ? parsedTotal : 0);
        setLoadError(null);
        if (Number.isFinite(parsedPage) && parsedPage > 0 && parsedPage !== safePage) {
          setPage(parsedPage);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load intakes";

        if (!options?.silent) {
          toast({
            title: "Failed",
            message: errorMessage,
            variant: "error",
          });
        }

        setLoadError(errorMessage);
        setItems([]);
        setTotalCount(0);
      } finally {
        if (!options?.background) {
          setIsLoading(false);
        }
      }
    },
    [deferredSearch, degreeFilter, facultyFilter, pageSize, safePage, sortBy, statusFilter, toast]
  );

  const loadApplicableModules = useCallback(
    async (
      facultyCode: string,
      degreeCode: string,
      termCode: TermCode,
      options?: { mode?: "add" | "edit"; intakeId?: string }
    ) => {
      if (!facultyCode || !degreeCode) {
        setAutoModules([]);
        setModuleSyncWarning("");
        return;
      }

      setIsLoadingAutoModules(true);
      try {
        const params = new URLSearchParams();
        params.set("facultyCode", facultyCode);
        params.set("degreeId", degreeCode);
        params.set("term", termCode);

        const responses: [Response, Response?] =
          options?.mode === "edit" && options.intakeId
            ? await Promise.all([
                fetch(`/api/modules/applicable?${params.toString()}`, {
                  cache: "no-store",
                }),
                fetch(
                  `/api/module-offerings?${new URLSearchParams({
                    intakeId: options.intakeId,
                    termCode,
                    page: "1",
                    pageSize: "100",
                  }).toString()}`,
                  { cache: "no-store" }
                ),
              ])
            : [await fetch(`/api/modules/applicable?${params.toString()}`, { cache: "no-store" })];

        const [modulePayload, offeringPayload] = await Promise.all([
          readJson<unknown>(responses[0]),
          responses[1] ? readJson<unknown>(responses[1]) : Promise.resolve(null),
        ]);
        const modulePayloadObject = asObject(modulePayload);
        const rawItems = Array.isArray(modulePayloadObject?.items)
          ? modulePayloadObject.items
          : [];

        const parsedModules = rawItems
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item && typeof item === "object")
          )
          .map(
            (item): ModuleOption => ({
              id: String(item.id ?? ""),
              code: String(item.code ?? "").toUpperCase(),
              name: String(item.name ?? "").trim(),
              syllabusVersion: item.defaultSyllabusVersion === "OLD" ? "OLD" : "NEW",
              updatedAt: String(item.updatedAt ?? ""),
            })
          )
          .filter((item) => Boolean(item.id && item.code && item.name));

        const offeringIds = new Set<string>();
        if (offeringPayload && typeof offeringPayload === "object") {
          const offeringPayloadObject = asObject(offeringPayload);
          const offeringItems = Array.isArray(offeringPayloadObject?.items)
            ? offeringPayloadObject.items
            : [];
          offeringItems.forEach((item) => {
            if (!item || typeof item !== "object") {
              return;
            }
            const moduleId = String((item as { moduleId?: unknown }).moduleId ?? "").trim();
            if (moduleId) {
              offeringIds.add(moduleId);
            }
          });
        }

        setAutoModules((previous) => {
          const previousSelected = new Map(
            previous.map((item) => [item.id, item.selected])
          );

          return parsedModules.map((item) => ({
            ...item,
            selected:
              options?.mode === "edit" && options.intakeId
                ? offeringIds.size === 0
                  ? true
                  : offeringIds.has(item.id)
                : previousSelected.get(item.id) ?? true,
          }));
        });
      } catch (error) {
        setAutoModules([]);
        toast({
          title: "Failed",
          message: error instanceof Error ? error.message : "Failed to load applicable modules",
          variant: "error",
        });
      } finally {
        setIsLoadingAutoModules(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    void loadIntakes();
  }, [loadIntakes]);

  useEffect(() => {
    if (!modal) {
      setAutoModules([]);
      setModuleSyncWarning("");
      return;
    }

    void loadApplicableModules(form.facultyCode, form.degreeCode, selectedModuleTerm, {
      mode: modal.mode,
      intakeId: modal.mode === "edit" ? modal.targetId : undefined,
    });
  }, [
    form.degreeCode,
    form.facultyCode,
    loadApplicableModules,
    modal,
    selectedModuleTerm,
  ]);

  useEffect(() => {
    if (!isOverlayOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOverlayOpen]);

  useEffect(() => {
    if (!modal) {
      setActiveWindow("List");
      return;
    }

    setActiveWindow(modal.mode === "add" ? "Create" : "Edit");
  }, [modal, setActiveWindow]);

  useEffect(() => {
    return () => {
      setActiveWindow(null);
    };
  }, [setActiveWindow]);

  useEffect(() => {
    if (!isOverlayOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (deleteTargetId && !isDeleting) {
        setDeleteTargetId(null);
        return;
      }

      if (modal && !isSaving) {
        closeModal();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    closeModal,
    deleteTargetId,
    isDeleting,
    isOverlayOpen,
    isSaving,
    modal,
  ]);

  const openAddModal = () => {
    const defaultFaculty = faculties[0]?.code ?? "";
    const defaultDegree =
      degrees.find((degree) => degree.facultyCode === defaultFaculty)?.code ?? "";

    setForm({
      ...emptyFormState(),
      facultyCode: defaultFaculty,
      degreeCode: defaultDegree,
    });
    setErrors({});
    setShowAllTerms(false);
    setDidRequestRecalculate(false);
    setSelectedModuleTerm("Y1S1");
    setAutoModules([]);
    setAutoModuleSearch("");
    setModuleSyncWarning("");
    setModal({ mode: "add" });
  };

  const openEditModal = (intake: IntakeRecord) => {
    setForm({
      intakeName: intake.name || `${intake.intakeYear} ${intake.intakeMonth}`,
      facultyCode: intake.facultyCode,
      degreeCode: intake.degreeCode,
      status: intake.status,
      autoJumpEnabled: intake.autoJumpEnabled,
      autoGenerateFutureTerms: true,
      termSchedules: normalizeSchedules(intake.termSchedules),
    });
    setErrors({});
    setShowAllTerms(false);
    setDidRequestRecalculate(false);
    setSelectedModuleTerm(intake.currentTerm ?? "Y1S1");
    setAutoModules([]);
    setAutoModuleSearch("");
    setModuleSyncWarning("");
    setModal({ mode: "edit", targetId: intake.id });
  };

  const setFacultyCode = (nextFacultyCode: string) => {
    setForm((previous) => {
      const availableDegree =
        degrees.find(
          (degree) =>
            degree.facultyCode === nextFacultyCode && degree.code === previous.degreeCode
        )?.code ??
        degrees.find((degree) => degree.facultyCode === nextFacultyCode)?.code ??
        "";

      return {
        ...previous,
        facultyCode: nextFacultyCode,
        degreeCode: availableDegree,
      };
    });
  };

  const updateScheduleDate = (
    termCode: TermCode,
    key: "startDate" | "endDate",
    value: string
  ) => {
    setDidRequestRecalculate(false);

    setForm((previous) => {
      const index = TERM_SEQUENCE.findIndex((term) => term === termCode);
      if (index < 0) {
        return previous;
      }

      const target = previous.termSchedules[index] ?? emptyScheduleRow(termCode);
      if (getTermScheduleStatus(target, today) === "PAST") {
        return previous;
      }

      if (target[key] === value) {
        return previous;
      }

      let nextSchedules = previous.termSchedules.map((row) => ({ ...row }));
      const weeks = sanitizeWeeksCount(nextSchedules[index]?.weeks);
      nextSchedules[index] = {
        ...nextSchedules[index],
        [key]: value,
        endDate:
          key === "startDate"
            ? calculateEndDateFromWeeks(value, weeks)
            : nextSchedules[index].endDate,
        isManuallyCustomized: index > 0 ? true : nextSchedules[index].isManuallyCustomized,
        notificationSentAt: "",
      };

      if (index === 0 && previous.autoGenerateFutureTerms) {
        nextSchedules = autoGenerateFutureSchedules(nextSchedules, { today });
      }

      return {
        ...previous,
        termSchedules: nextSchedules,
      };
    });
  };

  const updateScheduleNotifyBefore = (termCode: TermCode, value: NotifyBeforeDays) => {
    setDidRequestRecalculate(false);

    setForm((previous) => {
      const index = TERM_SEQUENCE.findIndex((term) => term === termCode);
      if (index < 0) {
        return previous;
      }

      const target = previous.termSchedules[index] ?? emptyScheduleRow(termCode);
      if (getTermScheduleStatus(target, today) === "PAST") {
        return previous;
      }

      if (target.notifyBeforeDays === value) {
        return previous;
      }

      const nextSchedules = previous.termSchedules.map((row) => ({ ...row }));
      nextSchedules[index] = {
        ...nextSchedules[index],
        notifyBeforeDays: value,
        notificationSentAt: "",
      };

      return {
        ...previous,
        termSchedules: nextSchedules,
      };
    });
  };

  const updateScheduleWeeks = (termCode: TermCode, value: number) => {
    setDidRequestRecalculate(false);

    setForm((previous) => {
      const index = TERM_SEQUENCE.findIndex((term) => term === termCode);
      if (index < 0) {
        return previous;
      }

      const target = previous.termSchedules[index] ?? emptyScheduleRow(termCode);
      if (getTermScheduleStatus(target, today) === "PAST") {
        return previous;
      }

      const nextWeeks = sanitizeWeeksCount(value);
      const nextSchedules = previous.termSchedules.map((row) => ({ ...row }));
      nextSchedules[index] = {
        ...nextSchedules[index],
        weeks: nextWeeks,
        endDate: calculateEndDateFromWeeks(nextSchedules[index].startDate, nextWeeks),
        isManuallyCustomized: index > 0 ? true : nextSchedules[index].isManuallyCustomized,
        notificationSentAt: "",
      };

      return {
        ...previous,
        termSchedules: nextSchedules,
      };
    });
  };

  const toggleAutoGenerateFutureTerms = (enabled: boolean) => {
    setDidRequestRecalculate(false);

    setForm((previous) => {
      if (!enabled) {
        return {
          ...previous,
          autoGenerateFutureTerms: false,
        };
      }

      return {
        ...previous,
        autoGenerateFutureTerms: true,
        termSchedules: autoGenerateFutureSchedules(previous.termSchedules, {
          today,
        }),
      };
    });
  };

  const recalculateFutureTerms = () => {
    if (!form.termSchedules[0]?.startDate) {
      toast({
        title: "Failed",
        message: "Set Y1S1 start date before recalculating future terms",
        variant: "error",
      });
      return;
    }

    setForm((previous) => ({
      ...previous,
      termSchedules: autoGenerateFutureSchedules(previous.termSchedules, {
        today,
        force: true,
      }),
    }));
    setDidRequestRecalculate(true);
    toast({
      title: "Updated",
      message: "Future terms were recalculated from Y1S1 using +6 months",
      variant: "success",
    });
  };

  const validateForm = () => {
    const nextErrors: IntakeFormErrors = {};
    const intakeName = collapseSpaces(form.intakeName);
    const intakeParts = parseIntakeName(intakeName);
    const facultyCode = normalizeCode(form.facultyCode);
    const degreeCode = normalizeCode(form.degreeCode);
    const intakeYear = intakeParts.intakeYear;
    const intakeMonth = intakeParts.intakeMonth;

    if (!intakeName) {
      nextErrors.intakeName = "Enter intake name";
    }

    if (!facultyCode) {
      nextErrors.facultyCode = "Select a valid faculty";
    }

    if (!degreeCode) {
      nextErrors.degreeCode = "Select a valid degree";
    }

    if (!Number.isFinite(intakeYear) || intakeYear < 2000 || intakeYear > 2100 || !intakeMonth) {
      nextErrors.intakeName = "Use intake name format: YYYY Month (example: 2026 March)";
    }

    const invalidRange = form.termSchedules.find(
      (schedule) =>
        Boolean(schedule.startDate) &&
        Boolean(schedule.endDate) &&
        compareDateOnly(schedule.endDate, schedule.startDate) < 0
    );

    if (invalidRange) {
      nextErrors.schedule = `${invalidRange.termCode} end date must be after start date`;
    }

    if (modal?.mode === "edit") {
      const y1s1 = form.termSchedules[0];
      if (!y1s1.startDate || !y1s1.endDate) {
        nextErrors.schedule = "Y1S1 start and end dates are required when editing an intake";
      }
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast({
        title: "Failed",
        message: Object.values(nextErrors)[0],
        variant: "error",
      });
      return null;
    }

    return {
      name: intakeName,
      facultyCode,
      degreeCode,
      intakeYear,
      intakeMonth,
      stream: "",
      status: form.status,
      autoJumpEnabled: form.autoJumpEnabled,
      autoGenerateFutureTerms: form.autoGenerateFutureTerms,
      recalculateFutureTerms: didRequestRecalculate,
      termSchedules: normalizeSchedules(form.termSchedules).map((schedule) => ({
        termCode: schedule.termCode,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        weeks: schedule.weeks,
        notifyBeforeDays: schedule.notifyBeforeDays,
        isManuallyCustomized: schedule.isManuallyCustomized,
        manuallyEdited: schedule.isManuallyCustomized,
      })),
    };
  };

  const saveIntake = async () => {
    if (!modal) return;

    const payload = validateForm();
    if (!payload) return;

    setIsSaving(true);

    try {
      let intakeIdForSync = "";
      let termForSync: TermCode = "Y1S1";

      if (modal.mode === "add") {
        const response = await fetch("/api/intakes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created = await readJson<IntakeRecord>(response);
        intakeIdForSync = String(created.id ?? "");
        termForSync = "Y1S1";
      } else {
        const targetId = modal.targetId;
        if (!targetId) {
          throw new Error("Intake id is missing");
        }

        const response = await fetch(`/api/intakes/${encodeURIComponent(targetId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        await readJson<IntakeRecord>(response);
        intakeIdForSync = targetId;
        termForSync = selectedModuleTerm;
      }

      if (intakeIdForSync) {
        await syncAutoModulesForIntake(intakeIdForSync, termForSync);
      }

      setPage(1);
      void loadIntakes({ background: true, silent: true });
      toast({
        title: "Saved",
        message: "Intake saved successfully",
        variant: "success",
      });
      closeModal();
    } catch (error) {
      setErrors((previous) => ({
        ...previous,
        moduleSync:
          error instanceof Error ? error.message : "Failed to save intake",
      }));
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to save intake",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/intakes/${encodeURIComponent(deleteTargetId)}`, {
        method: "DELETE",
      });
      await readJson<{ ok: true }>(response);

      setDeleteTargetId(null);
      setPage(1);
      void loadIntakes({ background: true, silent: true });
      toast({
        title: "Deleted",
        message: "Intake deleted successfully",
        variant: "success",
      });
    } catch {
      toast({
        title: "Failed",
        message: "Delete failed. Please try again.",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleAutoModuleSelection = (moduleId: string) => {
    setAutoModules((previous) =>
      previous.map((item) =>
        item.id !== moduleId ? item : { ...item, selected: !item.selected }
      )
    );
  };

  const syncAutoModulesForIntake = async (intakeId: string, termCode: TermCode) => {
    const selectedModuleIds = autoModules
      .filter((item) => item.selected)
      .map((item) => item.id);

    const response = await fetch(
      `/api/intakes/${encodeURIComponent(intakeId)}/offerings/sync`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termCode,
          selectedModuleIds,
        }),
      }
    );

    const payload = await readJson<{
      created?: Array<{ moduleCode?: string; moduleName?: string }>;
      removed?: string[];
      blocked?: Array<{ moduleCode?: string; moduleName?: string; reason?: string }>;
      message?: string;
    }>(response);

    const blocked = Array.isArray(payload.blocked) ? payload.blocked : [];
    if (blocked.length > 0) {
      const blockedLabel = blocked
        .map((item) => item.moduleCode || item.moduleName || "Module")
        .join(", ");
      const warning = `Some modules were not removed: ${blockedLabel}`;
      setModuleSyncWarning(warning);
      toast({
        title: "Warning",
        message: warning,
        variant: "info",
      });
    } else {
      setModuleSyncWarning("");
    }

    return payload;
  };

  const visibleTerms = showAllTerms ? TERM_SEQUENCE : TERM_SEQUENCE.slice(0, 2);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <Button
            className="h-11 min-w-[158px] justify-center gap-2 rounded-2xl bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
            onClick={openAddModal}
          >
            <Plus size={16} />
            Add Intake
          </Button>
        }
        description="Manage intake cohorts and configure term schedule dates in Add/Edit flow only."
        title="Intakes / Batches"
      />

      <Card className={cn("transition-all", isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : "")}>
        <div className="grid gap-3 border-b border-border pb-5 lg:grid-cols-[minmax(0,1.4fr)_160px_160px_160px_160px]">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Search
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/50"
                size={16}
              />
              <Input
                aria-label="Search intakes"
                className="h-12 pl-10"
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by intake, faculty, degree"
                value={searchQuery}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Faculty
            </label>
            <Select
              className="h-12"
              onChange={(event) => {
                setFacultyFilter(event.target.value);
                setPage(1);
              }}
              value={facultyFilter}
            >
              <option value="">All</option>
              {faculties.map((faculty) => (
                <option key={faculty.code} value={faculty.code}>
                  {faculty.code}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Degree
            </label>
            <Select
              className="h-12"
              onChange={(event) => {
                setDegreeFilter(event.target.value);
                setPage(1);
              }}
              value={degreeFilter}
            >
              <option value="">All</option>
              {degrees
                .filter((degree) =>
                  facultyFilter ? degree.facultyCode === facultyFilter : true
                )
                .map((degree) => (
                  <option key={degree.code} value={degree.code}>
                    {degree.code}
                  </option>
                ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Status
            </label>
            <Select
              className="h-12"
              onChange={(event) => {
                setStatusFilter(event.target.value as "" | IntakeStatus);
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Sort
            </label>
            <Select
              className="h-12"
              onChange={(event) => {
                setSortBy(event.target.value as IntakeSort);
                setPage(1);
              }}
              value={sortBy}
            >
              <option value="updated">Recently Updated</option>
              <option value="created">Recently Added</option>
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
            </Select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-border bg-tint">
              <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                <th className="px-4 py-3">Intake</th>
                <th className="px-4 py-3">Faculty</th>
                <th className="px-4 py-3">Degree</th>
                <th className="px-4 py-3">Current Term</th>
                <th className="px-4 py-3">Next Term Start Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={8}>
                    Loading intakes...
                  </td>
                </tr>
              ) : null}

              {!isLoading && loadError ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/72" colSpan={8}>
                    <div className="flex flex-col items-center justify-center gap-3">
                      <span>Failed to load</span>
                      <Button
                        className="h-10 min-w-[108px] border-slate-300 bg-white px-4 text-heading hover:bg-slate-50"
                        onClick={() => {
                          void loadIntakes();
                        }}
                        variant="secondary"
                      >
                        Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && !loadError
                ? items.map((intake) => {
                    const nextTermStartDate = getNextTermStartDate(intake);
                    return (
                      <tr
                        className="border-b border-border/70 transition-colors hover:bg-tint"
                        key={intake.id}
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-heading">{intakeLabel(intake)}</p>
                        </td>
                        <td className="px-4 py-4 text-text/78">{intake.facultyCode}</td>
                        <td className="px-4 py-4 text-text/78">{intake.degreeCode}</td>
                        <td className="px-4 py-4">
                          <Badge variant="info">{intake.currentTerm}</Badge>
                        </td>
                        <td className="px-4 py-4 text-text/78">
                          {nextTermStartDate ? formatDate(nextTermStartDate) : "\u2014"}
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={statusVariant(intake.status)}>
                            {statusLabel(intake.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-text/78">{formatDate(intake.updatedAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              aria-label={`Edit ${intakeLabel(intake)}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
                              onClick={() => openEditModal(intake)}
                              type="button"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              aria-label={`Delete ${intakeLabel(intake)}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
                              onClick={() => setDeleteTargetId(intake.id)}
                              type="button"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : null}

              {!isLoading && !loadError && items.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={8}>
                    No intakes match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <TablePagination
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value as PageSize);
            setPage(1);
          }}
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          totalItems={totalCount}
        />
      </Card>

      {modal ? (
        <>
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isSaving) closeModal();
            }}
            role="presentation"
          >
            <div
              aria-modal="true"
              className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]"
              role="dialog"
            >
            <div className="overflow-y-auto px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                    {modal.mode === "add" ? "CREATE" : "EDIT"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-heading">
                    {modal.mode === "add" ? "Add Intake" : "Edit Intake"}
                  </p>
                  <p className="mt-1 text-sm text-text/65">
                    Configure intake details and term schedules from this modal.
                  </p>
                </div>
                <button
                  aria-label="Close modal"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  onClick={closeModal}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="intakeFaculty">
                    Faculty
                  </label>
                  <Select
                    className={cn(
                      "h-12",
                      errors.facultyCode
                        ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                        : ""
                    )}
                    disabled={isSaving}
                    id="intakeFaculty"
                    onChange={(event) => setFacultyCode(event.target.value)}
                    value={form.facultyCode}
                  >
                    <option value="">Select Faculty</option>
                    {faculties.map((faculty) => (
                      <option key={faculty.code} value={faculty.code}>
                        {faculty.code}
                      </option>
                    ))}
                  </Select>
                  {errors.facultyCode ? (
                    <p className="mt-1.5 text-xs font-medium text-red-600">{errors.facultyCode}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="intakeDegree">
                    Degree
                  </label>
                  <Select
                    className={cn(
                      "h-12",
                      errors.degreeCode
                        ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                        : ""
                    )}
                    disabled={isSaving}
                    id="intakeDegree"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        degreeCode: event.target.value,
                      }))
                    }
                    value={form.degreeCode}
                  >
                    <option value="">Select Degree</option>
                    {filteredDegreeOptions.map((degree) => (
                      <option key={degree.code} value={degree.code}>
                        {degree.code} - {degree.name}
                      </option>
                    ))}
                  </Select>
                  {errors.degreeCode ? (
                    <p className="mt-1.5 text-xs font-medium text-red-600">{errors.degreeCode}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="intakeStatus">
                    Status
                  </label>
                  <Select
                    className="h-12"
                    disabled={isSaving}
                    id="intakeStatus"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        status: event.target.value as IntakeStatus,
                      }))
                    }
                    value={form.status}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="intakeName">
                    Intake Name
                  </label>
                  <Input
                    className={cn(
                      "h-12",
                      errors.intakeName
                        ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                        : ""
                    )}
                    disabled={isSaving}
                    id="intakeName"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        intakeName: event.target.value,
                      }))
                    }
                    placeholder="2026 March"
                    value={form.intakeName}
                  />
                  {errors.intakeName ? (
                    <p className="mt-1.5 text-xs font-medium text-red-600">{errors.intakeName}</p>
                  ) : (
                    <p className="mt-1.5 text-xs text-text/60">Format: YYYY Month</p>
                  )}
                </div>

                <div className="flex items-end">
                  <label className="inline-flex h-12 w-full items-center gap-2 rounded-2xl border border-border bg-tint px-4 text-sm font-medium text-heading">
                    <input
                      checked={form.autoJumpEnabled}
                      className="h-4 w-4 rounded border-border"
                      disabled={isSaving}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          autoJumpEnabled: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    Auto jump current term when end date passes
                  </label>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-border bg-tint/60 p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                      Term Schedule {modal.mode === "add" ? "(Optional in Add Intake)" : "(Required in Edit Intake)"}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-heading">Schedule Editor</p>
                    <p className="mt-1 text-sm text-text/68">
                      Y1S1 and Y1S2 are shown first. Past rows are locked to preserve history.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-white px-3.5 text-sm font-medium text-heading">
                      <input
                        checked={form.autoGenerateFutureTerms}
                        className="h-4 w-4 rounded border-border"
                        disabled={isSaving}
                        onChange={(event) =>
                          toggleAutoGenerateFutureTerms(event.target.checked)
                        }
                        type="checkbox"
                      />
                      Auto-generate future terms (+6 months)
                    </label>

                    <Button
                      className="h-10 gap-2 border-slate-300 bg-white px-4 text-heading hover:bg-slate-50"
                      disabled={isSaving}
                      onClick={recalculateFutureTerms}
                      variant="secondary"
                    >
                      <RefreshCcw size={14} />
                      Recalculate future terms
                    </Button>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-white">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="border-b border-border bg-tint">
                      <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                        <th className="px-4 py-3">Term Code</th>
                        <th className="px-4 py-3">Start Date</th>
                        <th className="px-4 py-3">Weeks</th>
                        <th className="px-4 py-3">End Date</th>
                        <th className="px-4 py-3">Notify Before</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTerms.map((termCode) => {
                        const row =
                          form.termSchedules.find((schedule) => schedule.termCode === termCode) ??
                          emptyScheduleRow(termCode);
                        const status = getTermScheduleStatus(row, today);
                        const isPast = status === "PAST";

                        return (
                          <tr className="border-b border-border/70" key={termCode}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-heading">{termCode}</span>
                                {row.isManuallyCustomized && status === "FUTURE" ? (
                                  <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[11px] font-semibold text-[#0339A6]">
                                    Custom
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                className="h-10"
                                disabled={isSaving || isPast}
                                onChange={(event) =>
                                  updateScheduleDate(termCode, "startDate", event.target.value)
                                }
                                type="date"
                                value={row.startDate}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                className="h-10"
                                disabled={isSaving || isPast}
                                min={1}
                                onChange={(event) =>
                                  updateScheduleWeeks(termCode, Number(event.target.value))
                                }
                                type="number"
                                value={row.weeks}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                className="h-10"
                                disabled
                                type="date"
                                value={row.endDate}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Select
                                className="h-10"
                                disabled={isSaving || isPast}
                                onChange={(event) =>
                                  updateScheduleNotifyBefore(
                                    termCode,
                                    Number(event.target.value) as NotifyBeforeDays
                                  )
                                }
                                value={row.notifyBeforeDays}
                              >
                                {NOTIFY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Badge variant={termStatusVariant(status)}>
                                  {termStatusLabel(status)}
                                </Badge>
                                {isPast ? (
                                  <span className="text-xs font-semibold text-text/55">Locked</span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    className="text-sm font-semibold text-[#034aa6] hover:text-[#0339a6]"
                    onClick={() => setShowAllTerms((previous) => !previous)}
                    type="button"
                  >
                    {showAllTerms
                      ? "Show fewer terms (Y1S1, Y1S2 only)"
                      : "Show more terms (Y2S1 to Y4S2)"}
                  </button>

                  {didRequestRecalculate ? (
                    <p className="text-xs font-medium text-[#0339A6]">
                      Future terms will be saved using the latest recalculation.
                    </p>
                  ) : null}
                </div>

                {errors.schedule ? (
                  <p className="mt-2 text-sm font-medium text-red-600">{errors.schedule}</p>
                ) : null}
              </div>

              <div className="mt-6 rounded-3xl border border-border bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                      Auto Modules
                    </p>
                    <p className="mt-1 text-lg font-semibold text-heading">
                      Modules (Auto-selected for {selectedModuleTerm})
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      className="h-10 min-w-[130px]"
                      disabled={isSaving || modal.mode === "add"}
                      onChange={(event) =>
                        setSelectedModuleTerm(sanitizeTermCode(event.target.value))
                      }
                      value={selectedModuleTerm}
                    >
                      {TERM_SEQUENCE.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </Select>
                    <Input
                      className="h-10 min-w-[240px]"
                      disabled={isSaving}
                      onChange={(event) => setAutoModuleSearch(event.target.value)}
                      placeholder="Search modules"
                      value={autoModuleSearch}
                    />
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full min-w-[740px] text-left text-sm">
                    <thead className="border-b border-border bg-tint">
                      <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                        <th className="px-4 py-3">Module</th>
                        <th className="px-4 py-3">Syllabus</th>
                        <th className="px-4 py-3">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingAutoModules ? (
                        <tr>
                          <td className="px-4 py-6 text-text/65" colSpan={3}>
                            Loading applicable modules...
                          </td>
                        </tr>
                      ) : null}

                      {!isLoadingAutoModules && filteredAutoModules.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-text/65" colSpan={3}>
                            No modules applicable for {form.facultyCode || "—"} /{" "}
                            {form.degreeCode || "—"} / {selectedModuleTerm}.
                          </td>
                        </tr>
                      ) : null}

                      {!isLoadingAutoModules
                        ? filteredAutoModules.map((module) => (
                            <tr className="border-b border-border/70" key={module.id}>
                              <td className="px-4 py-3">
                                <label className="inline-flex items-center gap-3">
                                  <input
                                    checked={module.selected}
                                    className="h-4 w-4 rounded border-border"
                                    disabled={isSaving}
                                    onChange={() => toggleAutoModuleSelection(module.id)}
                                    type="checkbox"
                                  />
                                  <span className="font-semibold text-heading">
                                    {module.code} - {module.name}
                                  </span>
                                </label>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={module.syllabusVersion === "OLD" ? "warning" : "primary"}>
                                  {module.syllabusVersion}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">{formatDate(module.updatedAt)}</td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                </div>

                {modal.mode === "add" ? (
                  <p className="mt-3 text-xs font-medium text-text/68">
                    Selected modules will be synced to Y1S1 automatically after intake creation.
                  </p>
                ) : null}

                {moduleSyncWarning ? (
                  <p className="mt-3 text-sm font-medium text-[#034aa6]">{moduleSyncWarning}</p>
                ) : null}

                {errors.moduleSync ? (
                  <p className="mt-3 text-sm font-medium text-red-600">{errors.moduleSync}</p>
                ) : null}
              </div>
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-white px-6 py-4 shadow-[0_-1px_0_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button
                  className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                  disabled={isSaving}
                  onClick={closeModal}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 min-w-[132px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
                  disabled={isSaving}
                  onClick={() => void saveIntake()}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
            </div>
          </div>

        </>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting) setDeleteTargetId(null);
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]"
            role="dialog"
          >
            <div className="px-6 py-6">
              <p className="text-lg font-semibold text-heading">Delete Intake</p>
              <p className="mt-2 text-sm leading-6 text-text/70">
                Are you sure you want to delete intake{" "}
                <span className="font-semibold text-heading">
                  &lsquo;{intakeLabel(deleteTarget)} / {deleteTarget.facultyCode} / {deleteTarget.degreeCode}&rsquo;
                </span>
                ? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
              <Button
                className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                disabled={isDeleting}
                onClick={() => setDeleteTargetId(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[132px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700"
                disabled={isDeleting}
                onClick={() => void confirmDelete()}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
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
