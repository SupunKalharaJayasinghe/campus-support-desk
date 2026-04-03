"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import UrgentPaymentDoneDialog from "@/components/community/UrgentPaymentDoneDialog";
import { COMMUNITY_URGENT_CARD_PAYMENT_DONE_SESSION_KEY } from "@/lib/community-urgent-payment-done-ui";
import { readStoredUser } from "@/lib/rbac";

type PaymentRow = {
  id: string;
  userRef: string | null;
  status: string;
  amountRs: number;
  urgentLevel: string;
  userUsername: string;
  userEmail: string;
  displayName: string;
  cardMaskedDisplay: string;
  cardLast4: string;
  expiryMonth: number;
  expiryYear: number;
  cvcVerified: boolean;
  cvcLength: number | null;
  panStoredEncrypted: boolean;
  cardNumberDecrypted: string | null;
  draftRef: string | null;
  postRef: string | null;
  createdAt: string | null;
};

function paymentRowSearchHaystack(row: PaymentRow, includeDecryptedPan: boolean) {
  const parts = [
    row.id,
    row.userRef ?? "",
    row.displayName,
    row.userEmail,
    row.userUsername,
    String(row.amountRs),
    row.urgentLevel,
    row.status,
    row.cardMaskedDisplay,
    row.cardLast4,
    row.postRef ?? "",
    row.draftRef ?? "",
    row.createdAt ?? "",
    row.cvcVerified ? `verified ${row.cvcLength ?? ""}` : "",
  ];
  if (includeDecryptedPan && row.cardNumberDecrypted) {
    parts.push(row.cardNumberDecrypted);
  }
  return parts.join(" ").toLowerCase();
}

export default function CommunityAdminUrgentPaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [decryptionAvailable, setDecryptionAvailable] = useState(false);
  const [paymentDoneOpen, setPaymentDoneOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const user = readStoredUser();
    if (!user?.id || user.role !== "COMMUNITY_ADMIN") {
      setError("Sign in as Community Admin to view urgent card payments.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const q = new URLSearchParams({ adminUserId: user.id });
        if (showDecrypted) q.set("decrypt", "1");
        const res = await fetch(`/api/community-urgent-card-payments?${q}`);
        const data = (await res.json()) as {
          items?: PaymentRow[];
          decryptionAvailable?: boolean;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "Failed to load payments.");
        }
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setDecryptionAvailable(Boolean(data.decryptionAvailable));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load payments.");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showDecrypted]);

  useEffect(() => {
    let fromQuery = false;
    try {
      if (typeof window !== "undefined") {
        const q = new URLSearchParams(window.location.search);
        if (q.get("paymentDone") === "1") {
          fromQuery = true;
          setPaymentDoneOpen(true);
          router.replace(pathname || "/community-admin/urgent-payments", { scroll: false });
        }
      }
    } catch {
      // ignore
    }
    if (fromQuery) return;
    try {
      if (
        typeof window !== "undefined" &&
        sessionStorage.getItem(COMMUNITY_URGENT_CARD_PAYMENT_DONE_SESSION_KEY) === "1"
      ) {
        setPaymentDoneOpen(true);
      }
    } catch {
      // ignore
    }
  }, [router, pathname]);

  const dismissPaymentDone = () => {
    setPaymentDoneOpen(false);
    try {
      sessionStorage.removeItem(COMMUNITY_URGENT_CARD_PAYMENT_DONE_SESSION_KEY);
    } catch {
      // ignore
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => paymentRowSearchHaystack(row, showDecrypted).includes(q));
  }, [items, searchQuery, showDecrypted]);

  return (
    <div className="space-y-6">
      {decryptionAvailable ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            onClick={() => setShowDecrypted((v) => !v)}
          >
            {showDecrypted ? "Hide decrypted PAN" : "Show decrypted PAN"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {!error ? (
        <section id="filters" className="scroll-mt-6">
          <Card
            title="Search"
            description="Filter payment records by username, email, or user ID."
            className="border-l-[3px] border-l-sky-500 bg-gradient-to-br from-card to-sky-500/[0.04]"
          >
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username, email, or user ID"
              aria-label="Search payment records"
            />
            {searchQuery.trim() && items.length > 0 ? (
              <p className="mt-2 text-xs text-text/65">
                {filteredItems.length} of {items.length} shown
              </p>
            ) : null}
          </Card>
        </section>
      ) : null}

      {error ? null : loading ? (
        <p className="text-sm text-text/70">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text/70">No card payment records yet.</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-text/70">No records match your search.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/90 bg-card/90 shadow-sm">
          <table className="min-w-[960px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text/70">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Urgent</th>
                <th className="px-3 py-2">Card</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2">CVC</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Post ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => (
                <tr key={row.id} className="border-b border-border/60 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-text/80">
                    {row.createdAt ? row.createdAt.slice(0, 16).replace("T", " ") : "—"}
                  </td>
                  <td className="px-3 py-2 text-text/80">
                    <div className="font-medium text-heading">{row.displayName || "—"}</div>
                    <div className="text-xs text-text/65">{row.userEmail || row.userUsername}</div>
                  </td>
                  <td className="px-3 py-2 font-semibold text-heading">{row.amountRs} rs</td>
                  <td className="px-3 py-2 text-text/80">{row.urgentLevel}</td>
                  <td className="px-3 py-2 font-mono text-xs text-text/80">
                    <div>{row.cardMaskedDisplay || `****${row.cardLast4}`}</div>
                    {showDecrypted && row.cardNumberDecrypted ? (
                      <div className="mt-1 text-amber-800">PAN: {row.cardNumberDecrypted}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-text/80">
                    {String(row.expiryMonth).padStart(2, "0")}/{String(row.expiryYear).slice(-2)}
                  </td>
                  <td className="px-3 py-2 text-text/80">
                    {row.cvcVerified ? `Verified (${row.cvcLength ?? "?"} digits)` : "—"}
                  </td>
                  <td className="px-3 py-2 text-text/80">{row.status}</td>
                  <td className="px-3 py-2 font-mono text-xs text-text/80">
                    {row.postRef || row.draftRef || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UrgentPaymentDoneDialog open={paymentDoneOpen} onDismiss={dismissPaymentDone} />
    </div>
  );
}
