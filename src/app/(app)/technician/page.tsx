"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Ticket, Wrench } from "lucide-react";
import Card from "@/components/ui/Card";
import { authHeaders, readStoredUser, WORKSPACE_TITLE_BY_ROLE } from "@/models/rbac";

type StatusKey = "inProgress" | "accepted" | "resolved";

const STATUS_QUERIES: Record<
  StatusKey,
  { param: string; label: string; href: string; description: string }
> = {
  inProgress: {
    param: "In progress",
    label: "In progress",
    href: "/technician/tickets/in-progress",
    description: "Assigned to you — accept when you take the ticket",
  },
  accepted: {
    param: "Accepted",
    label: "Accepted",
    href: "/technician/tickets/accepted",
    description: "You accepted — mark resolved when finished",
  },
  resolved: {
    param: "Resolved",
    label: "Resolved",
    href: "/technician/tickets/resolved",
    description: "Completed tickets assigned to you",
  },
};

async function fetchTicketTotal(statusParam: string) {
  const q = encodeURIComponent(statusParam);
  const response = await fetch(`/api/admin/support-tickets?status=${q}&mine=1`, {
    cache: "no-store",
    headers: { ...authHeaders() },
  });
  const payload = (await response.json().catch(() => null)) as { total?: unknown } | null;
  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: string }).message || "Failed to load")
        : "Failed to load tickets"
    );
  }
  const raw = payload?.total;
  return typeof raw === "number" && !Number.isNaN(raw) ? raw : 0;
}

export default function TechnicianDashboardPage() {
  const user = readStoredUser();
  const [counts, setCounts] = useState<Record<StatusKey, number> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          (Object.keys(STATUS_QUERIES) as StatusKey[]).map(async (key) => {
            const total = await fetchTicketTotal(STATUS_QUERIES[key].param);
            return [key, total] as const;
          })
        );
        if (!cancelled) {
          setError("");
          setCounts(Object.fromEntries(entries) as Record<StatusKey, number>);
        }
      } catch (e) {
        if (!cancelled) {
          setCounts(null);
          setError(e instanceof Error ? e.message : "Failed to load dashboard");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalAll =
    counts === null
      ? null
      : (Object.keys(STATUS_QUERIES) as StatusKey[]).reduce((sum, k) => sum + (counts[k] ?? 0), 0);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#26150F]/55">
          {WORKSPACE_TITLE_BY_ROLE.TECHNICIAN}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0A] sm:text-3xl">
              Hello{user?.name ? `, ${user.name}` : ""}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#26150F]/75">
              Counts below are for tickets assigned to you. Open a queue to accept work, complete it, or
              review history.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-[#034AA6]/20 bg-white px-3 py-2 text-sm text-[#26150F]/80 shadow-sm">
            <Wrench className="h-4 w-4 shrink-0 text-[#034AA6]" aria-hidden />
            <span>{user?.email || user?.username || "Technician account"}</span>
          </div>
        </div>
      </header>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(STATUS_QUERIES) as StatusKey[]).map((key) => {
          const cfg = STATUS_QUERIES[key];
          const value = counts === null ? null : counts[key];
          return (
            <Card key={key} className="border-[#BFBFBF]/40 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#26150F]/55">
                    {cfg.label}
                  </p>
                  <p className="text-3xl font-semibold tabular-nums text-[#0A0A0A]">
                    {counts === null ? (
                      <span className="inline-flex items-center gap-2 text-base font-medium text-[#26150F]/55">
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        …
                      </span>
                    ) : (
                      value?.toLocaleString() ?? "0"
                    )}
                  </p>
                  <p className="text-xs text-[#26150F]/60">{cfg.description}</p>
                </div>
                <Ticket className="h-8 w-8 shrink-0 text-[#034AA6]/35" aria-hidden />
              </div>
              <Link
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#034AA6] transition-colors hover:text-[#0339A6]"
                href={cfg.href}
              >
                View list
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Card>
          );
        })}
      </section>

      <Card
        accent
        description="Tickets assigned to your technician account (same queues as in the navigation)."
        title="Queue overview"
        className="border-[#BFBFBF]/40 bg-white"
      >
        <p className="text-sm text-[#26150F]/78">
          {counts === null ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading totals…
            </span>
          ) : (
            <>
              <span className="font-semibold text-[#0A0A0A]">{totalAll?.toLocaleString() ?? "0"}</span>{" "}
              support ticket{totalAll === 1 ? "" : "s"} visible in your current queues.
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
