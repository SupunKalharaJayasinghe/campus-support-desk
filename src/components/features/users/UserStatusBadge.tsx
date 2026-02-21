"use client";

import { Badge } from "@/components/ui/Badge";

export function UserStatusBadge({ status }: { status: "Active" | "Inactive" | "Pending" }) {
  const variant =
    status === "Active" ? "success" : status === "Pending" ? "warning" : "error";
  return <Badge variant={variant}>{status}</Badge>;
}
