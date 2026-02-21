"use client";

import { Bell } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { Badge } from "@/components/ui/Badge";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDateOrRelative } from "@/lib/utils";

export function NotificationBell() {
  const { notifications, unreadCount } = useNotifications();

  return (
    <Dropdown
      trigger={
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
              {unreadCount}
            </span>
          )}
        </div>
      }
      items={[
        ...notifications.slice(0, 3).map((item) => ({
          label: `${item.title} · ${formatDateOrRelative(item.createdAt)}`,
          onClick: () => undefined,
          icon: (
            <Badge variant={item.read ? "default" : "info"} size="sm">
              {item.type}
            </Badge>
          )
        })),
        { divider: true, label: "divider" },
        {
          label: "View all notifications",
          onClick: () => undefined
        }
      ]}
    />
  );
}
