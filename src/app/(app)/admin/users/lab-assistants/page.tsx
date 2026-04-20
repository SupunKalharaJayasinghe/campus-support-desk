"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Users2,
  X,
} from "lucide-react";
import AdminSummaryCard from "@/components/admin/AdminSummaryCard";
import { useAdminContext } from "@/components/admin/AdminContext";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";

type LabAssistantStatus = "ACTIVE" | "INACTIVE";
type SortOption = "updated" | "created" | "az" | "za";
type PageSize = 10 | 25 | 50 | 100;

interface LabAssistantRecord {
  id: string;
  fullName: string;
  email: string;
  optionalEmail: string;
  phone: string;
  nicStaffId: string;
  status: LabAssistantStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
  updatedAt: string;
}

interface FacultyOption {
  code: string;
  name: string;
}
interface DegreeOption {
  code: string;
  name: string;
}
interface ModuleOption {
  id: string;
  code: string;
  name: string;
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeOptionalEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .slice(0, 254);
}

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function sanitizeStatus(value: unknown): LabAssistantStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function sanitizeCodeList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => normalizeCode(item)).filter(Boolean)));
}

function sanitizeIdList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toISOString().slice(0, 10);
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function emailPreview(name: string) {
  const local =
    collapseSpaces(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .replace(/\.{2,}/g, ".") || "lab.assistant";
  const domain = String(process.env.NEXT_PUBLIC_LAB_ASSISTANT_EMAIL_DOMAIN ?? "sllit.lk")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  return `${local}@${domain || "sllit.lk"}`;
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
  return (payload ?? ({} as T)) as T;
}

function parseLabAssistants(payload: unknown) {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];
  const items = rows
    .map((item) => {
      const row = asObject(item);
      if (!row) return null;
      const id = String(row.id ?? row._id ?? "").trim();
      const fullName = collapseSpaces(row.fullName);
      const email = String(row.email ?? "").trim().toLowerCase();
      if (!id || !fullName || !email) return null;
      return {
        id,
        fullName,
        email,
        optionalEmail: sanitizeOptionalEmail(row.optionalEmail),
        phone: collapseSpaces(row.phone),
        nicStaffId: String(row.nicStaffId ?? "").trim(),
        status: sanitizeStatus(row.status),
        facultyIds: sanitizeCodeList(row.facultyIds),
        degreeProgramIds: sanitizeCodeList(row.degreeProgramIds),
        moduleIds: sanitizeIdList(row.moduleIds),
        updatedAt: String(row.updatedAt ?? ""),
      } satisfies LabAssistantRecord;
    })
    .filter((row): row is LabAssistantRecord => Boolean(row));
  return {
    items,
    total: Math.max(0, Number(root?.total) || items.length),
    page: Math.max(1, Number(root?.page) || 1),
    pageSize: [10, 25, 50, 100].includes(Number(root?.pageSize))
      ? (Number(root?.pageSize) as PageSize)
      : 10,
  };
}

