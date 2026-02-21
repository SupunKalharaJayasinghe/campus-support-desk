import { PageHeader } from "@/components/shared/PageHeader";
import { FreeTimeForm } from "@/components/forms/FreeTimeForm";
import { Card } from "@/components/ui/Card";

export default function WeeklyFreeTimePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Weekly Schedule" showBreadcrumbs />
      <Card>
        <FreeTimeForm />
      </Card>
    </div>
  );
}
