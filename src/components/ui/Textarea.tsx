import type { TextareaHTMLAttributes } from "react";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "ui-textarea min-h-28 w-full rounded-[16px] border border-border bg-card px-3.5 py-2.5 text-sm text-text transition-colors",
        "placeholder:text-text/55 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        className
      )}
      {...props}
    />
  );
}
