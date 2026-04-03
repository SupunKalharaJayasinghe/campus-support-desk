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
        "ui-select w-full rounded-[16px] border border-border bg-card px-3.5 py-2.5 text-sm text-text transition-colors",
        "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