function Panel({
  label,
  options,
  selected,
  search,
  setSearch,
  toggle,
  disabled,
  helper,
  loading,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  search: string;
  setSearch: (value: string) => void;
  toggle: (id: string) => void;
  disabled?: boolean;
  helper: string;
  loading?: boolean;
}) {
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? options.filter((item) => item.label.toLowerCase().includes(query)) : options;
  }, [options, search]);

  return (
    <div className={cn("rounded-2xl border border-border bg-tint/60 p-3", disabled ? "opacity-70" : "")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">{label}</p>
        <span className="text-xs text-text/65">{selected.length} selected</span>
      </div>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/50" size={15} />
        <Input
          className="h-10 pl-9"
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${label.toLowerCase()}`}
          value={search}
        />
      </div>
      <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
        {disabled ? (
          <p className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-text/68">{helper}</p>
        ) : loading ? (
          <p className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-text/68">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-text/68">No options available.</p>
        ) : (
          filtered.map((item) => (
            <label className="inline-flex w-full items-start gap-2 rounded-xl border border-border bg-white px-2.5 py-2 text-sm text-heading" key={item.id}>
              <input
                checked={selected.includes(item.id)}
                className="mt-0.5 h-4 w-4 rounded border-border"
                onChange={() => toggle(item.id)}
                type="checkbox"
              />
              {item.label}
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export default function LabAssistantsPage() {
  const { setActiveWindow } = useAdminContext();
  const { toast } = useToast();
  const [items, setItems] = useState<LabAssistantRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | LabAssistantStatus>("");
  const [sort, setSort] = useState<SortOption>("updated");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [loadingDegrees, setLoadingDegrees] = useState(false);
  const [loadingModules, setLoadingModules] = useState(false);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; id?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LabAssistantRecord | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    optionalEmail: "",
    phone: "",
    nicStaffId: "",
    status: "ACTIVE" as LabAssistantStatus,
    facultyIds: [] as string[],
    degreeProgramIds: [] as string[],
    moduleIds: [] as string[],
  });
  const [formError, setFormError] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [dSearch, setDSearch] = useState("");
  const [mSearch, setMSearch] = useState("");
  const deferredQuery = useDeferredValue(query);
  const overlayOpen = Boolean(modal || deleteTarget);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
      if (deferredQuery.trim()) params.set("search", deferredQuery.trim());
      if (status) params.set("status", status);
      const parsed = parseLabAssistants(
        await readJson(await fetch(`/api/lab-assistants?${params.toString()}`, { cache: "no-store" }))
      );
      setItems(parsed.items);
      setTotal(parsed.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      toast({ title: "Failed", message: error instanceof Error ? error.message : "Failed to load lab assistants", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [deferredQuery, page, pageSize, sort, status, toast]);

  const loadFaculties = useCallback(async () => {
    try {
      const rows = (await readJson(await fetch("/api/faculties", { cache: "no-store" }))) as unknown[];
      const parsed = Array.isArray(rows)
        ? rows
            .map((row) => {
              const value = asObject(row);
              const code = normalizeCode(value?.code);
              if (!value || !code) return null;
              return { code, name: collapseSpaces(value.name) } satisfies FacultyOption;
            })
            .filter((item): item is FacultyOption => Boolean(item))
        : [];
      setFaculties(parsed);
    } catch {
      setFaculties([]);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);
  useEffect(() => {
    void loadFaculties();
  }, [loadFaculties]);
  useEffect(() => {
    if (!modal) return;
    if (form.facultyIds.length === 0) {
      setDegrees([]);
      setModules([]);
      setForm((prev) => ({ ...prev, degreeProgramIds: [], moduleIds: [] }));
      return;
    }
    setLoadingDegrees(true);
    const params = new URLSearchParams({ facultyIds: form.facultyIds.join(","), status: "ACTIVE" });
    void fetch(`/api/degrees?${params.toString()}`, { cache: "no-store" })
      .then((res) => readJson(res))
      .then((payload) => {
        const root = asObject(payload);
        const rows = Array.isArray(root?.items) ? root.items : [];
        const parsed = rows
          .map((row) => {
            const value = asObject(row);
            const code = normalizeCode(value?.code);
            if (!value || !code) return null;
            return { code, name: collapseSpaces(value.name) } as DegreeOption;
          })
          .filter((item): item is DegreeOption => Boolean(item));
        setDegrees(parsed);
        const allow = new Set(parsed.map((item) => item.code));
        setForm((prev) => ({ ...prev, degreeProgramIds: prev.degreeProgramIds.filter((id) => allow.has(id)) }));
      })
      .catch(() => setDegrees([]))
      .finally(() => setLoadingDegrees(false));
  }, [form.facultyIds, modal]);
  useEffect(() => {
    if (!modal) return;
    if (form.degreeProgramIds.length === 0) {
      setModules([]);
      setForm((prev) => ({ ...prev, moduleIds: [] }));
      return;
    }
    setLoadingModules(true);
    const params = new URLSearchParams({ page: "1", pageSize: "100", sort: "az", facultyIds: form.facultyIds.join(","), degreeIds: form.degreeProgramIds.join(",") });
    void fetch(`/api/modules?${params.toString()}`, { cache: "no-store" })
      .then((res) => readJson(res))
      .then((payload) => {
        const root = asObject(payload);
        const rows = Array.isArray(root?.items) ? root.items : [];
        const parsed = rows
          .map((row) => {
            const value = asObject(row);
            const id = String(value?.id ?? "").trim();
            const code = String(value?.code ?? "").trim().toUpperCase();
            if (!value || !id || !code) return null;
            return { id, code, name: collapseSpaces(value.name) } as ModuleOption;
          })
          .filter((item): item is ModuleOption => Boolean(item));
        setModules(parsed);
        const allow = new Set(parsed.map((item) => item.id));
        setForm((prev) => ({ ...prev, moduleIds: prev.moduleIds.filter((id) => allow.has(id)) }));
      })
      .catch(() => setModules([]))
      .finally(() => setLoadingModules(false));
  }, [form.degreeProgramIds, form.facultyIds, modal]);
  useEffect(() => {
    if (!overlayOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [overlayOpen]);
  useEffect(() => {
    setActiveWindow(modal ? (modal.mode === "add" ? "Create" : "Edit") : "List");
  }, [modal, setActiveWindow]);
  useEffect(() => () => setActiveWindow(null), [setActiveWindow]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const facultyOpts = faculties.map((item) => ({ id: item.code, label: `${item.code} - ${item.name}` }));
  const degreeOpts = degrees.map((item) => ({ id: item.code, label: `${item.code} - ${item.name}` }));
  const moduleOpts = modules.map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
  const contentBlurClass = overlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : "";
  const activeFilterCount = Number(Boolean(status));
  const filtersApplied = Boolean(query.trim() || activeFilterCount > 0);
  const activeAssistantsCount = useMemo(
    () => items.filter((item) => item.status === "ACTIVE").length,
    [items]
  );
  const scopedModuleCount = useMemo(
    () => new Set(items.flatMap((item) => item.moduleIds)).size,
    [items]
  );
  const latestUpdatedAt = useMemo(
    () =>
      items.reduce<string | null>((latest, item) => {
        if (!item.updatedAt) return latest;
        if (!latest || item.updatedAt.localeCompare(latest) > 0) {
          return item.updatedAt;
        }
        return latest;
      }, null),
    [items]
  );
  const sortLabel =
    sort === "updated"
      ? "Recently Updated"
      : sort === "created"
        ? "Recently Added"
        : sort === "az"
          ? "A-Z"
          : "Z-A";

  const openAdd = () => {
    setModal({ mode: "add" });
    setForm({ fullName: "", email: "", optionalEmail: "", phone: "", nicStaffId: "", status: "ACTIVE", facultyIds: [], degreeProgramIds: [], moduleIds: [] });
    setFormError("");
  };

  const openEdit = (row: LabAssistantRecord) => {
    setModal({ mode: "edit", id: row.id });
    setForm({
      fullName: row.fullName,
      email: row.email,
      optionalEmail: row.optionalEmail,
      phone: row.phone,
      nicStaffId: row.nicStaffId,
      status: row.status,
      facultyIds: [...row.facultyIds],
      degreeProgramIds: [...row.degreeProgramIds],
      moduleIds: [...row.moduleIds],
    });
    setFormError("");
  };

  const closeModal = () => {
    if (!saving) setModal(null);
  };

  const save = async () => {
    const fullName = collapseSpaces(form.fullName);
    // Frontend validation: lab assistant must have a display name.
    if (!fullName) {
      setFormError("Full name is required");
      return;
    }
    setSaving(true);
    try {
      // Scope lists are optional, but notify when saving an unrestricted assistant.
      if (form.facultyIds.length === 0 && form.degreeProgramIds.length === 0 && form.moduleIds.length === 0) {
        toast({ title: "No support scope selected", message: "Lab assistant will be saved without eligibility restrictions.", variant: "info" });
      }
      await readJson(await fetch(modal?.mode === "add" ? "/api/lab-assistants" : `/api/lab-assistants/${encodeURIComponent(String(modal?.id ?? ""))}`, {
        method: modal?.mode === "add" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, optionalEmail: sanitizeOptionalEmail(form.optionalEmail), phone: collapseSpaces(form.phone), nicStaffId: collapseSpaces(form.nicStaffId), status: form.status, facultyIds: form.facultyIds, degreeProgramIds: form.degreeProgramIds, moduleIds: form.moduleIds }),
      }));
      toast({ title: "Saved", message: modal?.mode === "add" ? "Lab assistant created" : "Lab assistant updated", variant: "success" });
      setModal(null);
      await loadItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save lab assistant";
      setFormError(message);
      toast({ title: "Failed", message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <div className={cn("flex justify-end", contentBlurClass)}>
        <Button className="h-11 gap-2 px-5" onClick={openAdd}>
          <Plus size={16} />
          Add Lab Assistant
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
                <Badge variant="neutral">User Management</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                  Lab assistant directory
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  Manage lab assistant profiles and practical support eligibility scope using the
                  same updated admin surface used across the academic directory pages.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[190px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Visible Results
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                    {total.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    {filtersApplied
                      ? "Matching the current search and filters"
                      : "Showing the full lab assistant directory"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-end">
                <div className="min-w-0 flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Search
                  </label>
                  <div className="group flex h-14 min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Search size={17} />
                    </span>
                    <input
                      aria-label="Search lab assistants"
                      className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-[15px] text-heading outline-none placeholder:text-text/48"
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by name, email, or staff id"
                      value={query}
                    />
                    {query.trim() ? (
                      <button
                        aria-label="Clear search"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text/45 transition-colors hover:bg-primary/8 hover:text-primary"
                        onClick={() => {
                          setQuery("");
                          setPage(1);
                        }}
                        type="button"
                      >
                        <X size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0 flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Sort
                  </label>
                  <div className="group relative flex h-14 w-full items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ArrowUpDown size={16} />
                    </span>
                    <select
                      aria-label="Sort lab assistants"
                      className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      onChange={(event) => {
                        setSort(event.target.value as SortOption);
                        setPage(1);
                      }}
                      value={sort}
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Status
                  </label>
                  <div className="relative flex h-14 min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <select
                      aria-label="Filter lab assistants by status"
                      className="h-full w-full appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      onChange={(event) => {
                        setStatus(event.target.value as "" | LabAssistantStatus);
                        setPage(1);
                      }}
                      value={status}
                    >
                      <option value="">All statuses</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={activeFilterCount > 0 ? "primary" : "neutral"}>
                {activeFilterCount > 0 ? `${activeFilterCount} filters applied` : "No extra filters"}
              </Badge>
              <Badge variant="neutral">{sortLabel}</Badge>
              {query.trim() ? (
                <Badge
                  className="max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap"
                  variant="primary"
                >
                  Search: {query.trim()}
                </Badge>
              ) : null}
              {filtersApplied ? (
                <Button
                  className="h-9 px-3 text-xs"
                  onClick={() => {
                    setQuery("");
                    setStatus("");
                    setSort("updated");
                    setPage(1);
                  }}
                  variant="ghost"
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminSummaryCard
            detail={`${items.length.toLocaleString()} rows loaded on this page`}
            icon={Users2}
            label="Total Assistants"
            tone="sky"
            value={total.toLocaleString()}
          />
          <AdminSummaryCard
            detail={
              activeAssistantsCount > 0
                ? `${activeAssistantsCount.toLocaleString()} active support records in view`
                : "No active support records in the current view"
            }
            icon={CheckCircle2}
            label="Active Assistants"
            tone="green"
            value={activeAssistantsCount.toLocaleString()}
          />
          <AdminSummaryCard
            detail={
              scopedModuleCount > 0
                ? `${scopedModuleCount.toLocaleString()} support modules linked across visible assistants`
                : "No support modules linked in the current view"
            }
            icon={BookOpen}
            label="Support Modules"
            tone="violet"
            value={scopedModuleCount.toLocaleString()}
          />
          <AdminSummaryCard
            detail={
              latestUpdatedAt
                ? "Most recent visible lab assistant profile change"
                : "No lab assistant updates loaded yet"
            }
            icon={Clock3}
            label="Latest Update"
            tone="amber"
            value={formatShortDate(latestUpdatedAt)}
          />
        </div>
      </section>

      <Card className={cn("overflow-hidden p-0 transition-all", contentBlurClass)}>
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-heading">Lab Assistant Records</p>
            <p className="mt-1 text-sm text-text/68">
              Review support identity, contact details, active state, and scoped module coverage
              from a cleaner table surface.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={activeFilterCount > 0 ? "primary" : "neutral"}>
              {activeFilterCount > 0 ? `${activeFilterCount} filters applied` : "No extra filters"}
            </Badge>
            <Badge variant="neutral">{sortLabel}</Badge>
            {query.trim() ? (
              <Badge
                className="max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap"
                variant="primary"
              >
                Search: {query.trim()}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="overflow-hidden rounded-[28px] border border-border bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-border bg-tint"><tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60"><th className="px-4 py-3">Lab Assistant</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Support Scope</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td className="px-4 py-10 text-center text-sm text-text/68" colSpan={7}>Loading lab assistants...</td></tr> : items.length === 0 ? <tr><td className="px-4 py-10 text-center text-sm text-text/68" colSpan={7}>No lab assistants match the current filters.</td></tr> : items.map((row) => (
                <tr className="border-b border-border/70 hover:bg-tint" key={row.id}>
                  <td className="px-4 py-4"><p className="font-semibold text-heading"><Link className="text-[#034aa6] hover:text-[#0339a6]" href={`/admin/users/lab-assistants/${encodeURIComponent(row.id)}`}>{row.fullName}</Link></p>{row.nicStaffId ? <p className="text-xs text-text/62">{row.nicStaffId}</p> : null}</td>
                  <td className="px-4 py-4 text-text/78">{row.email}</td>
                  <td className="px-4 py-4 text-text/78">{row.phone || "—"}</td>
                  <td className="px-4 py-4"><Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>{row.status}</Badge></td>
                  <td className="px-4 py-4 text-text/78">F:{row.facultyIds.length} / D:{row.degreeProgramIds.length} / M:{row.moduleIds.length}</td>
                  <td className="px-4 py-4 text-text/70">{formatDate(row.updatedAt)}</td>
                  <td className="px-4 py-4"><div className="flex justify-end gap-2"><button aria-label={`Edit ${row.fullName}`} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading" onClick={() => openEdit(row)} type="button"><Pencil size={16} /></button><button aria-label={`Delete ${row.fullName}`} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading" onClick={() => setDeleteTarget(row)} type="button"><Trash2 size={16} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          </div>
        </div>
        <TablePagination className="mt-0 px-6 pb-6" onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value as PageSize); setPage(1); }} page={safePage} pageCount={pageCount} pageSize={pageSize} totalItems={total} />
      </Card>
      {modal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) closeModal(); }} role="presentation">
          <div aria-modal="true" className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]" role="dialog">
            <div className="overflow-y-auto px-6 py-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">{modal.mode === "add" ? "CREATE" : "EDIT"}</p><p className="mt-1 text-2xl font-semibold text-heading">{modal.mode === "add" ? "Add Lab Assistant" : "Edit Lab Assistant"}</p></div><button className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading" disabled={saving} onClick={closeModal} type="button"><X size={16} /></button></div>
              <div className="mt-6"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Basic Info</p><div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div><label className="mb-1.5 block text-sm font-medium text-heading">Full Name</label><Input className="h-12" disabled={saving} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value, email: modal.mode === "add" ? emailPreview(e.target.value) : p.email }))} value={form.fullName} /></div>
                <div><label className="mb-1.5 block text-sm font-medium text-heading">Email (Auto)</label><Input className="h-12" disabled value={modal.mode === "add" ? form.email || emailPreview(form.fullName) : form.email} /></div>
                <div><label className="mb-1.5 block text-sm font-medium text-heading">Optional Email</label><Input className="h-12" disabled={saving} onChange={(e) => setForm((p) => ({ ...p, optionalEmail: sanitizeOptionalEmail(e.target.value) }))} placeholder="Optional" type="email" value={form.optionalEmail} /></div>
                <div><label className="mb-1.5 block text-sm font-medium text-heading">Phone</label><Input className="h-12" disabled={saving} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} value={form.phone} /></div>
                <div><label className="mb-1.5 block text-sm font-medium text-heading">NIC / Staff ID</label><Input className="h-12" disabled={saving} onChange={(e) => setForm((p) => ({ ...p, nicStaffId: e.target.value }))} value={form.nicStaffId} /></div>
                <div><label className="mb-1.5 block text-sm font-medium text-heading">Status</label><Select className="h-12" disabled={saving} onChange={(e) => setForm((p) => ({ ...p, status: sanitizeStatus(e.target.value) }))} value={form.status}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></Select></div>
              </div></div>
              <div className="mt-6"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Support Eligibility</p><div className="mt-3 grid gap-4 lg:grid-cols-3">
                <Panel helper="Unavailable" label="Faculties" loading={false} options={facultyOpts} search={fSearch} selected={form.facultyIds} setSearch={setFSearch} toggle={(id) => setForm((p) => ({ ...p, facultyIds: p.facultyIds.includes(id) ? p.facultyIds.filter((x) => x !== id) : [...p.facultyIds, id] }))} />
                <Panel disabled={saving || form.facultyIds.length === 0} helper="Select at least one faculty to load degrees." label="Degrees" loading={loadingDegrees} options={degreeOpts} search={dSearch} selected={form.degreeProgramIds} setSearch={setDSearch} toggle={(id) => setForm((p) => ({ ...p, degreeProgramIds: p.degreeProgramIds.includes(id) ? p.degreeProgramIds.filter((x) => x !== id) : [...p.degreeProgramIds, id] }))} />
                <Panel disabled={saving || form.degreeProgramIds.length === 0} helper="Select at least one degree to load modules." label="Modules" loading={loadingModules} options={moduleOpts} search={mSearch} selected={form.moduleIds} setSearch={setMSearch} toggle={(id) => setForm((p) => ({ ...p, moduleIds: p.moduleIds.includes(id) ? p.moduleIds.filter((x) => x !== id) : [...p.moduleIds, id] }))} />
              </div></div>
              {formError ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
            </div>
            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-white px-6 py-4"><div className="flex flex-wrap items-center justify-end gap-2.5"><Button className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50" disabled={saving} onClick={closeModal} variant="secondary">Cancel</Button><Button className="h-11 min-w-[132px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]" disabled={saving} onClick={() => { void save(); }}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Save</Button></div></div>
          </div>
        </div>
      ) : null}
      {deleteTarget ? <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null); }} role="presentation"><div aria-modal="true" className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]" role="dialog"><div className="px-6 py-6"><p className="text-lg font-semibold text-heading">Delete Lab Assistant</p><p className="mt-2 text-sm leading-6 text-text/70">Delete lab assistant <span className="font-semibold text-heading">{deleteTarget.fullName}</span>? This action cannot be undone.</p></div><div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4"><Button className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50" disabled={deleting} onClick={() => setDeleteTarget(null)} variant="secondary">Cancel</Button><Button className="h-11 min-w-[132px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700" disabled={deleting} onClick={() => { void (async () => { setDeleting(true); try { await readJson(await fetch(`/api/lab-assistants/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" })); toast({ title: "Deleted", message: "Lab assistant deleted successfully", variant: "success" }); setDeleteTarget(null); await loadItems(); } catch (error) { toast({ title: "Failed", message: error instanceof Error ? error.message : "Failed to delete lab assistant", variant: "error" }); } finally { setDeleting(false); } })(); }}>{deleting ? <><Loader2 className="animate-spin" size={16} />Deleting...</> : <><Trash2 size={16} />Delete</>}</Button></div></div></div> : null}
    </div>
  );
}
