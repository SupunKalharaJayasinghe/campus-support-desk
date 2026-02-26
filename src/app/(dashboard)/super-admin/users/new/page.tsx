import { PageHeader } from "@/components/shared/PageHeader";
import { UserForm } from "@/components/forms/UserForm";
import { Card } from "@/components/ui/Card";

export default function NewUserPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add User"
        description="Create a new user account."
        showBreadcrumbs
        backHref="/super-admin/users"
      />
      <Card>
        <UserForm />
      </Card>
    </div>
  );
}

