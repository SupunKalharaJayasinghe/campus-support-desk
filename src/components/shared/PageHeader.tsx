"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Button } from "@/components/ui/Button";

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = "Back",
  showBreadcrumbs = false
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  showBreadcrumbs?: boolean;
}) {
  const pathname = usePathname();
  const derivedTitle = title ?? toTitleCase(pathname.split("/").slice(-1)[0] ?? "");
  const resolvedActions = (backHref || actions) && (
    <div className="flex flex-wrap gap-2">
      {backHref && (
        <Link href={backHref}>
          <Button
            variant="outline"
            iconLeft={<ArrowLeft className="h-4 w-4" />}
          >
            {backLabel}
          </Button>
        </Link>
      )}
      {actions}
    </div>
  );

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
        {resolvedActions}
      </div>
    </div>
  );
}
