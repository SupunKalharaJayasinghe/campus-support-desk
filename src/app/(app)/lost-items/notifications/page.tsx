"use client";

import NotificationCenter from "@/components/notifications/NotificationCenter";

export default function LostItemsNotificationsPage() {
  return (
    <NotificationCenter
      role="LOST_ITEM_STAFF"
      subtitle="Operational alerts and announcements for Lost & Found staff."
      title="Notifications"
    />
  );
}
