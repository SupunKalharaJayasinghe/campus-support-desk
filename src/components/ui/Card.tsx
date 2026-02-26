import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function Card({
  title,
  description,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
      {...props}
    >
      {title ? <h3 className="text-base font-semibold text-slate-900">{title}</h3> : null}
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      {children ? <div className={cn(title || description ? "mt-4" : "")}>{children}</div> : null}
    </div>
  );
}
