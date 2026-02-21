"use client";

import { Badge } from "@/components/ui/Badge";

export function PassFailIndicator({ passed }: { passed: boolean }) {
  return <Badge variant={passed ? "success" : "error"}>{passed ? "Pass" : "Fail"}</Badge>;
}
