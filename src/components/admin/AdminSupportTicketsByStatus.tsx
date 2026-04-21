"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, UserPlus } from "lucide-react";
import AssignTechnicianToTicketModal from "@/components/admin/AssignTechnicianToTicketModal";
import PageHeader from "@/components/admin/PageHeader";
import type { AdminTicketsStatusConfig } from "@/components/admin/admin-ticket-status-config";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
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
  assignedTechnician?: TechnicianSummary;
  technicianComments?: string;
  technicianEvidencePreview?: { fileName: string; mimeType: string }[];
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

export default function AdminSupportTicketsByStatus({ config }: { config: AdminTicketsStatusConfig }) {
  const [items, setItems] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignTarget, setAssignTarget] = useState<{ id: string; subject: string } | null>(null);
  const [canAssignTechnician, setCanAssignTechnician] = useState(false);

  const statusQuery = encodeURIComponent(config.apiStatus);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/support-tickets?status=${statusQuery}`, {
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
  }, [statusQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCanAssignTechnician(
      Boolean(config.showAssignTechnician) && readStoredRole() === "SUPER_ADMIN"
    );
  }, [config.showAssignTechnician]);

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

      <Card accent title={config.cardTitle} description={config.cardDescription}>
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
          <ul className="space-y-3">
            {items.map((ticket) => (
              <li
                key={ticket.id}
                className="admin-list-card rounded-3xl border border-border bg-card p-4"
              >
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
                    {ticket.assignedTechnician ? (
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
                    {ticket.technicianEvidencePreview && ticket.technicianEvidencePreview.length > 0 ? (
                      <p className="text-xs text-text/60">
                        Technician evidence:{" "}
                        {ticket.technicianEvidencePreview.map((e) => e.fileName).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 text-right text-xs text-text/55 sm:items-end sm:pt-0.5">
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
              </li>
            ))}
          </ul>
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
