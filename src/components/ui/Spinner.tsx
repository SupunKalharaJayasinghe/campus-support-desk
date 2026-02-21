"use client";

import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";
type SpinnerColor = "primary" | "white" | "slate";

const sizeStyles: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10"
};

const colorStyles: Record<SpinnerColor, string> = {
  primary: "border-indigo-600 border-t-transparent",
  white: "border-white border-t-transparent",
  slate: "border-slate-500 border-t-transparent"
};

export function Spinner({
  size = "md",
  color = "primary",
  className
}: {
  size?: SpinnerSize;
  color?: SpinnerColor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-2",
        sizeStyles[size],
        colorStyles[color],
        className
      )}
      aria-label="Loading"
      role="status"
    />
  );
}
