"use client";

import { Badge } from "@/components/ui/Badge";

export function ProRataRepeatBadge({ status }: { status: "Pro-rata" | "Repeat" | "Clear" }) {
  const variant =
    status === "Clear" ? "success" : status === "Pro-rata" ? "warning" : "error";
  return <Badge variant={variant}>{status}</Badge>;
}
