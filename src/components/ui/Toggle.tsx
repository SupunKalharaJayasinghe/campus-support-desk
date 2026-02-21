"use client";

import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onChange,
  label,
  disabled
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-slate-600">
      <button
        type="button"
        onClick={() => !disabled && onChange?.(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full border transition",
          checked
            ? "border-indigo-600 bg-indigo-600"
            : "border-slate-200 bg-slate-100",
          disabled && "cursor-not-allowed opacity-70"
        )}
        aria-pressed={checked}
        aria-label={label}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
            checked && "translate-x-5"
          )}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}
