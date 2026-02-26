import type { HTMLAttributes } from "react";

type CardVariant = "default" | "subtle";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  variant?: CardVariant;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function Card({
  title,
  description,
  variant = "default",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        variant === "default"
          ? "border-border bg-surface shadow-card"
          : "border-border bg-surface2",
        className
      )}
      {...props}
    >
      {title ? <h3 className="text-base font-semibold text-text">{title}</h3> : null}
      {description ? <p className="mt-1 text-sm text-mutedText">{description}</p> : null}
      {children ? <div className={cn(title || description ? "mt-4" : "")}>{children}</div> : null}
    </div>
  );
}
