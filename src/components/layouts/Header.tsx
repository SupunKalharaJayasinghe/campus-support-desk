"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { toTitleCase } from "@/lib/utils";

export function Header({
  title,
  actions,
  onMenuToggle,
  rightSlot
}: {
  title?: string;
  actions?: React.ReactNode;
  onMenuToggle?: () => void;
  rightSlot?: React.ReactNode;
}) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const derivedTitle =
    title ?? toTitleCase(segments[segments.length - 1] ?? "Dashboard");
  const showBreadcrumbs = segments.length > 2;

  return (
    <header className="flex flex-col gap-4 border-b border-slate-100 bg-white/70 px-4 py-4 backdrop-blur md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onMenuToggle && (
            <button
              type="button"
              onClick={onMenuToggle}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 md:hidden"
              aria-label="Toggle menu"
            >
              <span className="block h-0.5 w-5 bg-slate-600" />
              <span className="mt-1 block h-0.5 w-5 bg-slate-600" />
              <span className="mt-1 block h-0.5 w-5 bg-slate-600" />
            </button>
          )}
          <div>
            {showBreadcrumbs && <Breadcrumbs />}
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {derivedTitle}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">{rightSlot}</div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
