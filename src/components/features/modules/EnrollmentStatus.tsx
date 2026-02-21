"use client";

import { Badge } from "@/components/ui/Badge";

export function EnrollmentStatus({ status }: { status: "Enrolled" | "Pending" | "Dropped" }) {
  const variant =
    status === "Enrolled" ? "success" : status === "Pending" ? "warning" : "error";

  return <Badge variant={variant}>{status}</Badge>;
}
