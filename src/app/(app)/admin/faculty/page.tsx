"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import PageHeader from "@/components/admin/PageHeader";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";

type FacultyStatus = "ACTIVE" | "INACTIVE";
type SortOption = "updated" | "created" | "az" | "za";
type PageSize = 10 | 25 | 50 | 100;

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
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

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

export default function FacultyPage() {
  const { setActiveWindow } = useAdminContext();
  const { toast } = useToast();

  const [faculties, setFaculties] = useState<FacultyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | FacultyStatus>("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
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

  const loadFaculties = useCallback(async (options?: { background?: boolean; silent?: boolean }) => {
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
          message:
            error instanceof Error ? error.message : "Failed to load faculties",
          variant: "error",
        });
        setFaculties([]);
      }
    } finally {
      if (!options?.background) {
        setIsLoading(false);
      }
    }
  }, [toast]);

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
  }, [
    closeModal,
    deleteTargetCode,
    isDeleting,
    isOverlayOpen,
    isSaving,
    modal,
  ]);

  const visibleFaculties = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();
    const filtered = faculties.filter((faculty) => {
      const matchesStatus = statusFilter ? faculty.status === statusFilter : true;
      const matchesSearch = normalizedQuery
        ? `${faculty.code} ${faculty.name}`.toLowerCase().includes(normalizedQuery)
        : true;

      return matchesStatus && matchesSearch;
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === "az") {
        return left.code.localeCompare(right.code);
      }

      if (sortBy === "za") {
        return right.code.localeCompare(left.code);
      }

      if (sortBy === "created") {
        return right.createdAt.localeCompare(left.createdAt);
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [deferredSearch, faculties, sortBy, statusFilter]);

  const totalCount = visibleFaculties.length;
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

  // Frontend validation for faculty create/edit form.
  const validateForm = () => {
    const nextErrors: FacultyFormErrors = {};
    const normalizedCode = normalizeCode(form.code.trim());
    const trimmedName = form.name.trim();

    if (!/^[A-Z]{2,6}$/.test(normalizedCode)) {
      nextErrors.code = "Use 2–6 uppercase letters";
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
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <Button
            className="h-11 min-w-[164px] justify-center gap-2 rounded-2xl bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] transition-colors hover:bg-[#0339a6]"
            onClick={openAddModal}
          >
            <Plus size={16} />
            Add Faculty
          </Button>
        }
        description="Manage faculty list and settings"
        title="Faculties"
      />

      <Card
        className={cn(
          "transition-all",
          isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : ""
        )}
      >
        <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_220px_220px]">
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
                  aria-label="Search faculty"
                  className="h-12 pl-10"
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by faculty code or name"
                  value={searchQuery}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Status
              </label>
              <Select
                aria-label="Filter by status"
                className="h-12"
                onChange={(event) => {
                  setStatusFilter(event.target.value as "" | FacultyStatus);
                  setPage(1);
                }}
                value={statusFilter}
              >
                <option value="">All</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Sort
              </label>
              <Select
                aria-label="Sort faculties"
                className="h-12"
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
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-tint px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
              Total Faculties
            </p>
            <p className="mt-1 text-2xl font-semibold text-heading">{totalCount}</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border bg-tint">
              <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                <th className="px-4 py-3">Faculty Code</th>
                <th className="px-4 py-3">Faculty Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={5}>
                    Loading faculty records…
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? paginatedFaculties.map((faculty) => (
                    <tr
                      className="border-b border-border/70 transition-colors hover:bg-tint"
                      key={faculty.code}
                    >
                      <td className="px-4 py-4">
                        <span className="font-semibold text-heading">{faculty.code}</span>
                      </td>
                      <td className="px-4 py-4 text-text/78">{faculty.name}</td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant(faculty.status)}>{faculty.status}</Badge>
                      </td>
                      <td className="px-4 py-4 text-text/70">
                        {formatDate(faculty.updatedAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            aria-label={`Edit ${faculty.code}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
                            onClick={() => openEditModal(faculty)}
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            aria-label={`Delete ${faculty.code}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
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
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={5}>
                    No faculties match the current filters.
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
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              closeModal();
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]"
            role="dialog"
          >
            <div className="overflow-y-auto px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                    {modal.mode === "add" ? "CREATE" : "EDIT"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-heading">
                    {modal.mode === "add" ? "Add Faculty" : "Edit Faculty"}
                  </p>
                  <p className="mt-1 text-sm text-text/65">
                    Scope: Super Admin / Academic Structure / Faculties
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

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium text-heading"
                    htmlFor="facultyCode"
                  >
                    Faculty Code
                  </label>
                  <Input
                    className={cn(
                      "h-12",
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
                  {errors.code ? (
                    <p className="mt-1.5 text-xs font-medium text-red-600">{errors.code}</p>
                  ) : null}
                </div>

                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium text-heading"
                    htmlFor="facultyStatus"
                  >
                    Status
                  </label>
                  <Select
                    aria-label="Faculty status"
                    className="h-12"
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
                </div>

                <div className="sm:col-span-2">
                  <label
                    className="mb-1.5 block text-sm font-medium text-heading"
                    htmlFor="facultyName"
                  >
                    Faculty Name
                  </label>
                  <Input
                    className={cn(
                      "h-12",
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
                  {errors.name ? (
                    <p className="mt-1.5 text-xs font-medium text-red-600">{errors.name}</p>
                  ) : null}
                </div>
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
                  onClick={() => {
                    void saveFaculty();
                  }}
                >
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
            if (event.target === event.currentTarget && !isDeleting) {
              setDeleteTargetCode(null);
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]"
            role="dialog"
          >
            <div className="px-6 py-6">
              <p className="text-lg font-semibold text-heading">Delete Faculty</p>
              <p className="mt-2 text-sm leading-6 text-text/70">
                Are you sure you want to delete faculty{" "}
                <span className="font-semibold text-heading">
                  &lsquo;{deleteTarget.code}&rsquo; ({deleteTarget.name})
                </span>
                ? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
              <Button
                className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                disabled={isDeleting}
                onClick={() => setDeleteTargetCode(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[132px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700"
                disabled={isDeleting}
                onClick={() => {
                  void confirmDelete();
                }}
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
