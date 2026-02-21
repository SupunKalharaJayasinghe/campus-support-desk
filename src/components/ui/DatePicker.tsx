"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  error,
  helper,
  disabled
}: {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  error?: string;
  helper?: string;
  disabled?: boolean;
}) {
  const inputId = useId();
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className={cn(
          "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200",
          disabled && "bg-slate-100 text-slate-400",
          error && "border-red-300 focus:border-red-500 focus:ring-red-200"
        )}
      />
      {helper && !error && (
        <p className="text-xs text-slate-500">{helper}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
