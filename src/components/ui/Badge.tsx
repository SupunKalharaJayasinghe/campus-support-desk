import type { HTMLAttributes } from "react";

type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "primary"
  | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface2 text-mutedText border border-border",
  success: "border border-primary/20 bg-primary/10 text-primary",
  warning: "border border-primary/25 bg-primary/20 text-primary2",
  danger: "border border-border bg-[rgba(38,21,15,0.08)] text-text",
  primary: "border border-primary bg-primary text-white",
  info: "border border-border bg-surface2 text-text",
};

export default function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
