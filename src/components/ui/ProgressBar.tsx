"use client";

import { cn } from "@/lib/utils";

type ProgressVariant = "primary" | "success" | "warning" | "error";

const variantStyles: Record<ProgressVariant, string> = {
  primary: "bg-indigo-600",
  success: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500"
};

export function ProgressBar({
  value,
  variant = "primary",
  showValue = false
}: {
  value: number;
  variant?: ProgressVariant;
  showValue?: boolean;
}) {
  return (
    <div className="w-full space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full transition-all", variantStyles[variant])}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showValue && <p className="text-xs text-slate-500">{value}%</p>}
    </div>
  );
}
