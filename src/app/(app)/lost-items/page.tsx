"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import LatestNotificationSection from "@/components/notifications/LatestNotificationSection";
import RecentNotificationsCard from "@/components/notifications/RecentNotificationsCard";
import {
  listLatestAnnouncements,
  type AnnouncementRecord,
} from "@/models/announcement-center";
import {
  listNotificationsForRole,
  type NotificationFeedItem,
} from "@/models/notification-center";
import { PORTAL_DATA_KEYS, loadPortalData } from "@/models/portal-data";
import type { FoundItemRecord, LostItemReport } from "@/models/portal-types";

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

export default function LostItemsDashboardPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [pending, setPending] = useState(0);
  const [verified, setVerified] = useState(0);
  const [stored, setStored] = useState(0);
  const [notifications, setNotifications] = useState<NotificationFeedItem[]>([]);
  const latestNotification = notifications[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listLatestAnnouncements(3).catch(() => [] as AnnouncementRecord[]),
      listNotificationsForRole("LOST_ITEM_STAFF").catch(
        () => [] as NotificationFeedItem[]
      ),
      loadPortalData<LostItemReport[]>(PORTAL_DATA_KEYS.lostItemReports, []),
      loadPortalData<FoundItemRecord[]>(PORTAL_DATA_KEYS.foundItems, []),
    ]).then(([latestAnnouncements, scopedNotifications, reports, foundItems]) => {
      if (cancelled) {
        return;
      }

      setAnnouncements(latestAnnouncements);
      setNotifications(scopedNotifications);
      setPending(
        reports.filter((item) => item.status === "Pending Review").length
      );
      setVerified(reports.filter((item) => item.status === "Verified").length);
      setStored(foundItems.filter((item) => item.status === "Stored").length);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

