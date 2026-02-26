import type { SelectHTMLAttributes } from "react";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focusRing)] focus-visible:ring-offset-1",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
