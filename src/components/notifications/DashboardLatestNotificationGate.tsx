"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import LatestNotificationSection from "@/components/notifications/LatestNotificationSection";
import { resolveNotificationsForUser } from "@/models/notification-center";
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
  const latestNotification = useMemo(() => {
    const notifications = resolveNotificationsForUser(user, fallbackRole);
    return notifications[0] ?? null;
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
