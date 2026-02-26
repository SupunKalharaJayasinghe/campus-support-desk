import type { InputHTMLAttributes } from "react";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text",
        "placeholder:text-mutedText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focusRing)] focus-visible:ring-offset-1",
        className
      )}
      {...props}
    />
  );
}
