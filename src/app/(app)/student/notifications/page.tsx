"use client";

import NotificationCenter from "@/components/notifications/NotificationCenter";

export default function StudentNotificationsPage() {
  return (
    <NotificationCenter
      role="STUDENT"
      subtitle="Student alerts and announcements targeted to your academic scope."
      title="Notifications"
    />
  );
}
