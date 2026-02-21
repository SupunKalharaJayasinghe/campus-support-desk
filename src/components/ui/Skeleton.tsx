"use client";

import { cn } from "@/lib/utils";

type SkeletonVariant = "text" | "circle" | "rectangle";

export function Skeleton({
  variant = "text",
  className
}: {
  variant?: SkeletonVariant;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-100",
        variant === "circle" && "rounded-full",
        className
      )}
    />
  );
}
