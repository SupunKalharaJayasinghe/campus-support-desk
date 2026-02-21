"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";

export function PlaceholderPage({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} showBreadcrumbs />
      {children ?? (
        <Card title={title}>
          <p className="text-sm text-slate-600">
            Placeholder content for {title}. Replace with feature-specific UI.
          </p>
        </Card>
      )}
    </div>
  );
}
