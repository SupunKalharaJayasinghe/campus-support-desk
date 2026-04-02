"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import LatestNotificationSection from "@/components/notifications/LatestNotificationSection";
import {
  listNotificationsForUser,
  type NotificationFeedItem,
} from "@/models/notification-center";
import { readStoredUser } from "@/models/rbac";
import type { AppRole } from "@/models/rbac";

interface DashboardLatestNotificationGateProps {
  dashboardPath: string;
  notificationsHref: string;
  fallbackRole: AppRole;
  subtitle?: string;
}

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

export default function DashboardLatestNotificationGate({
  dashboardPath,
  fallbackRole,
  notificationsHref,
  subtitle,
}: DashboardLatestNotificationGateProps) {
  const pathname = usePathname();
  const user = useMemo(() => readStoredUser(), []);
  const [latestNotification, setLatestNotification] =
    useState<NotificationFeedItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    void listNotificationsForUser(user, fallbackRole)
      .then((notifications) => {
        if (cancelled) {
          return;
        }
        setLatestNotification(notifications[0] ?? null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setLatestNotification(null);
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackRole, user]);

  if (normalizePath(pathname ?? "") !== normalizePath(dashboardPath)) {
    return null;
  }

  return (
    <div className="mb-8">
      <LatestNotificationSection
        href={notificationsHref}
        item={latestNotification}
        subtitle={subtitle}
      />
    </div>
  );
}
