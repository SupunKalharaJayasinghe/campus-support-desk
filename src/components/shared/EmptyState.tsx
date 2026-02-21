"use client";

import { Button } from "@/components/ui/Button";

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <div className="rounded-full bg-slate-100 p-3 text-slate-500">{icon}</div>
      <div>
        <h3 className="text-base font-semibold text-slate-700">{title}</h3>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {actionLabel && (
        <Button onClick={onAction} variant="outline">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
