"use client";

import { useMemo } from "react";
import TopNav from "@/components/layout/TopNav";
import Container from "@/components/ui/Container";
import { readStoredUser } from "@/models/rbac";
import type { AppRole } from "@/models/rbac";
import NotificationCenter from "./NotificationCenter";

interface NotificationPortalConfig {
  homeHref: string;
  links: Array<{ label: string; href: string }>;
  subtitle: string;
}

const NOTIFICATIONS_LINK = { label: "Notifications", href: "/notifications" };

const STUDENT_NOTIFICATION_CONFIG: NotificationPortalConfig = {
  homeHref: "/student",
  links: [
    { label: "Dashboard", href: "/student" },
    NOTIFICATIONS_LINK,
    { label: "Book Lecturer", href: "/student/booking" },
    { label: "Report Lost Item", href: "/student/lost-items" },
    { label: "Announcements", href: "/student/announcements" },
    { label: "Help Requests", href: "/student/support" },
  ],
  subtitle: "All notifications targeted to your student profile.",
};

const CONFIG_BY_ROLE: { [K in AppRole]?: NotificationPortalConfig } = {
  SUPER_ADMIN: {
    homeHref: "/admin",
    links: [
      { label: "Dashboard", href: "/admin" },
      NOTIFICATIONS_LINK,
      { label: "Targeting", href: "/admin/communication/targeted-notifications" },
    ],
    subtitle: "All notifications targeted to your admin account.",
  },
  LECTURER: {
    homeHref: "/lecturer",
    links: [
      { label: "Dashboard", href: "/lecturer" },
      { label: "Availability", href: "/lecturer/availability" },
      { label: "Bookings", href: "/lecturer/bookings" },
      NOTIFICATIONS_LINK,
      { label: "Posts", href: "/lecturer/posts" },
    ],
    subtitle: "All notifications targeted to your lecturer account.",
  },
  LOST_ITEM_STAFF: {
    homeHref: "/lost-items",
    links: [
      { label: "Dashboard", href: "/lost-items" },
      { label: "Found Items", href: "/lost-items/found" },
      { label: "Claims", href: "/lost-items/claims" },
      { label: "Inventory", href: "/lost-items/inventory" },
      NOTIFICATIONS_LINK,
    ],
    subtitle: "All notifications targeted to Lost & Found operations.",
  },
  STUDENT: STUDENT_NOTIFICATION_CONFIG,
};

export default function AllNotificationsPage() {
  const user = useMemo(() => readStoredUser(), []);
  const role = user?.role ?? "STUDENT";
  const config = CONFIG_BY_ROLE[role] ?? STUDENT_NOTIFICATION_CONFIG;

  return (
    <div className="min-h-screen bg-bg">
      <TopNav homeHref={config.homeHref} links={config.links} />
      <main className="px-0 pb-8 pt-20">
        <Container size="6xl">
          <NotificationCenter
            role={role}
            subtitle={config.subtitle}
            title="All Notifications"
          />
        </Container>
      </main>
    </div>
  );
}
