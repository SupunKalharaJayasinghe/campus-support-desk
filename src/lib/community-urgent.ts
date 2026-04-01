export type UrgentLevel = "2days" | "5days" | "7days";
export type UrgentPaymentMethod = "points" | "card";

export const URGENT_LEVELS: Array<{
  level: UrgentLevel;
  label: string;
  days: number;
  feePoints: number;
}> = [
  { level: "2days", label: "2 days", days: 2, feePoints: 20 },
  { level: "5days", label: "5 days", days: 5, feePoints: 40 },
  { level: "7days", label: "7 days", days: 7, feePoints: 60 },
];

export function getUrgentConfig(level: UrgentLevel) {
  const cfg = URGENT_LEVELS.find((x) => x.level === level);
  return cfg ?? URGENT_LEVELS[0];
}

export function calcUrgentExpiresAt(level: UrgentLevel, now = new Date()) {
  const cfg = getUrgentConfig(level);
  const expires = new Date(now);
  expires.setDate(expires.getDate() + cfg.days);
  return expires;
}

