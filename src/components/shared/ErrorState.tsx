"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ErrorState({
  title,
  description,
  onRetry
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50 px-6 py-10 text-center text-red-700">
      <AlertTriangle className="h-6 w-6" />
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="text-sm">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
