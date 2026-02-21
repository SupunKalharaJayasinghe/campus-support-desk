"use client";

import { cn } from "@/lib/utils";

export function StatsCard({
  title,
  value,
  icon,
  change,
  trend = "up",
  className
}: {
  title: string;
  value: string;
  icon?: React.ReactNode;
  change?: string;
  trend?: "up" | "down";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{title}</span>
        {icon && <span className="rounded-lg bg-slate-100 p-2">{icon}</span>}
      </div>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
        {change && (
          <span
            className={cn(
              "text-xs font-medium",
              trend === "up" ? "text-green-600" : "text-red-500"
            )}
          >
            {trend === "up" ? "▲" : "▼"} {change}
          </span>
        )}
      </div>
    </div>
  );
}
