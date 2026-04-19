"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GraduationCap,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";

type ProgramStatus = "ACTIVE" | "INACTIVE" | "DRAFT";
type SortOption = "az" | "za" | "updated" | "created";
type PageSize = 10 | 25 | 50 | 100;
type SummaryTone = "sky" | "teal" | "amber" | "green" | "rose" | "violet";

interface FacultyOption {
  code: string;
}

interface DegreeProgramRecord {
  code: string;
  name: string;
  facultyCode: string;
  award: string;
  credits: number;
  durationYears: number;
  status: ProgramStatus;
  createdAt: string;
  updatedAt: string;
}

interface DegreeProgramsResponse {
  items: DegreeProgramRecord[];
  page: number;
  pageSize: number;
  totalCount: number;
}

interface ProgramFormState {
  code: string;
  name: string;
  facultyCode: string;
  award: string;
  credits: string;
  durationYears: string;
  status: ProgramStatus;
}

interface ProgramFormErrors {
  code?: string;
  name?: string;
  facultyCode?: string;
  award?: string;
  credits?: string;
  durationYears?: string;
}

interface ProgramModalState {
  mode: "add" | "edit";
  targetCode?: string;
}

interface DegreeProgramFilters {
  faculty: string;
  code: string;
  award: string;
  creditsMin: string;
  creditsMax: string;
  durationYears: string;
  status: "" | ProgramStatus;
}

const AWARD_OPTIONS = ["BSc", "BSc (Hons)", "BEng", "BEng (Hons)", "BBA"];
const DURATION_OPTIONS = [
  { label: "3 yrs", value: "3" },
  { label: "4 yrs", value: "4" },
];

const SORT_LABELS: Record<SortOption, string> = {
  az: "A-Z",
  za: "Z-A",
  updated: "Recently Updated",
  created: "Recently Added",
};

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function emptyForm(): ProgramFormState {
  return {
    code: "",
    name: "",
    facultyCode: "",
    award: "BSc",
    credits: "120",
    durationYears: "4",
    status: "ACTIVE",
  };
}

function emptyFilters(): DegreeProgramFilters {
  return {
    faculty: "",
    code: "",
    award: "",
    creditsMin: "",
    creditsMax: "",
    durationYears: "",
    status: "",
  };
}

function statusVariant(status: ProgramStatus) {
  if (status === "ACTIVE") return "success";
  if (status === "DRAFT") return "warning";
  return "neutral";
}

