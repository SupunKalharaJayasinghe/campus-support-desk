import { useMemo } from "react";
import { mockNotifications } from "@/lib/mock-data";

export function useNotifications() {
  const notifications = useMemo(() => mockNotifications, []);
  const unreadCount = notifications.filter((item) => !item.read).length;
  return {
    notifications,
    unreadCount,
    loading: false
  };
}
