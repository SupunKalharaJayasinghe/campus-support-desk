export type UrgentLevel = "2days" | "5days" | "7days";
export type UrgentPaymentMethod = "points" | "card";

export const URGENT_LEVELS: Array<{
  level: UrgentLevel;
  label: string;
  days: number;
  feePoints: number;
  /** Demo card checkout amount in INR (rs); not community points. */
  feeCardRs: number;
}> = [
    { level: "2days", label: "2 days", days: 2, feePoints: 20, feeCardRs: 200 },
    { level: "5days", label: "5 days", days: 5, feePoints: 40, feeCardRs: 350 },
    { level: "7days", label: "7 days", days: 7, feePoints: 60, feeCardRs: 500 },
];

export function getUrgentConfig(level: UrgentLevel) {
  const cfg = URGENT_LEVELS.find((x) => x.level === level);
  return cfg ?? URGENT_LEVELS[0];
}

/** Fee columns stored on drafts/posts — derived server-side from level + method (do not trust client amounts). */
export function urgentFeeFieldsForDb(
  isUrgent: boolean,
  level: UrgentLevel | null,
  method: UrgentPaymentMethod | null
): { urgentFeePoints: number | null; urgentFeeRs: number | null } {
  if (!isUrgent || !level || !method) {
    return { urgentFeePoints: null, urgentFeeRs: null };
  }
  const cfg = getUrgentConfig(level);
  if (method === "card") {
    return { urgentFeePoints: null, urgentFeeRs: cfg.feeCardRs };
  }
  return { urgentFeePoints: cfg.feePoints, urgentFeeRs: null };
}

export function calcUrgentExpiresAt(level: UrgentLevel, now = new Date()) {
  const cfg = getUrgentConfig(level);
  const expires = new Date(now);
  expires.setDate(expires.getDate() + cfg.days);
  return expires;
}

