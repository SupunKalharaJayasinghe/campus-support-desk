import { PageHeader } from "@/components/shared/PageHeader";
import { NotificationForm } from "@/components/forms/NotificationForm";
import { Card } from "@/components/ui/Card";

export default function LecturerSendNotificationPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Send Notification" showBreadcrumbs />
      <Card>
        <NotificationForm />
      </Card>
    </div>
  );
}
