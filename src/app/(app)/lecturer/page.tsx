"use client";

import Card from "@/components/ui/Card";
import { lecturerBookingRequests, lecturerPosts, notificationsByRole } from "@/lib/mockData";

export default function LecturerDashboardPage() {
  const pendingRequests = lecturerBookingRequests.filter((item) => item.status === "Pending").length;
  const unread = notificationsByRole.LECTURER.filter((item) => item.unread).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Lecturer Dashboard</h1>
        <p className="text-sm text-mutedText">Manage availability, bookings, and student support.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-mutedText">Pending bookings</p>
          <p className="mt-2 text-3xl font-semibold text-text">{pendingRequests}</p>
        </Card>
        <Card>
          <p className="text-sm text-mutedText">Unread notifications</p>
          <p className="mt-2 text-3xl font-semibold text-text">{unread}</p>
        </Card>
        <Card>
          <p className="text-sm text-mutedText">Open student posts</p>
          <p className="mt-2 text-3xl font-semibold text-text">{lecturerPosts.length}</p>
        </Card>
      </section>
    </div>
  );
}
