import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { NotificationList } from "@/components/features/notifications/NotificationList";
import { Button } from "@/components/ui/Button";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Review received and sent notifications."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/notifications/send">
            <Button>Send Notification</Button>
          </Link>
        }
      />
      <NotificationList />
    </div>
  );
}
