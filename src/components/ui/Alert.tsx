"use client";

import { cn } from "@/lib/utils";
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";
import { useState } from "react";

type AlertVariant = "success" | "warning" | "error" | "info";

const variantStyles: Record<AlertVariant, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-indigo-200 bg-indigo-50 text-indigo-800"
};

const variantIcons: Record<AlertVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  error: <XCircle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />
};

export function Alert({
  variant = "info",
  title,
  description,
  dismissible,
  className
}: {
  variant?: AlertVariant;
  title?: string;
  description?: string;
  dismissible?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        variantStyles[variant],
        className
      )}
      role="alert"
    >
      <span className="mt-0.5">{variantIcons[variant]}</span>
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {description && <p className="text-sm">{description}</p>}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full p-1 text-current hover:bg-black/5"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
