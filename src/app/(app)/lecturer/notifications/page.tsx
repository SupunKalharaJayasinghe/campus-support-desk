"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";
import {
  listConsultationNotifications,
  markAllConsultationNotificationsRead,
  toConsultationNotificationLabel,
  type ConsultationNotificationApiRecord,
} from "@/lib/consultation-client";

export default function LecturerNotificationsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Notifications</h1>
          <p className="text-sm text-text/72">Loading consultation reminders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Notifications</h1>
          <p className="text-sm text-text/72">
            Lecturer consultation reminders and upcoming session alerts.
          </p>
        </div>
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
                title: "Marked all read",
                message: "All lecturer reminders are now read.",
              });
            } catch (error) {
              toast({
                title: "Update failed",
                message:
                  error instanceof Error
                    ? error.message
                    : "Failed to update reminders.",
                variant: "error",
              });
            } finally {
              setIsMarkingAll(false);
            }
          }}
          variant="secondary"
        >
          Mark all read
        </Button>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card>
            <p className="text-sm text-text/70">
              No consultation reminders yet.
            </p>
          </Card>
        ) : (
          notifications.map((item) => (
            <Card className={item.unread ? "border-l-4 border-l-primary" : ""} key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">
                      {toConsultationNotificationLabel(item.type)}
                    </Badge>
                    {item.unread ? <Badge variant="danger">Unread</Badge> : null}
                  </div>
                  <p className="mt-2 text-base font-semibold text-heading">{item.title}</p>
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
