"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LatestNotificationSection from "@/components/notifications/LatestNotificationSection";
import RecentNotificationsCard from "@/components/notifications/RecentNotificationsCard";
import Card from "@/components/ui/Card";
import {
  listLatestAnnouncements,
  type AnnouncementRecord,
} from "@/models/announcement-center";
import {
  listNotificationsForUser,
  type NotificationFeedItem,
} from "@/models/notification-center";
import { PORTAL_DATA_KEYS, loadPortalData } from "@/models/portal-data";
import type { ConsultationBooking, PostItem } from "@/models/portal-types";
import { readStoredUser } from "@/models/rbac";

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

export default function LecturerDashboardPage() {
  const user = useMemo(() => readStoredUser(), []);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [scopedNotifications, setScopedNotifications] = useState<
    NotificationFeedItem[]
  >([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [openStudentPosts, setOpenStudentPosts] = useState(0);
  const latestNotification = scopedNotifications[0] ?? null;
  const unread = scopedNotifications.filter((item) => item.unread).length;

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listLatestAnnouncements(3).catch(() => [] as AnnouncementRecord[]),
      listNotificationsForUser(user, "LECTURER").catch(
        () => [] as NotificationFeedItem[]
      ),
      loadPortalData<ConsultationBooking[]>(
        PORTAL_DATA_KEYS.consultationBookings,
        []
      ),
      loadPortalData<PostItem[]>(PORTAL_DATA_KEYS.discussionPosts, []),
    ]).then(([latestAnnouncements, notifications, bookings, posts]) => {
      if (cancelled) {
        return;
      }

      const userId = String(user?.id ?? "").trim();
      const userName = String(user?.name ?? "")
        .trim()
        .toLowerCase();

      const pending = bookings.filter((item) => {
        if (item.status !== "Pending") {
          return false;
        }

        if (userId && String(item.lecturerUserId ?? "").trim() === userId) {
          return true;
        }

        if (userName && String(item.lecturer ?? "").trim().toLowerCase() === userName) {
          return true;
        }

        return !userId && !userName;
      }).length;

      const openPosts = posts.filter((item) => item.status === "Open").length;

      setAnnouncements(latestAnnouncements);
      setScopedNotifications(notifications);
      setPendingRequests(pending);
      setOpenStudentPosts(openPosts);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-heading">Lecturer Dashboard</h1>
        <p className="mt-2 text-sm text-text/75">Manage availability, bookings, and student support.</p>
      </div>

      <LatestNotificationSection
        href="/notifications"
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
          <p className="mt-2 text-3xl font-semibold text-heading">{openStudentPosts}</p>
        </Card>
      </section>

      <RecentNotificationsCard
        href="/notifications"
        items={scopedNotifications}
        title="Recent Alerts"
      />

      <Card title="Latest Announcements">
        {announcements.length === 0 ? (
          <p className="text-sm text-text/70">No announcements available yet.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((item) => (
              <div className="rounded-2xl bg-tint p-3.5" key={item.id}>
                <p className="text-sm font-medium text-text">{item.title}</p>
                <p className="mt-1 text-xs text-text/72">{item.message}</p>
                <p className="mt-2 text-[11px] text-text/65">{formatDateTime(item.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-heading hover:bg-tint"
            href="/announcements"
          >
            View All
          </Link>
        </div>
      </Card>
    </div>
  );
}

