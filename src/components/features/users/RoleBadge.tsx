"use client";

import { Badge } from "@/components/ui/Badge";

export function RoleBadge({ role }: { role: string }) {
  const variant =
    role === "Super Admin"
      ? "info"
      : role === "Lecturer"
      ? "success"
      : role === "Student"
      ? "default"
      : "warning";
  return <Badge variant={variant}>{role}</Badge>;
}
