"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { notificationsByRole } from "@/lib/mockData";

export default function LostItemsNotificationsPage() {
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  const notifications = notificationsByRole.LOST_ITEM_STAFF.map((item) => ({
    ...item,
    isRead: readMap[item.id] ?? !item.unread,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Notifications</h1>
          <p className="text-sm text-mutedText">Lost-item operations updates and alerts.</p>
        </div>
        <Button
          onClick={() => {
            const next: Record<string, boolean> = {};
            for (const item of notificationsByRole.LOST_ITEM_STAFF) {
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
          <Card key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.type === "Announcement" ? "success" : "warning"}>
                    {item.type}
                  </Badge>
                  {!item.isRead ? <Badge variant="danger">Unread</Badge> : null}
                </div>
                <p className="mt-2 text-base font-semibold text-text">{item.title}</p>
                <p className="mt-1 text-sm text-mutedText">{item.message}</p>
              </div>
              <p className="text-xs text-mutedText">{item.time}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
