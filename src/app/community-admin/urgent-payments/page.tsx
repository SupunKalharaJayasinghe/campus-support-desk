"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import UrgentPaymentDoneDialog from "@/components/community/UrgentPaymentDoneDialog";
import { COMMUNITY_URGENT_CARD_PAYMENT_DONE_SESSION_KEY } from "@/lib/community-urgent-payment-done-ui";
import { readStoredUser } from "@/lib/rbac";

type PaymentRow = {
  id: string;
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

export default function CommunityAdminUrgentPaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [decryptionAvailable, setDecryptionAvailable] = useState(false);
  const [paymentDoneOpen, setPaymentDoneOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-border/90 bg-card/90 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-heading">Payment records</h2>
            <p className="mt-1 max-w-2xl text-sm text-text/75">
              Each row is created when a member completes the urgent card step. CVC is never stored.
              Set <code className="rounded bg-slate-100 px-1">COMMUNITY_URGENT_PAYMENT_KEY</code>{" "}
              (16+ chars) on the server to encrypt full card numbers; use &quot;Show decrypted PAN&quot;
              only on trusted admin devices.
            </p>
          </div>
          {decryptionAvailable ? (
            <Button
              type="button"
              variant="secondary"
              className="rounded-full"
              onClick={() => setShowDecrypted((v) => !v)}
            >
              {showDecrypted ? "Hide decrypted PAN" : "Show decrypted PAN"}
            </Button>
          ) : null}
        </div>
      </Card>

      {error ? (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-text/70">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text/70">No card payment records yet.</p>
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
                <th className="px-3 py-2">Draft / Post</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
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
                  <td className="px-3 py-2 text-xs text-text/70">
                    {row.draftRef || row.postRef ? (
                      <>
                        {row.draftRef ? <div>Draft: {row.draftRef}</div> : null}
                        {row.postRef ? <div>Post: {row.postRef}</div> : null}
                      </>
                    ) : (
                      "—"
                    )}
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
