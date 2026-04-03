import type { UrgentLevel } from "@/lib/community-urgent";
import { getUrgentConfig } from "@/lib/community-urgent";

/** Luhn check for card numbers (digits only). Not applied to community urgent demo checkout. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * True when the whole PAN is just one short digit group repeated (e.g. all one digit,
 * 232323…, 1234123412341234). Catches obvious fake/demo numbers that may still pass Luhn.
 */
export function isTrivialRepeatingPan(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 2) return false;
  const L = digits.length;
  for (let period = 1; period <= L / 2; period++) {
    if (L % period !== 0) continue;
    const unit = digits.slice(0, period);
    if (unit.repeat(L / period) === digits) return true;
  }
  return false;
}

export function parseCardExpiry(mmYy: string): { month: number; year: number } | null {
  const t = mmYy.replace(/\s+/g, "");
  const m = /^(\d{2})\/(\d{2})$/.exec(t);
  if (!m) return null;
  const month = Number(m[1]);
  const yy = Number(m[2]);
  if (month < 1 || month > 12 || !Number.isFinite(yy)) return null;
  const year = 2000 + yy;
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  if (year < curY || (year === curY && month < curM)) return null;
  return { month, year };
}

export function maskCardDisplay(digits: string): { bin6: string; last4: string; masked: string } {
  const d = digits.replace(/\D/g, "");
  const last4 = d.slice(-4);
  const bin6 = d.length >= 6 ? d.slice(0, 6) : "";
  const innerLen = Math.max(0, d.length - 10);
  const stars = innerLen > 0 ? "•".repeat(Math.min(innerLen, 12)) : "••••••";
  const masked =
    bin6 && last4.length === 4 ? `${bin6}${stars}${last4}` : `****${last4 || "****"}`;
  return { bin6: bin6 || "", last4, masked };
}

export function validateCvc(cvc: string): { ok: boolean; length: number } {
  const t = cvc.replace(/\s+/g, "");
  if (!/^\d{3}$/.test(t)) return { ok: false, length: t.length };
  return { ok: true, length: t.length };
}

export function amountRsForUrgentLevel(level: UrgentLevel): number {
  return getUrgentConfig(level).feeCardRs;
}
