"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import {
  loadStudentTickets,
  type StudentTicket,
  type TicketEvidence,
} from "@/lib/support-ticket-client";
import { readStoredUser } from "@/models/rbac";
import CreateTicketModal from "./CreateTicketModal";

function statusBadgeVariant(status: StudentTicket["status"]) {
  if (status === "Resolved") {
    return "success" as const;
  }
  if (status === "In progress") {
    return "warning" as const;
  }
  return "info" as const;
}

function formatTicketDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function evidenceDataUrl(ev: TicketEvidence) {
  return `data:${ev.mimeType};base64,${ev.data}`;
}

export default function StudentTicketPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<StudentTicket[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const refreshTickets = useCallback(async () => {
    try {
      const items = await loadStudentTickets();
      setTickets(items);
    } catch (error) {
      toast({
        title: "Could not load tickets",
        message:
          error instanceof Error ? error.message : "Check your connection and try again.",
        variant: "error",
      });
    }
  }, [toast]);

  useEffect(() => {
    const user = readStoredUser();
    setUserId(user?.id ?? null);
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const items = await loadStudentTickets();
        if (!cancelled) {
          setTickets(items);
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Could not load tickets",
            message:
              error instanceof Error ? error.message : "Check your connection and try again.",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (loading) {
    return (
      <div className="student-ticket-page space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Card>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="mt-3 h-24 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="student-ticket-page space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-semibold text-heading">Support tickets</h1>
          <p className="mt-1 text-sm text-text/72">
            Open a ticket for IT or academic support. Add evidence if it helps explain the issue.
            When the campus database is connected, tickets and files are stored there; otherwise they
            stay in this browser only.
          </p>
        </div>
        <Button
          className="shrink-0 gap-2"
          disabled={!userId}
          onClick={() => setModalOpen(true)}
          type="button"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create ticket
        </Button>
      </div>

      <CreateTicketModal
        onClose={() => setModalOpen(false)}
        onCreated={refreshTickets}
        open={modalOpen}
        userId={userId}
      />

      <Card title="Your tickets" description="Most recent first">
        <div className="mt-4 space-y-3">
          {tickets.length === 0 ? (
            <div className="student-soft-card rounded-xl border border-border border-dashed p-8 text-center">
              <p className="text-sm text-text/70">
                No tickets yet. Click <strong className="text-heading">Create ticket</strong> to submit
                a request.
              </p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <div
                className="student-soft-card rounded-xl border border-border p-4"
                key={ticket.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-heading">{ticket.subject}</p>
                    <p className="mt-1 text-sm text-text/72 whitespace-pre-wrap">
                      {ticket.description}
                    </p>
                    {ticket.evidence && ticket.evidence.length > 0 ? (
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text/55">
                          Evidence
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {ticket.evidence.map((ev, index) =>
                            ev.mimeType.startsWith("image/") ? (
                              <a
                                className="block overflow-hidden rounded-lg border border-border bg-tint focus-visible:outline focus-visible:ring-2 focus-visible:ring-focus"
                                href={evidenceDataUrl(ev)}
                                key={`${ticket.id}-ev-${index}`}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs */}
                                <img
                                  alt={ev.fileName}
                                  className="h-20 w-20 object-cover"
                                  height={80}
                                  src={evidenceDataUrl(ev)}
                                  width={80}
                                />
                              </a>
                            ) : (
                              <a
                                className="student-soft-card inline-flex max-w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text hover:border-primary/35"
                                href={evidenceDataUrl(ev)}
                                key={`${ticket.id}-ev-${index}`}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <FileText className="h-4 w-4 shrink-0 text-text/70" aria-hidden />
                                <span className="min-w-0 truncate">{ev.fileName}</span>
                              </a>
                            )
                          )}
                        </div>
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-text/60">
                      {ticket.category} · Priority {ticket.priority} ·{" "}
                      {formatTicketDate(ticket.createdAt)}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-text/50">ID {ticket.id}</p>
                  </div>
                  <Badge variant={statusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
