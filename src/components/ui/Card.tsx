import type { HTMLAttributes } from "react";

type CardVariant = "default" | "subtle";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  variant?: CardVariant;
  accent?: boolean;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function Card({
  title,
  description,
  variant = "default",
  accent = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6",
        variant === "default"
          ? "border-border bg-card shadow-shadow"
          : "border-border bg-tint",
        className
      )}
      {...props}
    >
      {accent ? (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-20 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(3,74,166,0.12), rgba(3,57,166,0.06), transparent 60%)",
          }}
        />
      ) : null}
      {title ? <h3 className="text-base font-semibold text-heading">{title}</h3> : null}
      {description ? <p className="mt-1 text-sm text-text/72">{description}</p> : null}
      {children ? <div className={cn(title || description ? "mt-4" : "")}>{children}</div> : null}
    </div>
  );
}
