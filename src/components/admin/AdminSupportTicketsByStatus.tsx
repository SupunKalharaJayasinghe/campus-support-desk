"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  FilterX,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
  XCircle,
} from "lucide-react";
import AssignTechnicianToTicketModal from "@/components/admin/AssignTechnicianToTicketModal";
import PageHeader from "@/components/admin/PageHeader";
import type { AdminTicketsStatusConfig } from "@/components/admin/admin-ticket-status-config";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { authHeaders, readStoredRole } from "@/models/rbac";

type StudentSummary = {
  id: string;
  studentId: string;
  name: string;
  email: string;
} | null;

type TechnicianSummary = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  specialization: string;
} | null;

type AdminSupportTicket = {
  id: string;
  subject: string;
  category: string;
  subcategory: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  student: StudentSummary;
  studentEvidencePreview?: { fileName: string; mimeType: string; data: string }[];
  assignedTechnician?: TechnicianSummary;
  technicianComments?: string;
  technicianEvidencePreview?: { fileName: string; mimeType: string; data: string }[];
};

function formatDateTime(value: string) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

function readErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const msg = (payload as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) {
      return msg;
    }
  }
  return "Request failed";
}

function evidenceDataUrl(data: string, mimeType: string) {
  const raw = data.trim();
  if (raw.toLowerCase().startsWith("data:")) {
    return raw;
  }
  return `data:${mimeType};base64,${raw}`;
}

function isImageMime(mimeType: string) {
  return mimeType.trim().toLowerCase().startsWith("image/");
}

type TechnicianWorkflow = "accept" | "resolve" | "reopen-accepted";
type AssignmentFilter = "all" | "assigned" | "unassigned";

