"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import TopNav from "@/components/layout/TopNav";
import Container from "@/components/ui/Container";
import {
  listAnnouncements,
  type AnnouncementRecord,
} from "@/models/announcement-center";
import { readStoredUser } from "@/models/rbac";
import type { AppRole } from "@/models/rbac";

interface PortalConfig {
  homeHref: string;
  links: Array<{ label: string; href: string }>;
  title: string;
}

const CONFIG_BY_ROLE: Record<AppRole, PortalConfig> = {
  SUPER_ADMIN: {
    homeHref: "/admin",
    links: [
      { label: "Dashboard", href: "/admin" },
      { label: "Announcements", href: "/announcements" },
      { label: "Notifications", href: "/notifications" },
    ],
    title: "All Announcements",
  },
  LECTURER: {
    homeHref: "/lecturer",
    links: [
      { label: "Dashboard", href: "/lecturer" },
      { label: "Announcements", href: "/announcements" },
      { label: "Notifications", href: "/notifications" },
    ],
    title: "All Announcements",
  },
  LOST_ITEM_STAFF: {
    homeHref: "/lost-items",
    links: [
      { label: "Dashboard", href: "/lost-items" },
      { label: "Announcements", href: "/announcements" },
      { label: "Notifications", href: "/notifications" },
    ],
    title: "All Announcements",
  },
  STUDENT: {
    homeHref: "/student",
    links: [
      { label: "Dashboard", href: "/student" },
      { label: "Announcements", href: "/announcements" },
      { label: "Notifications", href: "/notifications" },
    ],
    title: "All Announcements",
  },
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

export default function AnnouncementsPortalPage() {
  const user = useMemo(() => readStoredUser(), []);
  const role = user?.role ?? "STUDENT";
  const config = CONFIG_BY_ROLE[role] ?? CONFIG_BY_ROLE.STUDENT;
  const [items, setItems] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnnouncements = useCallback(async () => {
    try {
      const rows = await listAnnouncements();
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav homeHref={config.homeHref} links={config.links} />
      <main className="px-0 pb-8 pt-20">
        <Container size="6xl">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-semibold text-heading">
                  {config.title}
                </h1>
                <p className="mt-2 text-sm text-text/75">
                  Latest announcements published by the administration.
                </p>
              </div>
              {role === "SUPER_ADMIN" ? (
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#034aa6] px-5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
                  href="/admin/communication/announcements"
                >
                  Manage Announcements
                </Link>
              ) : null}
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="rounded-3xl border border-border bg-card p-6 text-sm text-text/70">
                  Loading announcements...
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-3xl border border-border bg-card p-6 text-sm text-text/70">
                  No announcements available yet.
                </div>
              ) : (
                items.map((item) => (
                  <div
                    className="rounded-3xl border border-border bg-card p-5"
                    key={item.id}
                  >
                    <p className="text-base font-semibold text-heading">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-text/60">
                      {item.targetLabel} • {formatDateTime(item.createdAt)}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-text/75">
                      {item.message}
                    </p>
                    <p className="mt-3 text-xs text-text/60">
                      Published by {item.createdBy}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
