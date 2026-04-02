"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import {
  listConsultationNotifications,
  markAllConsultationNotificationsRead,
  toConsultationNotificationLabel,
  type ConsultationNotificationApiRecord,
} from "@/lib/consultation-client";

type Tab = "All" | "Unread";

const tabs: Tab[] = ["All", "Unread"];

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function StudentNotificationsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("All");
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState<
    ConsultationNotificationApiRecord[]
  >([]);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const payload = await listConsultationNotifications();
        if (!cancelled) {
          setNotifications(payload.items);
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Notifications unavailable",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load consultation reminders.",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return notifications.filter((item) => {
      if (tab === "Unread" && !item.unread) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        item.title.toLowerCase().includes(query) ||
        item.message.toLowerCase().includes(query)
      );
    });
  }, [notifications, search, tab]);

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
        <h1 className="text-2xl font-semibold text-heading">Notifications</h1>
        <p className="text-sm text-text/72">
          Consultation reminders and booking alerts.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((entry) => (
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
          <div className="flex gap-2">
            <Input
              className="md:w-72"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notifications"
              value={search}
            />
            <Button
              disabled={isMarkingAll || notifications.every((item) => !item.unread)}
              onClick={async () => {
                setIsMarkingAll(true);
                try {
                  await markAllConsultationNotificationsRead();
                  setNotifications((prev) =>
                    prev.map((item) => ({
                      ...item,
                      unread: false,
                      readAt: item.readAt || new Date().toISOString(),
                    }))
                  );
                  toast({
                    title: "Marked as read",
                    message: "All consultation reminders are now read.",
                  });
                } catch (error) {
                  toast({
                    title: "Update failed",
                    message:
                      error instanceof Error
                        ? error.message
                        : "Failed to update notifications.",
                    variant: "error",
                  });
                } finally {
                  setIsMarkingAll(false);
                }
              }}
              variant="secondary"
            >
              Mark all as read
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-text/70">
              No consultation reminders found.
            </p>
          </Card>
        ) : (
          filtered.map((item) => (
            <Card className={cn(item.unread ? "border-l-4 border-l-primary" : "")} key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">
                      {toConsultationNotificationLabel(item.type)}
                    </Badge>
                    {item.unread ? <Badge variant="danger">Unread</Badge> : null}
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-base text-text",
                      item.unread ? "font-semibold" : "font-medium"
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-text/72">{item.message}</p>
                </div>
                <p className="text-xs text-text/72">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
