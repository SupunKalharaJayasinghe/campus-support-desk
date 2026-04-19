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
  Building2,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Loader2,
  ListFilter,
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

type FacultyStatus = "ACTIVE" | "INACTIVE";
type PageSize = 10 | 25 | 50 | 100;
type SummaryTone = "sky" | "teal" | "amber" | "green" | "rose" | "violet";

interface FacultyRecord {
  code: string;
  name: string;
  status: FacultyStatus;
  createdAt: string;
  updatedAt: string;
}

interface FacultyFormState {
  code: string;
  name: string;
  status: FacultyStatus;
}

interface FacultyFormErrors {
  code?: string;
  name?: string;
}

interface FacultyModalState {
  mode: "add" | "edit";
  targetCode?: string;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function emptyForm(): FacultyFormState {
  return {
    code: "",
    name: "",
    status: "ACTIVE",
  };
}

function statusVariant(status: FacultyStatus) {
  return status === "ACTIVE" ? "success" : "neutral";
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toISOString().slice(0, 10);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

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

export default function FacultyPage() {
  const { setActiveWindow } = useAdminContext();
  const { toast } = useToast();

  const [faculties, setFaculties] = useState<FacultyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | FacultyStatus>("");
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<FacultyModalState | null>(null);
  const [form, setForm] = useState<FacultyFormState>(emptyForm);
  const [errors, setErrors] = useState<FacultyFormErrors>({});
  const [deleteTargetCode, setDeleteTargetCode] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(searchQuery);
  const isOverlayOpen = Boolean(modal || deleteTargetCode);

  const closeModal = useCallback(() => {
    setModal(null);
    setForm(emptyForm());
    setErrors({});
  }, []);

  const loadFaculties = useCallback(
    async (options?: { background?: boolean; silent?: boolean }) => {
      if (!options?.background) {
        setIsLoading(true);
      }

      try {
        const response = await fetch("/api/faculties", {
          cache: "no-store",
        });
        const items = await readJson<FacultyRecord[]>(response);
        setFaculties(Array.isArray(items) ? items : []);
      } catch (error) {
        if (!options?.silent) {
          toast({
            title: "Failed",
            message: error instanceof Error ? error.message : "Failed to load faculties",
            variant: "error",
          });
          setFaculties([]);
        }
      } finally {
        if (!options?.background) {
          setIsLoading(false);
        }
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadFaculties();
  }, [loadFaculties]);

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
    if (!modal) {
      setActiveWindow(null);
      return;
    }

    setActiveWindow(modal.mode === "add" ? "Create Faculty" : "Edit Faculty");
  }, [modal, setActiveWindow]);

  useEffect(() => {
    return () => {
      setActiveWindow(null);
    };
  }, [setActiveWindow]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (deleteTargetCode && !isDeleting) {
        setDeleteTargetCode(null);
        return;
      }

      if (modal && !isSaving) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal, deleteTargetCode, isDeleting, isOverlayOpen, isSaving, modal]);

  const visibleFaculties = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();
    const filtered = faculties.filter((faculty) => {
      const matchesStatus = statusFilter ? faculty.status === statusFilter : true;
      const matchesSearch = normalizedQuery
        ? `${faculty.code} ${faculty.name}`.toLowerCase().includes(normalizedQuery)
        : true;

      return matchesStatus && matchesSearch;
    });

