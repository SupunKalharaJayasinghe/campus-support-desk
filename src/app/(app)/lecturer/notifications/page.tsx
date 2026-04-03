"use client";

import "../lecturer-experience.css";

import { useEffect, useState } from "react";
import { BellRing, CheckCheck, MailOpen, ShieldCheck } from "lucide-react";
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

  const unreadCount = notifications.filter((item) => item.unread).length;
  const readCount = notifications.length - unreadCount;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = notifications.filter((item) => item.createdAt.slice(0, 10) === todayKey).length;

  if (loading) {
    return (
      <div className="lecturer-experience">
        <div className="page">
          <div className="container">
            <div className="glass-strong card-body">Loading consultation reminders...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lecturer-experience">
      <div className="page">
        <div className="section active">
          <div className="container">
            <div className="page-header fadein">
              <div>
                <div className="page-title">Notifications</div>
                <div className="page-subtitle">
                  Lecturer consultation reminders and upcoming session alerts in the bookings workspace style.
                </div>
              </div>
              <button
                className="btn-outline"
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
                type="button"
              >
                {isMarkingAll ? "Updating..." : "Mark all read"}
              </button>
            </div>

            <div className="stats-row fadein">
              {[
                { icon: <BellRing size={18} />, label: "Total reminders", value: notifications.length, color: "var(--accent)" },
                { icon: <MailOpen size={18} />, label: "Unread", value: unreadCount, color: "var(--amber)" },
                { icon: <CheckCheck size={18} />, label: "Read", value: readCount, color: "var(--green)" },
                { icon: <ShieldCheck size={18} />, label: "Today", value: todayCount, color: "var(--purple)" },
              ].map((item) => (
                <div className="glass stat-card" key={item.label} style={{ color: item.color }}>
                  <div className="stat-icon" style={{ background: "rgba(52,97,255,0.08)" }}>
                    {item.icon}
                  </div>
                  <div className="stat-value" style={{ color: "var(--ink)" }}>
                    {item.value}
                  </div>
                  <div className="stat-label">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="glass-strong fadein">
              <div className="card-header">
                <div>
                  <div className="card-title">Notification Feed</div>
                  <div className="card-subtitle">Ordered by latest consultation activity</div>
                </div>
              </div>
              <div className="card-body">
                {notifications.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-text">No consultation reminders yet.</div>
                  </div>
                ) : (
                  <div className="slot-list">
                    {notifications.map((item) => (
                      <div className="slot-item" key={item.id}>
                        <div className={`slot-indicator ${item.unread ? "ind-amber" : "ind-green"}`} />
                        <div style={{ flex: 1 }}>
                          <div className="inline-flex" style={{ flexWrap: "wrap" }}>
                            <span className="badge badge-waitlist">
                              {toConsultationNotificationLabel(item.type)}
                            </span>
                            <span className={`badge ${item.unread ? "badge-booked" : "badge-available"}`}>
                              {item.unread ? "Unread" : "Read"}
                            </span>
                          </div>
                          <div className="slot-date" style={{ marginTop: 8 }}>
                            {item.title}
                          </div>
                          <div className="slot-time">{item.message}</div>
                          <div className="text-xs">
                            Created {new Date(item.createdAt).toLocaleString()}
                            {item.readAt ? ` • Read ${new Date(item.readAt).toLocaleString()}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
