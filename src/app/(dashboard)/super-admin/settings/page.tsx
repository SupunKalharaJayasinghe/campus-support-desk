import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { DegreeCategoryForm } from "@/components/forms/DegreeCategoryForm";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="System settings and defaults." showBreadcrumbs />
      <Card title="Default Configuration">
        <DegreeCategoryForm />
      </Card>
    </div>
  );
}
