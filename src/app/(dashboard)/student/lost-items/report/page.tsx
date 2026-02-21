import { PageHeader } from "@/components/shared/PageHeader";
import { LostItemForm } from "@/components/forms/LostItemForm";
import { Card } from "@/components/ui/Card";

export default function ReportLostItemPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Report Lost Item" showBreadcrumbs />
      <Card>
        <LostItemForm />
      </Card>
    </div>
  );
}
