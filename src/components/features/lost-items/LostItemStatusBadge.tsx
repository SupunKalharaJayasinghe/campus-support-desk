"use client";

import { Badge } from "@/components/ui/Badge";

export function LostItemStatusBadge({
  status
}: {
  status: "Pending" | "Approved" | "Claimed" | "Returned" | "Rejected";
}) {
  const variant =
    status === "Approved"
      ? "success"
      : status === "Pending"
      ? "warning"
      : status === "Rejected"
      ? "error"
      : "info";

  return <Badge variant={variant}>{status}</Badge>;
}
