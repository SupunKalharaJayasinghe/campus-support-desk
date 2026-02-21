"use client";

import { cn } from "@/lib/utils";

interface CardProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  hoverable?: boolean;
  className?: string;
}

export function Card({
  title,
  description,
  actions,
  footer,
  children,
  hoverable,
  className
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        hoverable && "transition hover:-translate-y-0.5 hover:shadow-md",
        className
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h3 className="text-base font-semibold">{title}</h3>}
            {description && (
              <p className="text-sm text-slate-500">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children && <div className="px-5 py-4">{children}</div>}
      {footer && (
        <div className="border-t border-slate-100 px-5 py-4">{footer}</div>
      )}
    </div>
  );
}