    return [...filtered].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [deferredSearch, faculties, statusFilter]);

  const totalCount = visibleFaculties.length;
  const directoryCount = faculties.length;
  const activeFacultyCount = useMemo(
    () => faculties.filter((faculty) => faculty.status === "ACTIVE").length,
    [faculties]
  );
  const inactiveFacultyCount = Math.max(0, directoryCount - activeFacultyCount);
  const latestUpdatedAt = useMemo(
    () =>
      faculties.reduce<string | null>((latest, faculty) => {
        if (!faculty.updatedAt) {
          return latest;
        }

        if (!latest || faculty.updatedAt.localeCompare(latest) > 0) {
          return faculty.updatedAt;
        }

        return latest;
      }, null),
    [faculties]
  );
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginatedFaculties = visibleFaculties.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const deleteTarget =
    deleteTargetCode === null
      ? null
      : faculties.find((faculty) => faculty.code === deleteTargetCode) ?? null;
  const filtersApplied = Boolean(searchQuery.trim() || statusFilter);
  const contentBlurClass = isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : "";
  const statusFilterLabel =
    statusFilter === "ACTIVE"
      ? "Active only"
      : statusFilter === "INACTIVE"
        ? "Inactive only"
        : "All statuses";

  const summaryCards: Array<{
    label: string;
    value: string;
    detail: string;
    tone: SummaryTone;
    icon: ComponentType<{ size?: number }>;
  }> = [
    {
      label: "Total Faculties",
      value: directoryCount.toLocaleString(),
      detail:
        directoryCount > 0
          ? `${activeFacultyCount.toLocaleString()} active faculty records`
          : "No faculty records created yet",
      tone: "teal",
      icon: Building2,
    },
    {
      label: "Active Faculties",
      value: activeFacultyCount.toLocaleString(),
      detail:
        directoryCount > 0
          ? `${Math.round((activeFacultyCount / directoryCount) * 100)}% of the directory is enabled`
          : "No active faculty records yet",
      tone: "green",
      icon: CheckCircle2,
    },
    {
      label: "Inactive Faculties",
      value: inactiveFacultyCount.toLocaleString(),
      detail:
        inactiveFacultyCount > 0
          ? "Hidden from active academic setup flows"
          : "All faculty records are currently active",
      tone: "amber",
      icon: X,
    },
    {
      label: "Latest Update",
      value: formatShortDate(latestUpdatedAt),
      detail:
        latestUpdatedAt !== null
          ? "Most recent faculty change recorded"
          : "No faculty updates recorded yet",
      tone: "sky",
      icon: Clock3,
    },
  ];

  const openAddModal = () => {
    setModal({ mode: "add" });
    setForm(emptyForm());
    setErrors({});
  };

  const openEditModal = (faculty: FacultyRecord) => {
    setModal({ mode: "edit", targetCode: faculty.code });
    setForm({
      code: faculty.code,
      name: faculty.name,
      status: faculty.status,
    });
    setErrors({});
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setPage(1);
  };

  const validateForm = () => {
    const nextErrors: FacultyFormErrors = {};
    const normalizedCode = normalizeCode(form.code.trim());
    const trimmedName = form.name.trim();

    if (!/^[A-Z]{2,6}$/.test(normalizedCode)) {
      nextErrors.code = "Use 2-6 uppercase letters";
    } else if (
      modal?.mode === "add" &&
      faculties.some((faculty) => faculty.code === normalizedCode)
    ) {
      nextErrors.code = "Faculty code already exists";
    }

    if (!trimmedName) {
      nextErrors.name = "Faculty name is required";
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
      code: normalizedCode,
      name: trimmedName,
      status: form.status,
    };
  };

  const saveFaculty = async () => {
    const payload = validateForm();

    if (!payload || !modal) {
      return;
    }

    setIsSaving(true);

    try {
      if (modal.mode === "add") {
        const response = await fetch("/api/faculties", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const savedFaculty = await readJson<FacultyRecord>(response);

        setFaculties((previous) => [savedFaculty, ...previous]);
      } else {
        const response = await fetch(
          `/api/faculties/${encodeURIComponent(modal.targetCode ?? payload.code)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: payload.name,
              status: payload.status,
            }),
          }
        );
        const savedFaculty = await readJson<FacultyRecord>(response);

        setFaculties((previous) =>
          previous.map((faculty) =>
            faculty.code === savedFaculty.code ? savedFaculty : faculty
          )
        );
      }

      toast({
        title: "Saved",
        message: "Saved successfully",
        variant: "success",
      });
      closeModal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save faculty";

      if (message === "Faculty code already exists") {
        setErrors((previous) => ({
          ...previous,
          code: "Faculty code already exists",
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
    if (!deleteTargetCode) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/faculties/${encodeURIComponent(deleteTargetCode)}`,
        {
          method: "DELETE",
        }
      );

      await readJson<{ ok: true }>(response);

      setDeleteTargetCode(null);
      setFaculties((previous) =>
        previous.filter((faculty) => faculty.code !== deleteTargetCode)
      );
      void loadFaculties({ background: true, silent: true });
      toast({
        title: "Deleted",
        message: "Faculty deleted successfully",
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
          Add Faculty
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
                  Faculty directory
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  Search, filter, and maintain faculty records from the same visual
                  language used across the updated admin dashboard.
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
                      : "Showing the full faculty directory"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-end">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Search
                </label>
                <div className="group flex h-14 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                  <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Search size={17} />
                  </span>
                  <input
                    aria-label="Search faculty"
                    className="h-full w-full border-0 bg-transparent pr-2 text-[15px] text-heading outline-none placeholder:text-text/48"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by faculty code or name"
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
                  Status
                </label>
                <div className="group relative flex h-14 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                  <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ListFilter size={16} />
                  </span>
                  <select
                    aria-label="Filter by status"
                    className="h-full w-full appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                    onChange={(event) => {
                      setStatusFilter(event.target.value as "" | FacultyStatus);
                      setPage(1);
                    }}
                    value={statusFilter}
                  >
                    <option value="">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                    size={17}
                  />
                </div>
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
            <p className="text-lg font-semibold text-heading">Faculty Records</p>
            <p className="mt-1 text-sm text-text/68">
              Review every faculty entry, monitor status, and manage actions from
              a cleaner table surface.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusFilter ? "primary" : "neutral"}>{statusFilterLabel}</Badge>
            {searchQuery.trim() ? (
              <Badge
                className="max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap"
                variant="primary"
              >
                Search: {searchQuery.trim()}
              </Badge>
            ) : null}
            {filtersApplied ? (
              <Button className="h-9 px-3 text-xs" onClick={resetFilters} variant="ghost">
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="overflow-hidden rounded-[28px] border border-border bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-[rgba(255,255,255,0.82)]">
                  <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    <th className="px-5 py-4">Faculty Code</th>
                    <th className="px-5 py-4">Faculty Name</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Last Updated</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {isLoading ? (
                    <tr>
                      <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={5}>
                        Loading faculty records...
                      </td>
                    </tr>
                  ) : null}

                  {!isLoading
                    ? paginatedFaculties.map((faculty) => (
                        <tr
                          className="transition-colors duration-200 hover:bg-white/70"
                          key={faculty.code}
                        >
                          <td className="px-5 py-4 align-top">
                            <div>
                              <p className="font-semibold text-heading">{faculty.code}</p>
                              <p className="mt-1 text-xs text-text/55">
                                Created {formatDate(faculty.createdAt)}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-medium text-heading">{faculty.name}</p>
                            <p className="mt-1 text-xs text-text/55">
                              Used across programs, intakes, and teaching setup
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="space-y-1.5">
                              <Badge variant={statusVariant(faculty.status)}>
                                {faculty.status}
                              </Badge>
                              <p className="text-xs text-text/55">
                                {faculty.status === "ACTIVE"
                                  ? "Available in admin workflows"
                                  : "Hidden from active setup flows"}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-medium text-heading">
                              {formatDate(faculty.updatedAt)}
                            </p>
                            <p className="mt-1 text-xs text-text/55">
                              Most recent record change
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex justify-end gap-2">
                              <button
                                aria-label={`Edit ${faculty.code}`}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-heading hover:shadow-shadow"
                                onClick={() => openEditModal(faculty)}
                                type="button"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                aria-label={`Delete ${faculty.code}`}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-red-200 hover:bg-white hover:text-red-600 hover:shadow-shadow"
                                onClick={() => setDeleteTargetCode(faculty.code)}
                                type="button"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    : null}

                  {!isLoading && paginatedFaculties.length === 0 ? (
                    <tr>
                      <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={5}>
                        No faculties match the current filters.
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

      {modal ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              closeModal();
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] border border-border bg-[rgba(255,255,255,0.94)] shadow-[0_32px_80px_rgba(15,23,42,0.24)]"
            role="dialog"
          >
            <div className="overflow-y-auto px-6 py-6 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-xl">
                  <Badge variant="neutral">
                    {modal.mode === "add" ? "Create Faculty" : "Edit Faculty"}
                  </Badge>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                    {modal.mode === "add"
                      ? "Add a new faculty"
                      : `Update ${modal.targetCode ?? "faculty"}`}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text/68">
                    Maintain the faculty code, display name, and status used across
                    academic structure screens.
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
                      htmlFor="facultyCode"
                    >
                      Faculty Code
                    </label>
                    <Input
                      className={cn(
                        "h-12 rounded-2xl",
                        errors.code
                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                          : ""
                      )}
                      disabled={modal.mode === "edit" || isSaving}
                      id="facultyCode"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          code: normalizeCode(event.target.value),
                        }))
                      }
                      placeholder="FOC"
                      value={form.code}
                    />
                    <p className="mt-1.5 text-xs text-text/55">
                      Use 2-6 uppercase letters. Example: FOC
                    </p>
                    {errors.code ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{errors.code}</p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="facultyStatus"
                    >
                      Status
                    </label>
                    <Select
                      aria-label="Faculty status"
                      className="h-12 rounded-2xl"
                      disabled={isSaving}
                      id="facultyStatus"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          status: event.target.value as FacultyStatus,
                        }))
                      }
                      value={form.status}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </Select>
                    <p className="mt-1.5 text-xs text-text/55">
                      Active faculties are shown in academic setup workflows.
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      className="mb-2 block text-sm font-medium text-heading"
                      htmlFor="facultyName"
                    >
                      Faculty Name
                    </label>
                    <Input
                      className={cn(
                        "h-12 rounded-2xl",
                        errors.name
                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                          : ""
                      )}
                      disabled={isSaving}
                      id="facultyName"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Faculty of Computing"
                      value={form.name}
                    />
                    <p className="mt-1.5 text-xs text-text/55">
                      This label appears in lists, selectors, and related admin pages.
                    </p>
                    {errors.name ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{errors.name}</p>
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
                  onClick={() => {
                    void saveFaculty();
                  }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Faculty
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
            if (event.target === event.currentTarget && !isDeleting) {
              setDeleteTargetCode(null);
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-[30px] border border-border bg-[rgba(255,255,255,0.95)] shadow-[0_28px_72px_rgba(15,23,42,0.24)]"
            role="dialog"
          >
            <div className="px-6 py-6 sm:px-7">
              <Badge variant="warning">Delete Faculty</Badge>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                Remove {deleteTarget.code}?
              </p>
              <p className="mt-2 text-sm leading-6 text-text/68">
                This removes the faculty record from the admin directory and cannot
                be undone.
              </p>

              <div className="mt-5 rounded-[24px] border border-red-200/80 bg-red-50/80 p-4">
                <p className="text-sm font-semibold text-heading">{deleteTarget.name}</p>
                <p className="mt-1 text-sm text-text/70">
                  Faculty code {deleteTarget.code}. Remove this only if the record is
                  no longer needed in academic setup flows.
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
                onClick={() => {
                  void confirmDelete();
                }}
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
                    Delete Faculty
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
