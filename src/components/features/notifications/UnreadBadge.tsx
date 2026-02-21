"use client";

import { Badge } from "@/components/ui/Badge";

export function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return <Badge variant="info">{count} unread</Badge>;
}
