"use client";

import { useMemo } from "react";
import LatestNotificationSection from "@/components/notifications/LatestNotificationSection";
import RecentNotificationsCard from "@/components/notifications/RecentNotificationsCard";
import Card from "@/components/ui/Card";
import { resolveNotificationsForUser } from "@/models/notification-center";
import { lecturerBookingRequests, lecturerPosts } from "@/models/mockData";
import { readStoredUser } from "@/models/rbac";

export default function LecturerDashboardPage() {
  const user = useMemo(() => readStoredUser(), []);
  const scopedNotifications = useMemo(
    () => resolveNotificationsForUser(user, "LECTURER"),
    [user]
  );
  const latestNotification = scopedNotifications[0] ?? null;
  const pendingRequests = lecturerBookingRequests.filter((item) => item.status === "Pending").length;
  const unread = scopedNotifications.filter((item) => item.unread).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-heading">Lecturer Dashboard</h1>
        <p className="mt-2 text-sm text-text/75">Manage availability, bookings, and student support.</p>
      </div>

      <LatestNotificationSection
        href="/lecturer/notifications"
        item={latestNotification}
      />

      <section className="grid gap-5 sm:grid-cols-3">
        <Card accent>
          <p className="text-sm text-text/72">Pending bookings</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{pendingRequests}</p>
        </Card>
        <Card accent>
          <p className="text-sm text-text/72">Unread notifications</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{unread}</p>
        </Card>
        <Card accent>
          <p className="text-sm text-text/72">Open student posts</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{lecturerPosts.length}</p>
        </Card>
      </section>

      <RecentNotificationsCard
        href="/lecturer/notifications"
        items={scopedNotifications}
        title="Recent Alerts"
      />
    </div>
  );
}

