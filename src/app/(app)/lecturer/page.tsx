"use client";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import {
  getConsultationBookingBadgeVariant,
  getConsultationBookingStatusLabel,
  isActiveConsultationBookingStatus,
} from "@/models/consultation-booking";
import { lecturerBookingRequests, lecturerPosts, notificationsByRole } from "@/models/mockData";

export default function LecturerDashboardPage() {
  const pendingRequests = lecturerBookingRequests.filter((item) => item.status === "PENDING").length;
  const unread = notificationsByRole.LECTURER.filter((item) => item.unread).length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcomingSessions = [...lecturerBookingRequests]
    .filter((item) => isActiveConsultationBookingStatus(item.status))
    .sort((left, right) => {
      const leftDate = `${left.date} ${left.start}`;
      const rightDate = `${right.date} ${right.start}`;
      return leftDate.localeCompare(rightDate);
    });
  const todaysSessions = upcomingSessions.filter((item) => item.date === todayKey);
  const scheduleItems = todaysSessions.length > 0 ? todaysSessions : upcomingSessions.slice(0, 3);
  const recentActivity = notificationsByRole.LECTURER.slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-heading">Lecturer Dashboard</h1>
        <p className="mt-2 text-sm text-text/75">Manage availability, bookings, and student support.</p>
      </div>

      <section className="grid gap-5 sm:grid-cols-3">
        <Card accent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text/72">Pending bookings</p>
            <Badge variant="warning">Needs review</Badge>
          </div>
          <p className="mt-2 text-3xl font-semibold text-heading">{pendingRequests}</p>
          <p className="mt-1 text-xs text-text/60">Action required</p>
        </Card>
        <Card accent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text/72">Unread notifications</p>
            <Badge variant="info">Updates</Badge>
          </div>
          <p className="mt-2 text-3xl font-semibold text-heading">{unread}</p>
          <p className="mt-1 text-xs text-text/60">Last 24 hours</p>
        </Card>
        <Card accent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text/72">Open student posts</p>
            <Badge variant="primary">Community</Badge>
          </div>
          <p className="mt-2 text-3xl font-semibold text-heading">{lecturerPosts.length}</p>
          <p className="mt-1 text-xs text-text/60">Awaiting replies</p>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Today's Schedule"
          description={todaysSessions.length > 0 ? "Sessions planned for today" : "No sessions today"}
        >
          {scheduleItems.length === 0 ? (
            <p className="text-sm text-text/70">No upcoming sessions found.</p>
          ) : (
            <div className="space-y-3">
              {scheduleItems.map((session) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-tint px-4 py-3"
                  key={session.id}
                >
                  <div>
                    <p className="text-sm font-semibold text-heading">{session.studentName}</p>
                    <p className="text-xs text-text/70">
                      {session.date} • {session.start} - {session.end}
                    </p>
                    <p className="text-xs text-text/60">{session.topic}</p>
                  </div>
                  <Badge variant={getConsultationBookingBadgeVariant(session.status)}>
                    {getConsultationBookingStatusLabel(session.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent Activity" description="Latest notifications and alerts">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-text/70">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border px-4 py-3"
                  key={item.id}
                >
                  <div>
                    <p className="text-sm font-semibold text-heading">{item.title}</p>
                    <p className="text-xs text-text/70">{item.message}</p>
                    <p className="mt-1 text-[11px] text-text/55">{item.time}</p>
                  </div>
                  <Badge variant={item.unread ? "primary" : "neutral"}>
                    {item.unread ? "Unread" : "Seen"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

