"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { notificationsByRole } from "@/lib/mockData";

export default function LecturerNotificationsPage() {
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  const notifications = useMemo(
    () =>
      notificationsByRole.LECTURER.map((item) => ({
        ...item,
        isRead: readMap[item.id] ?? !item.unread,
      })),
    [readMap]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Notifications</h1>
          <p className="text-sm text-text/72">Lecturer updates and operational alerts.</p>
        </div>
        <Button
          onClick={() => {
            const next: Record<string, boolean> = {};
            for (const item of notificationsByRole.LECTURER) {
              next[item.id] = true;
            }
            setReadMap(next);
          }}
          variant="secondary"
        >
          Mark all read
        </Button>
      </div>

      <div className="space-y-3">
        {notifications.map((item) => (
          <Card className={!item.isRead ? "border-l-4 border-l-primary" : ""} key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Badge variant={item.type === "Announcement" ? "success" : "warning"}>
                  {item.type}
                </Badge>
                <p className="mt-2 text-base font-semibold text-heading">{item.title}</p>
                <p className="mt-1 text-sm text-text/72">{item.message}</p>
              </div>
              <p className="text-xs text-text/72">{item.time}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
