"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { notificationsByRole } from "@/lib/mockData";

type Tab = "All" | "Unread" | "Announcements" | "System";

const tabs: Tab[] = ["All", "Unread", "Announcements", "System"];

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function StudentNotificationsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("All");
  const [search, setSearch] = useState("");
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const notifications = useMemo(
    () =>
      notificationsByRole.STUDENT.map((item) => ({
        ...item,
        isRead: readMap[item.id] ?? !item.unread,
      })),
    [readMap]
  );

  const filtered = notifications.filter((item) => {
    if (tab === "Unread" && item.isRead) {
      return false;
    }
    if (tab === "Announcements" && item.type !== "Announcement") {
      return false;
    }
    if (tab === "System" && item.type !== "System") {
      return false;
    }

    const query = search.toLowerCase().trim();
    if (!query) {
      return true;
    }
    return (
      item.title.toLowerCase().includes(query) || item.message.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <Card>
          <Skeleton className="h-10 w-full" />
        </Card>
        <Card>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="mt-2 h-16 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-500">Student alerts and important updates.</p>
      </div>

      <Card>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((entry) => (
              <button
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  tab === entry ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                )}
                key={entry}
                onClick={() => setTab(entry)}
                type="button"
              >
                {entry}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm md:w-72"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notifications"
              value={search}
            />
            <Button
              onClick={() => {
                const next: Record<string, boolean> = {};
                for (const item of notificationsByRole.STUDENT) {
                  next[item.id] = true;
                }
                setReadMap((prev) => ({ ...prev, ...next }));
                toast({
                  title: "Marked as read",
                  message: "All student notifications are now read.",
                });
              }}
              variant="secondary"
            >
              Mark all as read
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {filtered.map((item) => (
          <Card className={cn(!item.isRead ? "border-l-4 border-l-sky-500" : "")} key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.type === "Announcement" ? "success" : "warning"}>
                    {item.type}
                  </Badge>
                  {!item.isRead ? <Badge variant="danger">Unread</Badge> : null}
                </div>
                <p className={cn("mt-2 text-base text-slate-900", !item.isRead ? "font-semibold" : "font-medium")}>
                  {item.title}
                </p>
                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
              </div>
              <p className="text-xs text-slate-500">{item.time}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
