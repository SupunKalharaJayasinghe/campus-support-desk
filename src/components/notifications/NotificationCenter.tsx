"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import {
  resolveNotificationsForUser,
  type NotificationFeedItem,
} from "@/models/notification-center";
import { readStoredUser } from "@/models/rbac";
import type { AppRole } from "@/models/rbac";

type NotificationTab = "All" | "Unread" | "Announcements" | "System";

const TABS: NotificationTab[] = ["All", "Unread", "Announcements", "System"];

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

interface NotificationCenterProps {
  role: AppRole;
  title: string;
  subtitle: string;
}

export default function NotificationCenter({
  role,
  title,
  subtitle,
}: NotificationCenterProps) {
  const user = useMemo(() => readStoredUser(), []);
  const baseItems = useMemo(
    () => resolveNotificationsForUser(user, role),
    [role, user]
  );
  const [tab, setTab] = useState<NotificationTab>("All");
  const [search, setSearch] = useState("");
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  const notifications = useMemo(
    () =>
      baseItems.map((item) => ({
        ...item,
        isRead: readMap[item.id] ?? !item.unread,
      })),
    [baseItems, readMap]
  );

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return notifications.filter((item) => {
      if (tab === "Unread" && item.isRead) {
        return false;
      }
      if (tab === "Announcements" && item.type !== "Announcement") {
        return false;
      }
      if (tab === "System" && item.type !== "System") {
        return false;
      }
      if (!query) {
        return true;
      }
      const lookup = `${item.title} ${item.message} ${item.targetLabel}`.toLowerCase();
      return lookup.includes(query);
    });
  }, [notifications, search, tab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-heading">{title}</h1>
          <p className="text-sm text-text/72">{subtitle}</p>
        </div>
        <Button
          onClick={() => {
            const next: Record<string, boolean> = {};
            for (const item of baseItems) {
              next[item.id] = true;
            }
            setReadMap((previous) => ({ ...previous, ...next }));
          }}
          variant="secondary"
        >
          Mark all read
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((entry) => (
              <button
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  tab === entry ? "bg-primary text-white" : "bg-tint text-text/72"
                )}
                key={entry}
                onClick={() => setTab(entry)}
                type="button"
              >
                {entry}
              </button>
            ))}
          </div>
          <Input
            className="md:w-72"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notifications"
            value={search}
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-text/72">
            No notifications found for selected filters.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <NotificationRow item={item} key={item.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  item,
}: {
  item: NotificationFeedItem & { isRead: boolean };
}) {
  return (
    <Card className={cn(!item.isRead ? "border-l-4 border-l-primary" : "")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={item.type === "Announcement" ? "success" : "warning"}>
              {item.type}
            </Badge>
            {!item.isRead ? <Badge variant="danger">Unread</Badge> : null}
          </div>
          <p
            className={cn(
              "mt-2 text-base text-heading",
              !item.isRead ? "font-semibold" : "font-medium"
            )}
          >
            {item.title}
          </p>
          <p className="mt-1 text-sm text-text/72">{item.message}</p>
          <p className="mt-2 text-xs text-text/60">{item.targetLabel}</p>
        </div>
        <p className="text-xs text-text/72">{item.time}</p>
      </div>
    </Card>
  );
}
