"use client";

import { useCallback, useDeferredValue, useEffect, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
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

type ProgramStatus = "ACTIVE" | "INACTIVE" | "DRAFT";
type SortOption = "az" | "za" | "updated" | "created";
type PageSize = 10 | 25 | 50 | 100;

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
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toISOString().slice(0, 10);
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

  const validateForm = () => {
    const nextErrors: ProgramFormErrors = {};
    const code = normalizeCode(form.code.trim());
    const name = form.name.trim();
    const award = form.award.trim();
    const credits = Number(form.credits);
    const durationYears = Number(form.durationYears);

    // Frontend validation for degree setup before API save.
    if (!/^[A-Z]{2,6}$/.test(code)) nextErrors.code = "Use 2–6 uppercase letters";
    if (!name) nextErrors.name = "Program name is required";
    if (!form.facultyCode) nextErrors.facultyCode = "Select a faculty";
    if (!award) nextErrors.award = "Award is required";
    if (!Number.isFinite(credits) || credits <= 0) nextErrors.credits = "Enter valid credits";
    if (!Number.isFinite(durationYears) || durationYears <= 0) nextErrors.durationYears = "Select a valid duration";

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
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <Button
            className="h-11 min-w-[164px] justify-center gap-2 rounded-2xl bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] transition-colors hover:bg-[#0339a6]"
            onClick={openAddModal}
          >
            <Plus size={16} />
            Add Program
          </Button>
        }
        description="Define degree programs, credit requirements and curriculum structures."
        title="Degree Programs"
      />

      <Card className={cn("transition-all", isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : "")}>
        <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_220px_220px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/50" size={16} />
                <Input
                  aria-label="Search degree programs"
                  className="h-12 pl-10"
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by program code or name"
                  value={searchQuery}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Filters</label>
              <Button
                className="h-12 justify-start gap-2 border-slate-300 bg-white px-4 text-heading hover:bg-slate-50"
                onClick={openFiltersModal}
                variant="secondary"
              >
                <SlidersHorizontal size={16} />
                {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Sort</label>
              <Select
                aria-label="Sort degree programs"
                className="h-12"
                onChange={(event) => {
                  setSortBy(event.target.value as SortOption);
                  setPage(1);
                }}
                value={sortBy}
              >
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
                <option value="updated">Recently Updated</option>
                <option value="created">Recently Added</option>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-tint px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">Total Programs</p>
            <p className="mt-1 text-2xl font-semibold text-heading">{totalCount}</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-tint">
              <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Faculty</th>
                <th className="px-4 py-3">Award</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={8}>
                    Loading degree programs…
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? items.map((program) => (
                    <tr className="border-b border-border/70 transition-colors hover:bg-tint" key={program.code}>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-heading">{program.code}</span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-heading">{program.name}</p>
                        <p className="mt-0.5 text-xs text-text/60">Updated {formatDate(program.updatedAt)}</p>
                      </td>
                      <td className="px-4 py-4 text-text/78">{program.facultyCode}</td>
                      <td className="px-4 py-4 text-text/78">{program.award}</td>
                      <td className="px-4 py-4 text-text/78">{program.credits}</td>
                      <td className="px-4 py-4 text-text/78">{program.durationYears} yrs</td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant(program.status)}>{statusLabel(program.status)}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            aria-label={`Edit ${program.code}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
                            onClick={() => openEditModal(program)}
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            aria-label={`Delete ${program.code}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
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
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={8}>
                    No degree programs match the current filters.
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

      {isFiltersOpen ? (
        <div
          className="fixed inset-0 z-[92] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeFilters();
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.24)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">FILTERS</p>
                <p className="mt-1 text-2xl font-semibold text-heading">Filter Degree Programs</p>
                <p className="mt-1 text-sm text-text/65">Refine the list using faculty, award, credits, and status.</p>
              </div>
              <button
                aria-label="Close filters"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading"
                onClick={closeFilters}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="filterFaculty">Faculty</label>
                  <Select
                    className="h-12"
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
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="filterProgramCode">Program Code</label>
                  <Input
                    className="h-12"
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
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="filterAward">Award</label>
                  <Select
                    className="h-12"
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
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="filterDuration">Duration</label>
                  <Select
                    className="h-12"
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
                  <label className="mb-1.5 block text-sm font-medium text-heading">Credits Range</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      className="h-12"
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
                      className="h-12"
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
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="filterStatus">Status</label>
                  <Select
                    className="h-12"
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

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-white px-6 py-4 shadow-[0_-1px_0_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button
                  className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                  onClick={clearFilters}
                  variant="secondary"
                >
                  Clear
                </Button>
                <Button
                  className="h-11 min-w-[148px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
                  onClick={applyFilters}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) closeModal();
          }}
          role="presentation"
        >
          <div aria-modal="true" className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]" role="dialog">
            <div className="overflow-y-auto px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">{modal.mode === "add" ? "CREATE" : "EDIT"}</p>
                  <p className="mt-1 text-2xl font-semibold text-heading">{modal.mode === "add" ? "Add Program" : "Edit Program"}</p>
                  <p className="mt-1 text-sm text-text/65">Scope: Super Admin / Academic Structure / Degree Programs</p>
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

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="programCode">Program Code</label>
                  <Input className={cn("h-12", errors.code ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200" : "")} disabled={modal.mode === "edit" || isSaving} id="programCode" onChange={(event) => setForm((previous) => ({ ...previous, code: normalizeCode(event.target.value) }))} placeholder="SE" value={form.code} />
                  {errors.code ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.code}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="programStatus">Status</label>
                  <Select className="h-12" disabled={isSaving} id="programStatus" onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value as ProgramStatus }))} value={form.status}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="DRAFT">Draft</option>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="programName">Program Name</label>
                  <Input className={cn("h-12", errors.name ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200" : "")} disabled={isSaving} id="programName" onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="BSc Software Engineering" value={form.name} />
                  {errors.name ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.name}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="programFaculty">Faculty</label>
                  <Select className={cn("h-12", errors.facultyCode ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200" : "")} disabled={isSaving} id="programFaculty" onChange={(event) => setForm((previous) => ({ ...previous, facultyCode: event.target.value }))} value={form.facultyCode}>
                    <option value="">Select Faculty</option>
                    {facultyOptions.map((faculty) => (
                      <option key={faculty.code} value={faculty.code}>{faculty.code}</option>
                    ))}
                  </Select>
                  {errors.facultyCode ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.facultyCode}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="programAward">Award</label>
                  <Select className={cn("h-12", errors.award ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200" : "")} disabled={isSaving} id="programAward" onChange={(event) => setForm((previous) => ({ ...previous, award: event.target.value }))} value={form.award}>
                    {AWARD_OPTIONS.map((award) => (
                      <option key={award} value={award}>{award}</option>
                    ))}
                  </Select>
                  {errors.award ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.award}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="programCredits">Credits</label>
                  <Input className={cn("h-12", errors.credits ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200" : "")} disabled={isSaving} id="programCredits" min="1" onChange={(event) => setForm((previous) => ({ ...previous, credits: event.target.value }))} type="number" value={form.credits} />
                  {errors.credits ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.credits}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="programDuration">Duration</label>
                  <Select className={cn("h-12", errors.durationYears ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200" : "")} disabled={isSaving} id="programDuration" onChange={(event) => setForm((previous) => ({ ...previous, durationYears: event.target.value }))} value={form.durationYears}>
                    {DURATION_OPTIONS.map((duration) => (
                      <option key={duration.value} value={duration.value}>{duration.label}</option>
                    ))}
                  </Select>
                  {errors.durationYears ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.durationYears}</p> : null}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-white px-6 py-4 shadow-[0_-1px_0_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50" disabled={isSaving} onClick={closeModal} variant="secondary">
                  Cancel
                </Button>
                <Button className="h-11 min-w-[132px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]" disabled={isSaving} onClick={() => void saveProgram()}>
                  <Save size={16} />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting) setDeleteTargetCode(null);
          }}
          role="presentation"
        >
          <div aria-modal="true" className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]" role="dialog">
            <div className="px-6 py-6">
              <p className="text-lg font-semibold text-heading">Delete Program</p>
              <p className="mt-2 text-sm leading-6 text-text/70">
                Are you sure you want to delete program <span className="font-semibold text-heading">&lsquo;{deleteTarget.code}&rsquo; ({deleteTarget.name})</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
              <Button className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50" disabled={isDeleting} onClick={() => setDeleteTargetCode(null)} variant="secondary">
                Cancel
              </Button>
              <Button className="h-11 min-w-[132px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700" disabled={isDeleting} onClick={() => void confirmDelete()}>
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
