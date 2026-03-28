import Card from "@/components/ui/Card";
import LatestNotificationSection from "@/components/notifications/LatestNotificationSection";
import RecentNotificationsCard from "@/components/notifications/RecentNotificationsCard";
import { resolveNotificationsForRole } from "@/models/notification-center";
import { foundItemsSeed, lostItemReports } from "@/models/mockData";

export default function LostItemsDashboardPage() {
  const pending = lostItemReports.filter((item) => item.status === "Pending Review").length;
  const verified = lostItemReports.filter((item) => item.status === "Verified").length;
  const stored = foundItemsSeed.filter((item) => item.status === "Stored").length;
  const notifications = resolveNotificationsForRole("LOST_ITEM_STAFF");
  const latestNotification = notifications[0] ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-heading">Lost & Found Dashboard</h1>
        <p className="mt-2 text-sm text-text/75">Operational overview for queue, found register, and claims.</p>
      </div>

      <LatestNotificationSection
        href="/notifications"
        item={latestNotification}
      />

      <section className="grid gap-5 sm:grid-cols-3">
        <Card accent>
          <p className="text-sm text-text/72">Pending review</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{pending}</p>
        </Card>
        <Card accent>
          <p className="text-sm text-text/72">Verified reports</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{verified}</p>
        </Card>
        <Card accent>
          <p className="text-sm text-text/72">Stored found items</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{stored}</p>
        </Card>
      </section>

      <RecentNotificationsCard
        href="/notifications"
        items={notifications}
      />
    </div>
  );
}

