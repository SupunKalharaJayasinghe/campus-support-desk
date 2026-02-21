import { PageHeader } from "@/components/shared/PageHeader";
import { UserForm } from "@/components/forms/UserForm";
import { Card } from "@/components/ui/Card";

export default function NewAdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Add Admin" showBreadcrumbs />
      <Card>
        <UserForm />
      </Card>
    </div>
  );
}
