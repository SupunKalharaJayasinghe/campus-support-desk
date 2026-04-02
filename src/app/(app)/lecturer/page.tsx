"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";
import { listLecturerConsultationBookings, type ConsultationBookingApiRecord } from "@/lib/consultation-client";
import {
  getConsultationBookingBadgeVariant,
  getConsultationBookingStatusLabel,
  isActiveConsultationBookingStatus,
} from "@/models/consultation-booking";
import { lecturerPosts, notificationsByRole } from "@/models/mockData";

export default function LecturerDashboardPage() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<ConsultationBookingApiRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const payload = await listLecturerConsultationBookings();
        if (!cancelled) {
          setBookings(payload.items);
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Dashboard data unavailable",
            message: error instanceof Error ? error.message : "Failed to load booking summary.",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const unread = notificationsByRole.LECTURER.filter((item) => item.unread).length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const pendingRequests = bookings.filter((item) => item.status === "PENDING").length;
  const upcomingSessions = useMemo(
    () =>
      [...bookings]
        .filter((item) => isActiveConsultationBookingStatus(item.status) && item.slot)
        .sort((left, right) =>
          `${left.slot?.date ?? ""} ${left.slot?.startTime ?? ""}`.localeCompare(
            `${right.slot?.date ?? ""} ${right.slot?.startTime ?? ""}`
          )
        ),
    [bookings]
  );
  const todaysSessions = upcomingSessions.filter((item) => item.slot?.date === todayKey);
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
            <Badge variant="warning">Live</Badge>
          </div>
          <p className="mt-2 text-3xl font-semibold text-heading">{pendingRequests}</p>
          <p className="mt-1 text-xs text-text/60">From consultation booking API</p>
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
          description={todaysSessions.length > 0 ? "Sessions planned for today" : "Upcoming consultation sessions"}
        >
          {loading ? (
            <p className="text-sm text-text/70">Loading schedule...</p>
          ) : scheduleItems.length === 0 ? (
            <p className="text-sm text-text/70">No upcoming sessions found.</p>
          ) : (
            <div className="space-y-3">
              {scheduleItems.map((session) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-tint px-4 py-3"
                  key={session.id}
                >
                  <div>
                    <p className="text-sm font-semibold text-heading">{session.student?.fullName ?? session.studentId}</p>
                    <p className="text-xs text-text/70">
                      {session.slot?.date} • {session.slot?.startTime} - {session.slot?.endTime}
                    </p>
                    <p className="text-xs text-text/60">{session.slot?.sessionType ?? session.purpose}</p>
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