export default function AdminSupportTicketsByStatus({
  config,
  mineOnly = false,
  technicianWorkflow,
}: {
  config: AdminTicketsStatusConfig;
  /** Limit to tickets assigned to the signed-in technician (`mine=1`). */
  mineOnly?: boolean;
  /** Show Accept / Mark resolved actions for the technician queue. */
  technicianWorkflow?: TechnicianWorkflow;
}) {
  const [items, setItems] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignTarget, setAssignTarget] = useState<{ id: string; subject: string } | null>(null);
  const [canAssignTechnician, setCanAssignTechnician] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [resolveDrafts, setResolveDrafts] = useState<Record<string, string>>({});
  const [expandedTicketIds, setExpandedTicketIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");

  const statusQuery = encodeURIComponent(config.apiStatus);
  const listQuery = mineOnly ? `${statusQuery}&mine=1` : statusQuery;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/support-tickets?status=${listQuery}`, {
        cache: "no-store",
        headers: { ...authHeaders() },
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }
      const list =
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { items?: unknown }).items)
          ? ((payload as { items: AdminSupportTicket[] }).items ?? [])
          : [];
      setItems(list);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  const runTechnicianAction = useCallback(
    async (ticketId: string, body: Record<string, unknown>) => {
      setActionLoadingId(ticketId);
      setError("");
      try {
        const response = await fetch(
          `/api/technician/support-tickets/${encodeURIComponent(ticketId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify(body),
          }
        );
        const payload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          throw new Error(readErrorMessage(payload));
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setActionLoadingId(null);
      }
    },
    [load]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCanAssignTechnician(
      Boolean(config.showAssignTechnician) && readStoredRole() === "SUPER_ADMIN"
    );
  }, [config.showAssignTechnician]);

  const availableCategories = useMemo(() => {
    return Array.from(
      new Set(
        items
          .flatMap((ticket) => [ticket.category, ticket.subcategory])
          .map((value) => value.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((ticket) => {
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) {
        return false;
      }
      if (
        categoryFilter !== "all" &&
        ticket.category !== categoryFilter &&
        ticket.subcategory !== categoryFilter
      ) {
        return false;
      }
      if (assignmentFilter === "assigned" && !ticket.assignedTechnician) {
        return false;
      }
      if (assignmentFilter === "unassigned" && ticket.assignedTechnician) {
        return false;
      }
      if (!query) {
        return true;
      }
      const searchable = [
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.subcategory,
        ticket.priority,
        ticket.student?.name ?? "",
        ticket.student?.studentId ?? "",
        ticket.student?.email ?? "",
        ticket.assignedTechnician?.fullName ?? "",
        ticket.assignedTechnician?.email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [assignmentFilter, categoryFilter, items, priorityFilter, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    priorityFilter !== "all" ||
    categoryFilter !== "all" ||
    assignmentFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setAssignmentFilter("all");
  };

  const toggleTicketDetails = (ticketId: string) => {
    setExpandedTicketIds((prev) => ({
      ...prev,
      [ticketId]: !prev[ticketId],
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={config.pageTitle}
        description={config.pageDescription}
        actions={
          <Button
            type="button"
            variant="secondary"
            className="gap-2 px-3 py-1.5 text-xs"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Refresh
          </Button>
        }
      />

      <Card
        accent
        title={config.cardTitle}
        description={`${config.cardDescription} · Showing ${filteredItems.length} of ${items.length}`}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-border bg-card px-4 py-12 text-sm text-text/68">
            <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden />
            {config.loadingMessage}
          </div>
        ) : error ? (
          <p className="admin-empty-state rounded-3xl border border-border border-red-500/25 bg-card p-5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : items.length === 0 ? (
          <p className="admin-empty-state rounded-3xl border border-border bg-card p-5 text-sm text-text/68">
            {config.emptyMessage}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-2xl border border-border bg-background/40 p-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="md:col-span-2 xl:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text/55">
                  Search ticket details
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/45"
                    aria-hidden
                  />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Subject, student, technician, category..."
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text/55">
                  Priority
                </label>
                <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                  <option value="all">All priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text/55">
                  Category
                </label>
                <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="all">All categories</option>
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text/55">
                  Assignment
                </label>
                <div className="flex gap-2">
                  <Select
                    value={assignmentFilter}
                    onChange={(e) => setAssignmentFilter(e.target.value as AssignmentFilter)}
                  >
                    <option value="all">All tickets</option>
                    <option value="assigned">Assigned</option>
                    <option value="unassigned">Unassigned</option>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 gap-1.5 px-3 py-2 text-xs"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                  >
                    <FilterX className="h-3.5 w-3.5" aria-hidden />
                    Clear
                  </Button>
                </div>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <p className="admin-empty-state rounded-3xl border border-border bg-card p-5 text-sm text-text/68">
                No tickets match the selected filters.
              </p>
            ) : (
              <ul className="space-y-3">
                {filteredItems.map((ticket) => (
              <li
                key={ticket.id}
                className="admin-list-card rounded-3xl border border-border bg-card p-4"
              >
                {(() => {
                  const isExpanded = Boolean(expandedTicketIds[ticket.id]);
                  const hasStudentEvidence =
                    Boolean(ticket.studentEvidencePreview) && ticket.studentEvidencePreview.length > 0;
                  const hasTechnicianEvidence =
                    Boolean(ticket.technicianEvidencePreview) &&
                    ticket.technicianEvidencePreview.length > 0;
                  const hasTechnicianInfo = Boolean(ticket.assignedTechnician || ticket.technicianComments);
                  return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-heading">{ticket.subject}</p>
                      <Badge variant={config.badgeVariant}>{config.statusBadgeLabel}</Badge>
                      {ticket.priority ? (
                        <span className="text-xs font-medium text-text/55">
                          Priority: {ticket.priority}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-text/60">
                      {ticket.category}
                      {ticket.subcategory ? ` • ${ticket.subcategory}` : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => toggleTicketDetails(ticket.id)}
                      >
                        {isExpanded ? "Hide details" : "See details"}
                      </Button>
                    </div>
                    {isExpanded ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      <section className="rounded-2xl border border-border bg-background/50 p-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text/55">
                          Student ticket details
                        </p>
                        {ticket.student ? (
                          <p className="text-sm text-text/80">
                            <span className="font-medium text-heading">Student: </span>
                            {ticket.student.name}
                            {ticket.student.studentId ? ` (${ticket.student.studentId})` : ""}
                            {ticket.student.email ? ` — ${ticket.student.email}` : ""}
                          </p>
                        ) : null}
                        {ticket.description ? (
                          <p className="line-clamp-3 text-sm text-text/70">{ticket.description}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text/55">
                          {ticket.contactEmail ? (
                            <span>Contact email: {ticket.contactEmail}</span>
                          ) : null}
                          {ticket.contactPhone ? (
                            <span>Phone: {ticket.contactPhone}</span>
                          ) : null}
                          {ticket.contactWhatsapp ? (
                            <span>WhatsApp: {ticket.contactWhatsapp}</span>
                          ) : null}
                        </div>
                        {hasStudentEvidence ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-text/65">Student uploaded evidence</p>
                            <div className="flex flex-wrap gap-2">
                              {ticket.studentEvidencePreview?.map((e, index) =>
                                isImageMime(e.mimeType) ? (
                                  <a
                                    key={`${ticket.id}-student-img-${index}`}
                                    href={evidenceDataUrl(e.data, e.mimeType)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block"
                                    title={e.fileName}
                                  >
                                    <img
                                      className="h-16 w-20 rounded-lg border border-border object-cover"
                                      src={evidenceDataUrl(e.data, e.mimeType)}
                                      alt={e.fileName}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={`${ticket.id}-student-file-${index}`}
                                    href={evidenceDataUrl(e.data, e.mimeType)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs text-text/75 hover:bg-tint"
                                    title={e.fileName}
                                  >
                                    <FileText className="h-3.5 w-3.5" aria-hidden />
                                    <span className="max-w-[180px] truncate">{e.fileName}</span>
                                  </a>
                                )
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text/55">No student evidence attached.</p>
                        )}
                      </section>
                      <section className="rounded-2xl border border-border bg-background/50 p-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text/55">
                          Technician details
                        </p>
                        {ticket.assignedTechnician && !mineOnly ? (
                          <p className="text-sm text-text/80">
                            <span className="font-medium text-heading">Technician: </span>
                            {ticket.assignedTechnician.fullName}
                            {ticket.assignedTechnician.specialization
                              ? ` (${ticket.assignedTechnician.specialization})`
                              : ""}
                            {ticket.assignedTechnician.email
                              ? ` — ${ticket.assignedTechnician.email}`
                              : ""}
                          </p>
                        ) : null}
                        {ticket.technicianComments ? (
                          <p className="text-sm text-text/75">
                            <span className="font-medium text-heading">Technician notes: </span>
                            {ticket.technicianComments}
                          </p>
                        ) : null}
                        {hasTechnicianEvidence ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-text/65">
                              Technician uploaded evidence
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {ticket.technicianEvidencePreview?.map((e, index) =>
                                isImageMime(e.mimeType) ? (
                                  <a
                                    key={`${ticket.id}-tech-img-${index}`}
                                    href={evidenceDataUrl(e.data, e.mimeType)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block"
                                    title={e.fileName}
                                  >
                                    <img
                                      className="h-16 w-20 rounded-lg border border-border object-cover"
                                      src={evidenceDataUrl(e.data, e.mimeType)}
                                      alt={e.fileName}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={`${ticket.id}-tech-file-${index}`}
                                    href={evidenceDataUrl(e.data, e.mimeType)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs text-text/75 hover:bg-tint"
                                    title={e.fileName}
                                  >
                                    <FileText className="h-3.5 w-3.5" aria-hidden />
                                    <span className="max-w-[180px] truncate">{e.fileName}</span>
                                  </a>
                                )
                              )}
                            </div>
                          </div>
                        ) : null}
                        {!hasTechnicianInfo && !hasTechnicianEvidence ? (
                          <p className="text-xs text-text/55">
                            Technician details are not available yet.
                          </p>
                        ) : null}
                      </section>
                    </div>
                    ) : null}
                  </div>
                  <div className="flex w-full shrink-0 flex-col items-stretch gap-2 text-right text-xs text-text/55 sm:w-auto sm:min-w-[220px] sm:items-end sm:pt-0.5">
                    {technicianWorkflow === "accept" ? (
                      <div className="flex w-full flex-col gap-2 sm:max-w-[280px] sm:self-end">
                        <Button
                          type="button"
                          variant="primary"
                          className="gap-1.5 self-end whitespace-nowrap bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                          disabled={actionLoadingId === ticket.id}
                          onClick={() => void runTechnicianAction(ticket.id, { status: "Accepted" })}
                        >
                          {actionLoadingId === ticket.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          )}
                          Accept ticket
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          className="gap-1.5 self-end whitespace-nowrap px-3 py-1.5 text-xs"
                          disabled={actionLoadingId === ticket.id}
                          onClick={() => void runTechnicianAction(ticket.id, { status: "Open" })}
                        >
                          {actionLoadingId === ticket.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" aria-hidden />
                          )}
                          Reject ticket
                        </Button>
                      </div>
                    ) : null}
                    {technicianWorkflow === "resolve" ? (
                      <div className="flex w-full flex-col gap-2 sm:max-w-[280px] sm:self-end">
                        <label className="block text-left text-[11px] font-medium uppercase tracking-wide text-text/55">
                          Resolution notes (optional)
                        </label>
                        <textarea
                          className="min-h-[72px] w-full rounded-xl border border-border bg-background px-3 py-2 text-left text-sm text-text placeholder:text-text/40"
                          placeholder="What was done?"
                          value={resolveDrafts[ticket.id] ?? ""}
                          onChange={(e) =>
                            setResolveDrafts((prev) => ({
                              ...prev,
                              [ticket.id]: e.target.value,
                            }))
                          }
                          rows={3}
                        />
                        <Button
                          type="button"
                          variant="primary"
                          className="gap-1.5 self-end whitespace-nowrap bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                          disabled={actionLoadingId === ticket.id}
                          onClick={() => {
                            const confirmed = window.confirm(
                              "Are you sure this problem is resolved?"
                            );
                            if (!confirmed) {
                              return;
                            }
                            void runTechnicianAction(ticket.id, {
                              status: "Resolved",
                              technicianComments: (resolveDrafts[ticket.id] ?? "").trim() || undefined,
                            });
                          }}
                        >
                          {actionLoadingId === ticket.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          )}
                          Mark resolved
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          className="gap-1.5 self-end whitespace-nowrap px-3 py-1.5 text-xs"
                          disabled={actionLoadingId === ticket.id}
                          onClick={() => void runTechnicianAction(ticket.id, { status: "Open" })}
                        >
                          {actionLoadingId === ticket.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" aria-hidden />
                          )}
                          Reject ticket
                        </Button>
                      </div>
                    ) : null}
                    {technicianWorkflow === "reopen-accepted" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="gap-1.5 self-end whitespace-nowrap bg-orange-500 px-3 py-1.5 text-xs text-white hover:bg-orange-600"
                        disabled={actionLoadingId === ticket.id}
                        onClick={() => void runTechnicianAction(ticket.id, { status: "Accepted" })}
                      >
                        {actionLoadingId === ticket.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Back to accepted
                      </Button>
                    ) : null}
                    {canAssignTechnician ? (
                      <Button
                        type="button"
                        variant="primary"
                        className="gap-1.5 self-end whitespace-nowrap px-3 py-1.5 text-xs"
                        onClick={() =>
                          setAssignTarget({ id: ticket.id, subject: ticket.subject || "Support ticket" })
                        }
                      >
                        <UserPlus className="h-3.5 w-3.5" aria-hidden />
                        Assign technician
                      </Button>
                    ) : null}
                    <p>Created {formatDateTime(ticket.createdAt)}</p>
                    {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt ? (
                      <p className="mt-1">Updated {formatDateTime(ticket.updatedAt)}</p>
                    ) : null}
                  </div>
                </div>
                  );
                })()}
              </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <AssignTechnicianToTicketModal
        ticketId={assignTarget?.id ?? ""}
        ticketSubject={assignTarget?.subject ?? ""}
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => void load()}
      />
    </div>
  );
}
