"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Clock3,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
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

type AdminRole = "ADMIN" | "LOST_ITEM_ADMIN";
type AdminStatus = "ACTIVE" | "INACTIVE";
type SortOption = "updated" | "created" | "az" | "za";
type PageSize = 10 | 25 | 50 | 100;

interface AdminUserRecord {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  mustChangePassword: boolean;
  updatedAt: string;
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .slice(0, 254);
}

function sanitizeUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .slice(0, 64);
}

function sanitizeRole(value: unknown): AdminRole {
  return String(value ?? "").trim().toUpperCase() === "LOST_ITEM_ADMIN"
    ? "LOST_ITEM_ADMIN"
    : "ADMIN";
}

function sanitizeStatus(value: unknown): AdminStatus {
  return String(value ?? "").trim().toUpperCase() === "INACTIVE"
    ? "INACTIVE"
    : "ACTIVE";
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

function roleLabel(role: AdminRole) {
  return role === "LOST_ITEM_ADMIN" ? "LOST ITEM ADMIN" : "ADMIN";
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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

function parseAdmins(payload: unknown) {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];
  const items = rows
    .map((item) => {
      const row = asObject(item);
      if (!row) return null;
      const id = String(row.id ?? row._id ?? "").trim();
      const fullName = collapseSpaces(row.fullName);
      const username = sanitizeUsername(row.username);
      const email = sanitizeEmail(row.email);
      if (!id || !fullName || !username || !email) return null;
      return {
        id,
        fullName,
        username,
        email,
        role: sanitizeRole(row.role),
        status: sanitizeStatus(row.status),
        mustChangePassword: Boolean(row.mustChangePassword),
        updatedAt: String(row.updatedAt ?? ""),
      } satisfies AdminUserRecord;
    })
    .filter((row): row is AdminUserRecord => Boolean(row));

  return {
    items,
    total: Math.max(0, Number(root?.total) || items.length),
    page: Math.max(1, Number(root?.page) || 1),
    pageSize: [10, 25, 50, 100].includes(Number(root?.pageSize))
      ? (Number(root?.pageSize) as PageSize)
      : 10,
  };
}

export default function AdminsPage() {
  const { setActiveWindow } = useAdminContext();
  const { toast } = useToast();
  const [items, setItems] = useState<AdminUserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"" | AdminRole>("");
  const [status, setStatus] = useState<"" | AdminStatus>("");
  const [sort, setSort] = useState<SortOption>("updated");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; id?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRecord | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    username: "",
    role: "ADMIN" as AdminRole,
    status: "ACTIVE" as AdminStatus,
    password: "",
    mustChangePassword: true,
  });
  const [formError, setFormError] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const deferredQuery = useDeferredValue(query);
  const overlayOpen = Boolean(modal || deleteTarget);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort,
      });
      if (deferredQuery.trim()) params.set("search", deferredQuery.trim());
      if (role) params.set("role", role);
      if (status) params.set("status", status);

      const parsed = parseAdmins(
        await readJson(await fetch(`/api/admins?${params.toString()}`, { cache: "no-store" }))
      );
      setItems(parsed.items);
      setTotal(parsed.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to load admins",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [deferredQuery, page, pageSize, role, sort, status, toast]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

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
  const contentBlurClass = overlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : "";
  const activeFilterCount = [role, status].filter(Boolean).length;
  const filtersApplied = Boolean(query.trim() || activeFilterCount > 0);
  const activeAdminsCount = useMemo(
    () => items.filter((item) => item.status === "ACTIVE").length,
    [items]
  );
  const lostItemAdminsCount = useMemo(
    () => items.filter((item) => item.role === "LOST_ITEM_ADMIN").length,
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
    setForm({
      fullName: "",
      email: "",
      username: "",
      role: "ADMIN",
      status: "ACTIVE",
      password: "",
      mustChangePassword: true,
    });
    setGeneratedPassword("");
    setFormError("");
  };

  const openEdit = (row: AdminUserRecord) => {
    setModal({ mode: "edit", id: row.id });
    setForm({
      fullName: row.fullName,
      email: row.email,
      username: row.username,
      role: row.role,
      status: row.status,
      password: "",
      mustChangePassword: row.mustChangePassword,
    });
    setGeneratedPassword("");
    setFormError("");
  };

  const closeModal = () => {
    if (!saving) setModal(null);
  };

  const save = async () => {
    const fullName = collapseSpaces(form.fullName);
    const email = sanitizeEmail(form.email);
    const username = sanitizeUsername(form.username) || email;
    const password = String(form.password ?? "").trim();

    if (!fullName) {
      setFormError("Full name is required");
      return;
    }
    if (!email) {
      setFormError("Email is required");
      return;
    }
    if (!username) {
      setFormError("Username is required");
      return;
    }
    if (password && password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    setGeneratedPassword("");
    try {
      const endpoint =
        modal?.mode === "add"
          ? "/api/admins"
          : `/api/admins/${encodeURIComponent(String(modal?.id ?? ""))}`;
      const payload = await readJson<{
        item?: AdminUserRecord;
        generatedPassword?: string;
      }>(
        await fetch(endpoint, {
          method: modal?.mode === "add" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName,
            email,
            username,
            role: form.role,
            status: form.status,
            password,
            mustChangePassword: form.mustChangePassword,
          }),
        })
      );

      const temporaryPassword = String(payload.generatedPassword ?? "").trim();
      if (temporaryPassword) {
        setGeneratedPassword(temporaryPassword);
        toast({
          title: "Saved",
          message: `Admin created. Temporary password: ${temporaryPassword}`,
          variant: "success",
        });
      } else {
        toast({
          title: "Saved",
          message: modal?.mode === "add" ? "Admin created" : "Admin updated",
          variant: "success",
        });
      }
      setModal(null);
      await loadItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save admin";
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
          Add Admin
        </Button>
      </div>

      {generatedPassword ? (
        <Card className={cn("border border-primary/20 bg-primary/[0.07] p-5", contentBlurClass)}>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
              Temporary Password
            </p>
            <p className="text-sm text-heading">
              Newly created admin temporary password:{" "}
              <span className="font-semibold">{generatedPassword}</span>
            </p>
          </div>
        </Card>
      ) : null}

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
                  Admin directory
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  Register and manage admin accounts for main admin access and
                  lost-item administration using the updated users section surface.
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
                      : "Showing the full admin directory"}
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
                      aria-label="Search admins"
                      className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-[15px] text-heading outline-none placeholder:text-text/48"
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by name, username, or email"
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
                      aria-label="Sort admins"
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
                    Admin Type
                  </label>
                  <div className="relative flex h-14 min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <select
                      aria-label="Filter by admin type"
                      className="h-full w-full appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      onChange={(event) => {
                        setRole(event.target.value as "" | AdminRole);
                        setPage(1);
                      }}
                      value={role}
                    >
                      <option value="">All admin types</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="LOST_ITEM_ADMIN">LOST ITEM ADMIN</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Status
                  </label>
                  <div className="relative flex h-14 min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <select
                      aria-label="Filter admins by status"
                      className="h-full w-full appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      onChange={(event) => {
                        setStatus(event.target.value as "" | AdminStatus);
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
                    setRole("");
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
            icon={ShieldCheck}
            label="Total Admins"
            tone="sky"
            value={total.toLocaleString()}
          />
          <AdminSummaryCard
            detail={
              activeAdminsCount > 0
                ? `${activeAdminsCount.toLocaleString()} active admin accounts in view`
                : "No active admin accounts in the current view"
            }
            icon={CheckCircle2}
            label="Active Admins"
            tone="green"
            value={activeAdminsCount.toLocaleString()}
          />
          <AdminSummaryCard
            detail={
              lostItemAdminsCount > 0
                ? `${lostItemAdminsCount.toLocaleString()} lost-item admin accounts visible`
                : "No lost-item admin accounts in the current view"
            }
            icon={KeyRound}
            label="Lost-Item Admins"
            tone="violet"
            value={lostItemAdminsCount.toLocaleString()}
          />
          <AdminSummaryCard
            detail={
              latestUpdatedAt ? "Most recent visible admin account change" : "No admin updates loaded yet"
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
            <p className="text-lg font-semibold text-heading">Admin Records</p>
            <p className="mt-1 text-sm text-text/68">
              Review login identity, access type, account status, and password policy from a cleaner table surface.
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
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-[rgba(255,255,255,0.82)]">
                  <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    <th className="px-5 py-4">Admin</th>
                    <th className="px-5 py-4">Login</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Password Policy</th>
                    <th className="px-5 py-4">Updated</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {loading ? (
                    <tr>
                      <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={7}>
                        Loading admins...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={7}>
                        No admins match the current filters.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => (
                      <tr className="transition-colors duration-200 hover:bg-white/70" key={row.id}>
                        <td className="px-5 py-4 align-top">
                          <div>
                            <p className="font-semibold text-heading">{row.fullName}</p>
                            <p className="mt-1 text-xs text-text/55">@{row.username}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-text/78">{row.email}</td>
                        <td className="px-5 py-4 align-top">
                          <Badge variant={row.role === "ADMIN" ? "primary" : "info"}>
                            {roleLabel(row.role)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 align-top text-text/78">
                          {row.mustChangePassword ? "Must change on next login" : "No forced reset"}
                        </td>
                        <td className="px-5 py-4 align-top text-text/70">{formatDate(row.updatedAt)}</td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              aria-label={`Edit ${row.fullName}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-heading hover:shadow-shadow"
                              onClick={() => openEdit(row)}
                              type="button"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              aria-label={`Delete ${row.fullName}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-red-200 hover:bg-white hover:text-red-600 hover:shadow-shadow"
                              onClick={() => setDeleteTarget(row)}
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
          totalItems={total}
        />
      </Card>

      {modal ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) closeModal();
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]"
            role="dialog"
          >
            <div className="overflow-y-auto px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                    {modal.mode === "add" ? "CREATE" : "EDIT"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-heading">
                    {modal.mode === "add" ? "Add Admin" : "Edit Admin"}
                  </p>
                </div>
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading"
                  disabled={saving}
                  onClick={closeModal}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-heading">Full Name</label>
                  <Input
                    className="h-12"
                    disabled={saving}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, fullName: event.target.value }))
                    }
                    value={form.fullName}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Login Email</label>
                  <Input
                    className="h-12"
                    disabled={saving}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, email: sanitizeEmail(event.target.value) }))
                    }
                    type="email"
                    value={form.email}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">
                    Username (Optional)
                  </label>
                  <Input
                    className="h-12"
                    disabled={saving}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, username: sanitizeUsername(event.target.value) }))
                    }
                    placeholder="Defaults to login email"
                    value={form.username}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Admin Type</label>
                  <Select
                    className="h-12"
                    disabled={saving}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, role: sanitizeRole(event.target.value) }))
                    }
                    value={form.role}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="LOST_ITEM_ADMIN">LOST ITEM ADMIN</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Status</label>
                  <Select
                    className="h-12"
                    disabled={saving}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, status: sanitizeStatus(event.target.value) }))
                    }
                    value={form.status}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-heading">
                    {modal.mode === "add"
                      ? "Temporary Password (Optional)"
                      : "Reset Password (Optional)"}
                  </label>
                  <Input
                    className="h-12"
                    disabled={saving}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, password: String(event.target.value ?? "") }))
                    }
                    placeholder="Leave empty to auto-generate (minimum 8 chars when provided)"
                    type="password"
                    value={form.password}
                  />
                </div>
                <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm text-heading">
                  <input
                    checked={form.mustChangePassword}
                    className="h-4 w-4 rounded border-border"
                    disabled={saving}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, mustChangePassword: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  Force password change on next login
                </label>
              </div>

              {formError ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-white px-6 py-4">
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button
                  className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                  disabled={saving}
                  onClick={closeModal}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 min-w-[132px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
                  disabled={saving}
                  onClick={() => {
                    void save();
                  }}
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save
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
            if (event.target === event.currentTarget && !deleting) setDeleteTarget(null);
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]"
            role="dialog"
          >
            <div className="px-6 py-6">
              <p className="text-lg font-semibold text-heading">Delete Admin</p>
              <p className="mt-2 text-sm leading-6 text-text/70">
                Delete admin <span className="font-semibold text-heading">{deleteTarget.fullName}</span>? This
                action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
              <Button
                className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[132px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700"
                disabled={deleting}
                onClick={() => {
                  void (async () => {
                    setDeleting(true);
                    try {
                      await readJson(
                        await fetch(`/api/admins/${encodeURIComponent(deleteTarget.id)}`, {
                          method: "DELETE",
                        })
                      );
                      toast({
                        title: "Deleted",
                        message: "Admin deleted successfully",
                        variant: "success",
                      });
                      setDeleteTarget(null);
                      await loadItems();
                    } catch (error) {
                      toast({
                        title: "Failed",
                        message: error instanceof Error ? error.message : "Failed to delete admin",
                        variant: "error",
                      });
                    } finally {
                      setDeleting(false);
                    }
                  })();
                }}
              >
                {deleting ? (
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
