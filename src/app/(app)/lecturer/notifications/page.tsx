"use client";

import NotificationCenter from "@/components/notifications/NotificationCenter";

export default function LecturerNotificationsPage() {
  return (
    <NotificationCenter
      role="LECTURER"
      subtitle="Lecturer and lab-assistant updates filtered to your assigned audience scope."
      title="Notifications"
    />
  );
}
