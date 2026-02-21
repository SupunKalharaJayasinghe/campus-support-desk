import { PageHeader } from "@/components/shared/PageHeader";
import { NotificationForm } from "@/components/forms/NotificationForm";
import { Card } from "@/components/ui/Card";

export default function ContactAdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Contact Admin" showBreadcrumbs />
      <Card>
        <NotificationForm />
      </Card>
    </div>
  );
}
