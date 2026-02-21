import { PageHeader } from "@/components/shared/PageHeader";
import { FreeTimeExceptionForm } from "@/components/forms/FreeTimeExceptionForm";
import { Card } from "@/components/ui/Card";

export default function FreeTimeExceptionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Schedule Exceptions" showBreadcrumbs />
      <Card>
        <FreeTimeExceptionForm />
      </Card>
    </div>
  );
}