function statusLabel(status: ProgramStatus) {
  if (status === "ACTIVE") return "Active";
  if (status === "INACTIVE") return "Inactive";
  return "Draft";
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
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

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;

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

export default function DegreeProgramsPage() {
  const { setActiveWindow } = useAdminContext();
  const { toast } = useToast();

  const [facultyOptions, setFacultyOptions] = useState<FacultyOption[]>([]);
  const [items, setItems] = useState<DegreeProgramRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<DegreeProgramFilters>(emptyFilters);
  const [filterDraft, setFilterDraft] = useState<DegreeProgramFilters>(emptyFilters);
  const [modal, setModal] = useState<ProgramModalState | null>(null);
  const [form, setForm] = useState<ProgramFormState>(emptyForm);
  const [errors, setErrors] = useState<ProgramFormErrors>({});
  const [deleteTargetCode, setDeleteTargetCode] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount);
  const isOverlayOpen = Boolean(modal || deleteTargetCode || isFiltersOpen);
  const activeFilterCount = [
    appliedFilters.faculty,
    appliedFilters.code,
    appliedFilters.award,
    appliedFilters.creditsMin,
    appliedFilters.creditsMax,
    appliedFilters.durationYears,
    appliedFilters.status,
  ].filter(Boolean).length;
  const deleteTarget =
    deleteTargetCode === null
      ? null
      : items.find((program) => program.code === deleteTargetCode) ?? null;
  const contentBlurClass = isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : "";
  const filtersApplied = Boolean(searchQuery.trim() || activeFilterCount > 0);
  const activePrograms = useMemo(
    () => items.filter((program) => program.status === "ACTIVE").length,
    [items]
  );
  const draftPrograms = useMemo(
    () => items.filter((program) => program.status === "DRAFT").length,
    [items]
  );
  const latestUpdatedAt = useMemo(
    () =>
      items.reduce<string | null>((latest, program) => {
        if (!program.updatedAt) {
          return latest;
        }

        if (!latest || program.updatedAt.localeCompare(latest) > 0) {
          return program.updatedAt;
        }

        return latest;
      }, null),
    [items]
  );
  const summaryCards: Array<{
    label: string;
    value: string;
    detail: string;
    tone: SummaryTone;
    icon: ComponentType<{ size?: number }>;
  }> = [
    {
      label: "Total Programs",
      value: totalCount.toLocaleString(),
      detail: `${items.length.toLocaleString()} rows loaded in the current view`,
      tone: "violet",
      icon: GraduationCap,
    },
    {
      label: "Active Programs",
      value: activePrograms.toLocaleString(),
      detail:
        activePrograms > 0
          ? `${activePrograms.toLocaleString()} active programs visible on this page`
          : "No active program rows in the current view",
      tone: "green",
      icon: CheckCircle2,
    },
    {
      label: "Draft Programs",
      value: draftPrograms.toLocaleString(),
      detail:
        draftPrograms > 0
          ? `${draftPrograms.toLocaleString()} draft programs need review`
          : "No draft programs in the current view",
      tone: "amber",
      icon: Pencil,
    },
    {
      label: "Latest Update",
      value: formatShortDate(latestUpdatedAt),
      detail:
        latestUpdatedAt !== null
          ? "Most recent visible degree program change"
          : "No program updates loaded yet",
      tone: "sky",
      icon: Clock3,
    },
  ];

  const closeModal = useCallback(() => {
    setModal(null);
    setForm(emptyForm());
    setErrors({});
  }, []);

  const closeFilters = useCallback(() => {
    setIsFiltersOpen(false);
    setFilterDraft(appliedFilters);
  }, [appliedFilters]);

  const loadFacultyOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/faculties", { cache: "no-store" });
      const payload = await readJson<FacultyOption[]>(response);
      setFacultyOptions(Array.isArray(payload) ? payload : []);
    } catch {
      setFacultyOptions([]);
    }
  }, []);

  const loadPrograms = useCallback(
    async (options?: { background?: boolean; silent?: boolean }) => {
      if (!options?.background) {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
        if (appliedFilters.faculty) params.set("faculty", appliedFilters.faculty);
        if (appliedFilters.code) params.set("code", appliedFilters.code);
        if (appliedFilters.award) params.set("award", appliedFilters.award);
        if (appliedFilters.creditsMin) params.set("creditsMin", appliedFilters.creditsMin);
        if (appliedFilters.creditsMax) params.set("creditsMax", appliedFilters.creditsMax);
        if (appliedFilters.durationYears) {
          params.set("durationYears", appliedFilters.durationYears);
        }
        if (appliedFilters.status) params.set("status", appliedFilters.status);
        params.set("sort", sortBy);
        params.set("page", String(safePage));
        params.set("pageSize", String(pageSize));

        const response = await fetch(`/api/degree-programs?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = await readJson<DegreeProgramsResponse>(response);

        setItems(Array.isArray(payload.items) ? payload.items : []);
        setTotalCount(payload.totalCount ?? 0);
        if (payload.page && payload.page !== safePage) {
          setPage(payload.page);
        }
      } catch (error) {
        if (!options?.silent) {
          toast({
            title: "Failed",
            message:
              error instanceof Error ? error.message : "Failed to load degree programs",
            variant: "error",
          });
          setItems([]);
          setTotalCount(0);
        }
      } finally {
        if (!options?.background) {
          setIsLoading(false);
        }
      }
    },
    [appliedFilters, deferredSearch, pageSize, safePage, sortBy, toast]
  );

  useEffect(() => {
    void loadFacultyOptions();
  }, [loadFacultyOptions]);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

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
      setActiveWindow(null);
      return;
    }

    setActiveWindow(modal.mode === "add" ? "Create Program" : "Edit Program");
  }, [modal, setActiveWindow]);

  useEffect(() => {
    return () => {
      setActiveWindow(null);
    };
  }, [setActiveWindow]);

  useEffect(() => {
    if (!isOverlayOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deleteTargetCode && !isDeleting) {
        setDeleteTargetCode(null);
        return;
      }
      if (modal && !isSaving) {
        closeModal();
        return;
      }

      if (isFiltersOpen) {
        closeFilters();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    closeFilters,
    closeModal,
    deleteTargetCode,
    isDeleting,
    isFiltersOpen,
    isOverlayOpen,
    isSaving,
    modal,
  ]);

  const openAddModal = () => {
    setModal({ mode: "add" });
    setForm({
      ...emptyForm(),
      facultyCode: facultyOptions[0]?.code ?? "",
    });
    setErrors({});
  };

  const openEditModal = (program: DegreeProgramRecord) => {
    setModal({ mode: "edit", targetCode: program.code });
    setForm({
      code: program.code,
      name: program.name,
      facultyCode: program.facultyCode,
      award: program.award,
      credits: String(program.credits),
      durationYears: String(program.durationYears),
      status: program.status,
    });
    setErrors({});
  };

  const openFiltersModal = () => {
    setFilterDraft(appliedFilters);
    setIsFiltersOpen(true);
  };

  const applyFilters = () => {
    const normalizedFilters: DegreeProgramFilters = {
      ...filterDraft,
      faculty: filterDraft.faculty.trim().toUpperCase(),
      code: normalizeCode(filterDraft.code),
      award: filterDraft.award.trim(),
      creditsMin: filterDraft.creditsMin.trim(),
      creditsMax: filterDraft.creditsMax.trim(),
      durationYears: filterDraft.durationYears.trim(),
      status: filterDraft.status,
    };

    setAppliedFilters(normalizedFilters);
    setPage(1);
    setIsFiltersOpen(false);
  };

  const clearFilters = () => {
    const nextFilters = emptyFilters();
    setFilterDraft(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
    setIsFiltersOpen(false);
  };

  const resetSearchAndFilters = () => {
    setSearchQuery("");
    const nextFilters = emptyFilters();
    setFilterDraft(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
  };

  const validateForm = () => {
    const nextErrors: ProgramFormErrors = {};
    const code = normalizeCode(form.code.trim());
    const name = form.name.trim();
    const award = form.award.trim();
    const credits = Number(form.credits);
    const durationYears = Number(form.durationYears);

    if (!/^[A-Z]{2,6}$/.test(code)) nextErrors.code = "Use 2-6 uppercase letters";
    if (!name) nextErrors.name = "Program name is required";
    if (!form.facultyCode) nextErrors.facultyCode = "Select a faculty";
    if (!award) nextErrors.award = "Award is required";
    if (!Number.isFinite(credits) || credits <= 0) nextErrors.credits = "Enter valid credits";
    if (!Number.isFinite(durationYears) || durationYears <= 0) {
      nextErrors.durationYears = "Select a valid duration";
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
      code,
      name,
      facultyCode: form.facultyCode,
      award,
      credits,
      durationYears,
      status: form.status,
    };
  };

  const saveProgram = async () => {
    const payload = validateForm();
    if (!payload || !modal) return;

    setIsSaving(true);

    try {
      if (modal.mode === "add") {
        const response = await fetch("/api/degree-programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        await readJson<DegreeProgramRecord>(response);
      } else {
        const response = await fetch(
          `/api/degree-programs/${encodeURIComponent(modal.targetCode ?? payload.code)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: payload.name,
              facultyCode: payload.facultyCode,
              award: payload.award,
              credits: payload.credits,
              durationYears: payload.durationYears,
              status: payload.status,
            }),
          }
        );
        await readJson<DegreeProgramRecord>(response);
      }

      setPage(1);
      void loadPrograms({ background: true, silent: true });
      toast({
        title: "Saved",
        message: "Program saved successfully",
        variant: "success",
      });
      closeModal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save degree program";

      if (message === "Program code already exists") {
        setErrors((previous) => ({
          ...previous,
          code: "Program code already exists",
        }));
      }

      toast({
        title: "Failed",
        message,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetCode) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/degree-programs/${encodeURIComponent(deleteTargetCode)}`,
        {
          method: "DELETE",
        }
      );
      await readJson<{ ok: true }>(response);

      setDeleteTargetCode(null);
      setPage(1);
      void loadPrograms({ background: true, silent: true });
      toast({
        title: "Deleted",
        message: "Program deleted successfully",
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

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <div className={cn("flex justify-end", contentBlurClass)}>
        <Button className="h-11 gap-2 px-5" onClick={openAddModal}>
          <Plus size={16} />
          Add Program
        </Button>
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
                  Degree program directory
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  Search, filter, and maintain degree programs, awards, and
                  curriculum requirements using the updated admin surface style.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[190px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Visible Results
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                    {totalCount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    {filtersApplied
                      ? "Matching the current search and filters"
                      : "Showing the full degree program directory"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Search
                  </label>
                  <div className="group flex h-14 w-full min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Search size={17} />
                    </span>
                    <input
                      aria-label="Search degree programs"
                      className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-[15px] text-heading outline-none placeholder:text-text/48"
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by program code or name"
                      value={searchQuery}
                    />
                    {searchQuery.trim() ? (
                      <button
                        aria-label="Clear search"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text/45 transition-colors hover:bg-primary/8 hover:text-primary"
                        onClick={() => {
                          setSearchQuery("");
                          setPage(1);
                        }}
                        type="button"
                      >
                        <X size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Sort
                  </label>
                  <div className="group relative flex h-14 w-full items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ArrowUpDown size={16} />
                    </span>
                    <select
                      aria-label="Sort degree programs"
                      className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      onChange={(event) => {
                        setSortBy(event.target.value as SortOption);
                        setPage(1);
                      }}
                      value={sortBy}
                    >
                      <option value="updated">Recently Updated</option>
                      <option value="created">Recently Added</option>
                      <option value="az">A-Z</option>
                      <option value="za">Z-A</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Filters
                </label>
                <button
                  className="group flex h-14 w-full items-center justify-between rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 text-left shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all hover:-translate-y-0.5 hover:border-[rgba(52,97,255,0.22)] hover:shadow-[0_18px_36px_rgba(52,97,255,0.08)]"
                  onClick={openFiltersModal}
                  type="button"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ListFilter size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-heading">
                        {activeFilterCount > 0
                          ? `${activeFilterCount} filters applied`
                          : "Open advanced filters"}
                      </span>
                    </span>
                  </span>
                  <ChevronDown className="shrink-0 text-text/45" size={17} />
                </button>
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

      <Card className={cn("overflow-hidden p-0 transition-all", contentBlurClass)}>
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-heading">Degree Program Records</p>
            <p className="mt-1 text-sm text-text/68">
              Review curriculum setup, academic ownership, and status from a cleaner
              table surface.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={activeFilterCount > 0 ? "primary" : "neutral"}>
              {activeFilterCount > 0 ? `${activeFilterCount} filters applied` : "No extra filters"}
            </Badge>
            <Badge variant="neutral">{SORT_LABELS[sortBy]}</Badge>
            {searchQuery.trim() ? (
              <Badge
                className="max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap"
                variant="primary"
              >
                Search: {searchQuery.trim()}
              </Badge>
            ) : null}
            {filtersApplied ? (
              <Button className="h-9 px-3 text-xs" onClick={resetSearchAndFilters} variant="ghost">
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="overflow-hidden rounded-[28px] border border-border bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-[rgba(255,255,255,0.82)]">
                  <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    <th className="px-5 py-4">Program Code</th>
                    <th className="px-5 py-4">Program Name</th>
                    <th className="px-5 py-4">Faculty</th>
                    <th className="px-5 py-4">Award</th>
                    <th className="px-5 py-4">Credits</th>
                    <th className="px-5 py-4">Duration</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {isLoading ? (
                    <tr>
                      <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={8}>
                        Loading degree programs...
                      </td>
                    </tr>
                  ) : null}

                  {!isLoading
                    ? items.map((program) => (
                        <tr
                          className="transition-colors duration-200 hover:bg-white/70"
                          key={program.code}
                        >
                          <td className="px-5 py-4 align-top">
                            <div>
                              <p className="font-semibold text-heading">{program.code}</p>
                              <p className="mt-1 text-xs text-text/55">
                                Created {formatDate(program.createdAt)}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div>
                              <p className="font-medium text-heading">{program.name}</p>
                              <p className="mt-1 text-xs text-text/55">
                                Updated {formatDate(program.updatedAt)}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-medium text-heading">{program.facultyCode}</p>
                            <p className="mt-1 text-xs text-text/55">Owning faculty</p>
                          </td>
                          <td className="px-5 py-4 align-top text-text/78">{program.award}</td>
                          <td className="px-5 py-4 align-top text-text/78">
                            {program.credits} credits
                          </td>
                          <td className="px-5 py-4 align-top text-text/78">
                            {program.durationYears} yrs
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="space-y-1.5">
                              <Badge variant={statusVariant(program.status)}>
                                {statusLabel(program.status)}
                              </Badge>
                              <p className="text-xs text-text/55">
                                {program.status === "ACTIVE"
                                  ? "Available in active academic setup"
                                  : program.status === "DRAFT"
                                    ? "Needs review before activation"
                                    : "Not visible in active setup"}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex justify-end gap-2">
                              <button
                                aria-label={`Edit ${program.code}`}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-heading hover:shadow-shadow"
                                onClick={() => openEditModal(program)}
                                type="button"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                aria-label={`Delete ${program.code}`}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-red-200 hover:bg-white hover:text-red-600 hover:shadow-shadow"
                                onClick={() => setDeleteTargetCode(program.code)}
                                type="button"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    : null}

                  {!isLoading && items.length === 0 ? (
                    <tr>
                      <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={8}>
                        No degree programs match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <TablePagination
          className="mt-0 px-6 pb-6"
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

      {isFiltersOpen ? (
        <div
          className="fixed inset-0 z-[92] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeFilters();
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-border bg-[rgba(255,255,255,0.94)] shadow-[0_32px_80px_rgba(15,23,42,0.24)]"
            role="dialog"
          >
            <div className="overflow-y-auto px-6 py-6 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <Badge variant="neutral">Filters</Badge>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                    Filter degree programs
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text/68">
                    Refine the list using faculty, award, duration, credits, and
                    publication status.
                  </p>
                </div>
                <button
                  aria-label="Close filters"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/80 text-text/70 transition-all hover:bg-white hover:text-heading"
                  onClick={closeFilters}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-6 rounded-[26px] border border-border bg-white/70 p-4 sm:p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="filterFaculty"
                    >
                      Faculty
                    </label>
                    <Select
                      className="h-12 rounded-2xl"
                      id="filterFaculty"
                      onChange={(event) =>
                        setFilterDraft((previous) => ({
                          ...previous,
                          faculty: event.target.value,
                        }))
                      }
                      value={filterDraft.faculty}
                    >
                      <option value="">All Faculties</option>
                      {facultyOptions.map((faculty) => (
                        <option key={faculty.code} value={faculty.code}>
                          {faculty.code}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="filterProgramCode"
                    >
                      Program Code
                    </label>
                    <Input
                      className="h-12 rounded-2xl"
                      id="filterProgramCode"
                      onChange={(event) =>
                        setFilterDraft((previous) => ({
                          ...previous,
                          code: normalizeCode(event.target.value),
                        }))
                      }
                      placeholder="SE"
                      value={filterDraft.code}
                    />
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="filterAward"
                    >
                      Award
                    </label>
                    <Select
                      className="h-12 rounded-2xl"
                      id="filterAward"
                      onChange={(event) =>
                        setFilterDraft((previous) => ({
                          ...previous,
                          award: event.target.value,
                        }))
                      }
                      value={filterDraft.award}
                    >
                      <option value="">All Awards</option>
                      {AWARD_OPTIONS.map((award) => (
                        <option key={award} value={award}>
                          {award}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="filterDuration"
                    >
                      Duration
                    </label>
                    <Select
                      className="h-12 rounded-2xl"
                      id="filterDuration"
                      onChange={(event) =>
                        setFilterDraft((previous) => ({
                          ...previous,
                          durationYears: event.target.value,
                        }))
                      }
                      value={filterDraft.durationYears}
                    >
                      <option value="">All Durations</option>
                      {DURATION_OPTIONS.map((duration) => (
                        <option key={duration.value} value={duration.value}>
                          {duration.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-heading">
                      Credits Range
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        className="h-12 rounded-2xl"
                        min="0"
                        onChange={(event) =>
                          setFilterDraft((previous) => ({
                            ...previous,
                            creditsMin: event.target.value,
                          }))
                        }
                        placeholder="Min credits"
                        type="number"
                        value={filterDraft.creditsMin}
                      />
                      <Input
                        className="h-12 rounded-2xl"
                        min="0"
                        onChange={(event) =>
                          setFilterDraft((previous) => ({
                            ...previous,
                            creditsMax: event.target.value,
                          }))
                        }
                        placeholder="Max credits"
                        type="number"
                        value={filterDraft.creditsMax}
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="filterStatus"
                    >
                      Status
                    </label>
                    <Select
                      className="h-12 rounded-2xl"
                      id="filterStatus"
                      onChange={(event) =>
                        setFilterDraft((previous) => ({
                          ...previous,
                          status: event.target.value as "" | ProgramStatus,
                        }))
                      }
                      value={filterDraft.status}
                    >
                      <option value="">All Statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="DRAFT">Draft</option>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-white/90 px-6 py-4 sm:px-7">
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button
                  className="h-11 min-w-[112px] px-5"
                  onClick={clearFilters}
                  variant="secondary"
                >
                  Clear
                </Button>
                <Button className="h-11 min-w-[148px] gap-2 px-5" onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) closeModal();
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-border bg-[rgba(255,255,255,0.94)] shadow-[0_32px_80px_rgba(15,23,42,0.24)]"
            role="dialog"
          >
            <div className="overflow-y-auto px-6 py-6 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <Badge variant="neutral">
                    {modal.mode === "add" ? "Create Program" : "Edit Program"}
                  </Badge>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                    {modal.mode === "add"
                      ? "Add a new degree program"
                      : `Update ${modal.targetCode ?? "program"}`}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text/68">
                    Maintain academic ownership, award information, credits, duration,
                    and publication status for each degree program.
                  </p>
                </div>
                <button
                  aria-label="Close modal"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/80 text-text/70 transition-all hover:bg-white hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  onClick={closeModal}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-6 rounded-[26px] border border-border bg-white/70 p-4 sm:p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="programCode"
                    >
                      Program Code
                    </label>
                    <Input
                      className={cn(
                        "h-12 rounded-2xl",
                        errors.code
                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                          : ""
                      )}
                      disabled={modal.mode === "edit" || isSaving}
                      id="programCode"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          code: normalizeCode(event.target.value),
                        }))
                      }
                      placeholder="SE"
                      value={form.code}
                    />
                    <p className="mt-1.5 text-xs text-text/55">
                      Use 2-6 uppercase letters. Example: SE
                    </p>
                    {errors.code ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{errors.code}</p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="programStatus"
                    >
                      Status
                    </label>
                    <Select
                      className="h-12 rounded-2xl"
                      disabled={isSaving}
                      id="programStatus"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          status: event.target.value as ProgramStatus,
                        }))
                      }
                      value={form.status}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="DRAFT">Draft</option>
                    </Select>
                    <p className="mt-1.5 text-xs text-text/55">
                      Draft programs can be reviewed before going live.
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="programName"
                    >
                      Program Name
                    </label>
                    <Input
                      className={cn(
                        "h-12 rounded-2xl",
                        errors.name
                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                          : ""
                      )}
                      disabled={isSaving}
                      id="programName"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="BSc Software Engineering"
                      value={form.name}
                    />
                    {errors.name ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{errors.name}</p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="programFaculty"
                    >
                      Faculty
                    </label>
                    <Select
                      className={cn(
                        "h-12 rounded-2xl",
                        errors.facultyCode
                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                          : ""
                      )}
                      disabled={isSaving}
                      id="programFaculty"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          facultyCode: event.target.value,
                        }))
                      }
                      value={form.facultyCode}
                    >
                      <option value="">Select Faculty</option>
                      {facultyOptions.map((faculty) => (
                        <option key={faculty.code} value={faculty.code}>
                          {faculty.code}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1.5 text-xs text-text/55">
                      This sets the owning faculty for the program.
                    </p>
                    {errors.facultyCode ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.facultyCode}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="programAward"
                    >
                      Award
                    </label>
                    <Select
                      className={cn(
                        "h-12 rounded-2xl",
                        errors.award
                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                          : ""
                      )}
                      disabled={isSaving}
                      id="programAward"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          award: event.target.value,
                        }))
                      }
                      value={form.award}
                    >
                      {AWARD_OPTIONS.map((award) => (
                        <option key={award} value={award}>
                          {award}
                        </option>
                      ))}
                    </Select>
                    {errors.award ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{errors.award}</p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="programCredits"
                    >
                      Credits
                    </label>
                    <Input
                      className={cn(
                        "h-12 rounded-2xl",
                        errors.credits
                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                          : ""
                      )}
                      disabled={isSaving}
                      id="programCredits"
                      min="1"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          credits: event.target.value,
                        }))
                      }
                      type="number"
                      value={form.credits}
                    />
                    <p className="mt-1.5 text-xs text-text/55">
                      Total credits required for the full program.
                    </p>
                    {errors.credits ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{errors.credits}</p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="programDuration"
                    >
                      Duration
                    </label>
                    <Select
                      className={cn(
                        "h-12 rounded-2xl",
                        errors.durationYears
                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                          : ""
                      )}
                      disabled={isSaving}
                      id="programDuration"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          durationYears: event.target.value,
                        }))
                      }
                      value={form.durationYears}
                    >
                      {DURATION_OPTIONS.map((duration) => (
                        <option key={duration.value} value={duration.value}>
                          {duration.label}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1.5 text-xs text-text/55">
                      Used for year-based academic planning and reporting.
                    </p>
                    {errors.durationYears ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.durationYears}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-white/90 px-6 py-4 sm:px-7">
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button
                  className="h-11 min-w-[112px] px-5"
                  disabled={isSaving}
                  onClick={closeModal}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 min-w-[148px] gap-2 px-5"
                  disabled={isSaving}
                  onClick={() => void saveProgram()}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Program
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting) setDeleteTargetCode(null);
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-[30px] border border-border bg-[rgba(255,255,255,0.95)] shadow-[0_28px_72px_rgba(15,23,42,0.24)]"
            role="dialog"
          >
            <div className="px-6 py-6 sm:px-7">
              <Badge variant="warning">Delete Program</Badge>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                Remove {deleteTarget.code}?
              </p>
              <p className="mt-2 text-sm leading-6 text-text/68">
                This removes the degree program record from the admin directory and
                cannot be undone.
              </p>

              <div className="mt-5 rounded-[24px] border border-red-200/80 bg-red-50/80 p-4">
                <p className="text-sm font-semibold text-heading">{deleteTarget.name}</p>
                <p className="mt-1 text-sm text-text/70">
                  Program code {deleteTarget.code}. Remove this only if the academic
                  structure record is no longer needed.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2.5 border-t border-border bg-white/90 px-6 py-4 sm:px-7">
              <Button
                className="h-11 min-w-[112px] px-5"
                disabled={isDeleting}
                onClick={() => setDeleteTargetCode(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[140px] gap-2 px-5"
                disabled={isDeleting}
                onClick={() => void confirmDelete()}
                variant="danger"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Program
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
