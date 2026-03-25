"use client";

import Card from "@/components/ui/Card";
import { lecturerBookingRequests, lecturerPosts, notificationsByRole } from "@/models/mockData";

export default function LecturerDashboardPage() {
  const pendingRequests = lecturerBookingRequests.filter((item) => item.status === "Pending").length;
  const unread = notificationsByRole.LECTURER.filter((item) => item.unread).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-heading">Lecturer Dashboard</h1>
        <p className="mt-2 text-sm text-text/75">Manage availability, bookings, and student support.</p>
      </div>

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
    </div>
  );
}

