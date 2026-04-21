"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Image as ImageIcon, Plus, Search, Ticket } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
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

function ticketMatchesQuery(ticket: StudentTicket, query: string) {
  if (!query) {
    return true;
  }
  const q = query.toLowerCase();
  return (
    ticket.subject.toLowerCase().includes(q) ||
    ticket.description.toLowerCase().includes(q) ||
    ticket.category.toLowerCase().includes(q) ||
    ticket.id.toLowerCase().includes(q)
  );
}

export default function StudentTicketPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<StudentTicket[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

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

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ticket of tickets) {
      set.add(ticket.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (!ticketMatchesQuery(ticket, query.trim())) {
          return false;
        }
        if (statusFilter !== "all" && ticket.status !== statusFilter) {
          return false;
        }
        if (categoryFilter !== "all" && ticket.category !== categoryFilter) {
          return false;
        }
        if (priorityFilter !== "all" && ticket.priority !== priorityFilter) {
          return false;
        }
        return true;
      }),
    [tickets, query, statusFilter, categoryFilter, priorityFilter]
  );

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
    <div className="student-ticket-page space-y-5">
      <div className="student-soft-card flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-white/80 px-5 py-5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Ticket className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-heading">My Tickets</h1>
            <p className="text-sm text-text/72">Track maintenance and incident requests</p>
          </div>
        </div>
        <Button
          className="shrink-0 rounded-full px-5"
          disabled={!userId}
          onClick={() => setModalOpen(true)}
          type="button"
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Create ticket
        </Button>
      </div>

      <CreateTicketModal
        onClose={() => setModalOpen(false)}
        onCreated={refreshTickets}
        open={modalOpen}
        userId={userId}
      />

      <Card>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text/70">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/55" />
              <Input
                className="pl-9"
                placeholder="Title, description, category, or ticket ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text/70">
                Status
              </label>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="Open">Open</option>
                <option value="In progress">In progress</option>
                <option value="Resolved">Resolved</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text/70">
                Category
              </label>
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text/70">
                Priority
              </label>
              <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value="all">All priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Your tickets" description={`${filteredTickets.length} result(s)`}>
        <div className="mt-4 space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="student-soft-card rounded-xl border border-border border-dashed p-8 text-center">
              <p className="text-sm text-text/70">
                No tickets match your filters. Try changing search or filter values.
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                className="student-soft-card rounded-2xl border border-border p-3 sm:p-4"
                key={ticket.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {ticket.evidence?.find((ev) => ev.mimeType.startsWith("image/")) ? (
                      <img
                        alt={`${ticket.subject} evidence`}
                        className="h-14 w-16 shrink-0 rounded-lg border border-border object-cover"
                        src={evidenceDataUrl(
                          ticket.evidence.find((ev) => ev.mimeType.startsWith("image/")) as TicketEvidence
                        )}
                      />
                    ) : (
                      <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-tint text-text/60">
                        <ImageIcon className="h-4 w-4" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-heading">{ticket.subject}</p>
                      <p className="truncate text-xs text-text/70">
                        {ticket.category} | Priority: {ticket.priority} | Assignee: Unassigned
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={() =>
                        setExpandedTicketId((current) => (current === ticket.id ? null : ticket.id))
                      }
                    >
                      View Details
                    </Button>
                  </div>
                </div>

                {expandedTicketId === ticket.id ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-sm whitespace-pre-wrap text-text/80">{ticket.description}</p>
                    <p className="mt-2 text-xs text-text/65">{formatTicketDate(ticket.createdAt)}</p>
                    <p className="mt-1 font-mono text-[11px] text-text/55">ID {ticket.id}</p>
                    {ticket.evidence && ticket.evidence.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ticket.evidence.map((ev, index) => (
                          <a
                            className="student-soft-card inline-flex max-w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text hover:border-primary/35"
                            href={evidenceDataUrl(ev)}
                            key={`${ticket.id}-ev-${index}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {ev.mimeType.startsWith("image/") ? (
                              <ImageIcon className="h-4 w-4 shrink-0 text-text/70" aria-hidden />
                            ) : (
                              <FileText className="h-4 w-4 shrink-0 text-text/70" aria-hidden />
                            )}
                            <span className="min-w-0 truncate">{ev.fileName}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
