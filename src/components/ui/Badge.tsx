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
  neutral: "border border-border bg-tint text-text/80",
  success: "border border-primary/25 bg-primary/10 text-primary",
  warning: "border border-primary/20 bg-primary/8 text-primaryHover",
  danger: "border border-border bg-tint text-heading",
  primary: "border border-primary/25 bg-primary/12 text-primary",
  info: "border border-border bg-tint text-text/85",
};

export default function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "ui-badge inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        variantClasses[variant],
        className
      )}
      data-variant={variant}
      {...props}
    />
  );
}
