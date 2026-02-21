import { PageHeader } from "@/components/shared/PageHeader";
import { UserForm } from "@/components/forms/UserForm";
import { Card } from "@/components/ui/Card";

export default function NewLostItemStaffPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Add Lost Item Staff" showBreadcrumbs />
      <Card>
        <UserForm />
      </Card>
    </div>
  );
}
