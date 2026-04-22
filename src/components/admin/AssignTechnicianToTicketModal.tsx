"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { authHeaders } from "@/models/rbac";

type TechnicianOption = {
  id: string;
  fullName: string;
  email: string;
  specialization: string;
};

function readErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const msg = (payload as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) {
      return msg;
    }
  }
  return "Request failed";
}

type Props = {
  ticketId: string;
  ticketSubject: string;
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
};

export default function AssignTechnicianToTicketModal({
  ticketId,
  ticketSubject,
  open,
  onClose,
  onAssigned,
}: Props) {
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [technicianId, setTechnicianId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setTechnicianId("");
    setError("");
  }, [open, ticketId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingTechnicians(true);
      try {
        const response = await fetch(
          "/api/technicians?pageSize=100&status=ACTIVE&sort=az",
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          throw new Error(readErrorMessage(payload));
        }
        const raw =
          payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
            ? ((payload as { items: TechnicianOption[] }).items ?? [])
            : [];
        if (!cancelled) {
          setTechnicians(raw);
        }
      } catch (e) {
        if (!cancelled) {
          setTechnicians([]);
          setError(e instanceof Error ? e.message : "Failed to load technicians");
        }
      } finally {
        if (!cancelled) {
          setLoadingTechnicians(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!technicianId) {
      setError("Select a technician.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/support-tickets/${encodeURIComponent(ticketId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ technicianId }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }
      onAssigned();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setSubmitting(false);
    }
  }, [onAssigned, onClose, technicianId, ticketId]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[30px] border border-border bg-[rgba(255,255,255,0.94)] shadow-[0_32px_80px_rgba(15,23,42,0.24)] dark:bg-[rgba(20,24,35,0.96)]"
        role="dialog"
        aria-labelledby="assign-tech-title"
      >
        <div className="overflow-y-auto px-6 py-6 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Badge variant="primary">Assign technician</Badge>
              <p id="assign-tech-title" className="mt-3 text-xl font-semibold tracking-tight text-heading">
                {ticketSubject}
              </p>
              <p className="mt-2 text-sm leading-6 text-text/68">
                Choose an active technician. The ticket moves to{" "}
                <span className="font-semibold text-heading">In progress</span>.
              </p>
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-text/55 transition hover:bg-tint hover:text-heading"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text/70" htmlFor="assign-tech-select">
                Technician
              </label>
              {loadingTechnicians ? (
                <div className="flex items-center gap-2 rounded-[16px] border border-border bg-card px-3.5 py-2.5 text-sm text-text/60">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading technicians…
                </div>
              ) : (
                <Select
                  id="assign-tech-select"
                  value={technicianId}
                  onChange={(e) => setTechnicianId(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select a technician</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                      {t.specialization ? ` — ${t.specialization}` : ""} ({t.email})
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {error ? (
              <p className="rounded-2xl border border-red-500/25 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-border/80 pt-5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Assigning…
                </>
              ) : (
                "Assign technician"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
