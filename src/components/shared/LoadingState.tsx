"use client";

import { Spinner } from "@/components/ui/Spinner";

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
      <Spinner size="lg" />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  );
}
