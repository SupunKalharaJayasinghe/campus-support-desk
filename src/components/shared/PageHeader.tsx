"use client";

import { usePathname } from "next/navigation";
import { toTitleCase } from "@/lib/utils";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export function PageHeader({
  title,
  description,
  actions,
  showBreadcrumbs = false
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  showBreadcrumbs?: boolean;
}) {
  const pathname = usePathname();
  const derivedTitle = title ?? toTitleCase(pathname.split("/").slice(-1)[0] ?? "");

  return (
    <div className="flex flex-col gap-4">
      {showBreadcrumbs && <Breadcrumbs />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            {derivedTitle}
          </h1>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
