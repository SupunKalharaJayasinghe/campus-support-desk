"use client";

import "./lecturer-experience.css";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  BookOpen,
  CalendarCheck,
  CalendarRange,
  FolderKanban,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  listConsultationNotifications,
  listLecturerConsultationBookings,
  type ConsultationBookingApiRecord,
  type ConsultationNotificationApiRecord,
} from "@/lib/consultation-client";
import { authHeaders } from "@/lib/rbac";
import {
  getConsultationBookingStatusLabel,
  isActiveConsultationBookingStatus,
} from "@/models/consultation-booking";
import {
  listLatestAnnouncements,
  type AnnouncementRecord,
} from "@/models/announcement-center";

interface LecturerAssignedModuleApiRecord {
  id: string;
  moduleCode: string;
  moduleName: string;
  intakeName: string;
  termCode: string;
  status: string;
  updatedAt: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function parseAssignedModules(payload: unknown) {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? root.items : [];

  return rows
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const id = String(row.id ?? row._id ?? "").trim();
      const moduleCode = normalizeModuleCode(row.moduleCode ?? row.moduleId);
      const moduleName = normalizeText(row.moduleName) || moduleCode;
      if (!id || !moduleCode) {
        return null;
      }

      return {
        id,
        moduleCode,
        moduleName,
        intakeName: normalizeText(row.intakeName ?? row.intakeId),
        termCode: String(row.termCode ?? "").trim().toUpperCase(),
        status: String(row.status ?? "ACTIVE").trim().toUpperCase(),
        updatedAt: String(row.updatedAt ?? "").trim(),
      } satisfies LecturerAssignedModuleApiRecord;
    })
    .filter((row): row is LecturerAssignedModuleApiRecord => Boolean(row));
}

function readMessage(payload: unknown) {
  const row = asObject(payload);
  return String(row?.message ?? "").trim();
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

function bookingStatusClass(status: ConsultationBookingApiRecord["status"]) {
  if (status === "CONFIRMED") return "badge-waitlist";
  if (status === "COMPLETED") return "badge-available";
  if (status === "CANCELLED") return "badge-full";
  return "badge-booked";
}

export default function LecturerDashboardPage() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<ConsultationBookingApiRecord[]>([]);
  const [notifications, setNotifications] = useState<ConsultationNotificationApiRecord[]>([]);
  const [assignedModules, setAssignedModules] = useState<LecturerAssignedModuleApiRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [bookingPayload, notificationPayload, announcementRows, modulePayload] = await Promise.all([
          listLecturerConsultationBookings(),
          listConsultationNotifications(),
          listLatestAnnouncements(15).catch(() => [] as AnnouncementRecord[]),
          (async () => {
            const response = await fetch("/api/lecturers/me/offerings", {
              cache: "no-store",
              headers: {
                ...authHeaders(),
              },
            });
            const payload = (await response.json().catch(() => null)) as unknown;
            if (!response.ok) {
              throw new Error(readMessage(payload) || "Failed to load assigned modules.");
            }
            return payload;
          })(),
        ]);

        if (!cancelled) {
          setBookings(bookingPayload.items);
          setNotifications(notificationPayload.items);
          setAnnouncements(announcementRows);
          setAssignedModules(parseAssignedModules(modulePayload));
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Dashboard data unavailable",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load dashboard details.",
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

  const unread = notifications.filter((item) => item.unread).length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const pendingRequests = bookings.filter((item) => item.status === "PENDING").length;
  const upcomingSessions = useMemo(
    () =>
      [...bookings]
        .filter((item) => isActiveConsultationBookingStatus(item.status) && item.slot)
        .sort((left, right) =>
          `${left.slot?.date ?? ""} ${left.slot?.startTime ?? ""}`.localeCompare(
            `${right.slot?.date ?? ""} ${right.slot?.startTime ?? ""}`
          )
        ),
    [bookings]
  );
  const todaysSessions = upcomingSessions.filter((item) => item.slot?.date === todayKey);
  const scheduleItems = todaysSessions.length > 0 ? todaysSessions : upcomingSessions.slice(0, 3);
  const recentActivity = notifications.slice(0, 3);
  const activeModules = assignedModules.filter((item) => item.status === "ACTIVE").length;

  return (
    <div className="lecturer-experience">
      <div className="page">
        <div className="section active">
          <div className="container">
            <div className="page-header fadein">
              <div>
                <div className="page-title">Lecturer Dashboard</div>
                <div className="page-subtitle">
                  Track consultation work, teaching activity, and recent updates from one lecturer workspace.
                </div>
              </div>
              <div className="inline-flex" style={{ flexWrap: "wrap" }}>
                <Link className="btn-outline" href="/lecturer/availability">
                  Manage Availability
                </Link>
                <Link className="btn-primary" href="/lecturer/bookings">
                  Open Bookings
                </Link>
              </div>
            </div>

            <div className="stats-row fadein">
              {[
                {
                  icon: <CalendarRange size={18} />,
                  label: "Pending bookings",
                  value: pendingRequests,
                  color: "var(--amber)",
                },
                {
                  icon: <BellRing size={18} />,
                  label: "Unread notifications",
                  value: unread,
                  color: "var(--accent)",
                },
                {
                  icon: <CalendarCheck size={18} />,
                  label: "Upcoming sessions",
                  value: upcomingSessions.length,
                  color: "var(--purple)",
                },
                {
                  icon: <BookOpen size={18} />,
                  label: "Active modules",
                  value: activeModules,
                  color: "var(--green)",
                },
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

            <div className="two-col fadein" style={{ marginBottom: 20 }}>
              <div className="glass-strong">
                <div className="card-header">
                  <div>
                    <div className="card-title">Today&apos;s Schedule</div>
                    <div className="card-subtitle">
                      {todaysSessions.length > 0
                        ? "Sessions planned for today"
                        : "Next upcoming consultation sessions"}
                    </div>
                  </div>
                  <Link className="btn-outline" href="/lecturer/bookings">
                    View all
                  </Link>
                </div>
                <div className="card-body">
                  {loading ? (
                    <div className="empty-state">
                      <div className="empty-text">Loading schedule...</div>
                    </div>
                  ) : scheduleItems.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-text">No upcoming sessions found.</div>
                    </div>
                  ) : (
                    <div className="slot-list">
                      {scheduleItems.map((session) => (
                        <div className="slot-item" key={session.id}>
                          <div
                            className={`slot-indicator ${
                              session.status === "PENDING"
                                ? "ind-amber"
                                : session.status === "CONFIRMED"
                                  ? "ind-blue"
                                  : "ind-green"
                            }`}
                          />
                          <div style={{ flex: 1 }}>
                            <div className="slot-date">{session.student?.fullName ?? session.studentId}</div>
                            <div className="slot-time">
                              {session.slot?.date} • {session.slot?.startTime} - {session.slot?.endTime}
                            </div>
                            <div className="text-xs">
                              {session.slot?.sessionType ?? session.purpose} • {session.student?.studentId ?? session.studentId}
                            </div>
                          </div>
                          <div className="slot-meta">
                            <span className={`badge ${bookingStatusClass(session.status)}`}>
                              {getConsultationBookingStatusLabel(session.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-strong">
                <div className="card-header">
                  <div>
                    <div className="card-title">Recent Activity</div>
                    <div className="card-subtitle">Latest lecturer reminders and consultation updates</div>
                  </div>
                  <Link className="btn-outline" href="/lecturer/notifications">
                    Notifications
                  </Link>
                </div>
                <div className="card-body">
                  {recentActivity.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-text">No recent activity.</div>
                    </div>
                  ) : (
                    <div className="slot-list">
                      {recentActivity.map((item) => (
                        <div className="slot-item" key={item.id}>
                          <div className={`slot-indicator ${item.unread ? "ind-blue" : "ind-green"}`} />
                          <div style={{ flex: 1 }}>
                            <div className="slot-date">{item.title}</div>
                            <div className="slot-time">{item.message}</div>
                            <div className="text-xs">{new Date(item.createdAt).toLocaleString()}</div>
                          </div>
                          <div className="slot-meta">
                            <span className={`badge ${item.unread ? "badge-booked" : "badge-available"}`}>
                              {item.unread ? "Unread" : "Seen"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="two-col fadein">
              <div className="glass-strong">
                <div className="card-header">
                  <div>
                    <div className="card-title">Assigned Modules</div>
                    <div className="card-subtitle">Module offerings linked to your lecturer profile</div>
                  </div>
                  <Link className="btn-outline" href="/lecturer/my-course">
                    My Course
                  </Link>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="booking-table">
                    <thead>
                      <tr>
                        <th>Module</th>
                        <th>Intake</th>
                        <th>Status</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={4}>
                            <div className="empty-state">
                              <div className="empty-text">Loading assigned modules...</div>
                            </div>
                          </td>
                        </tr>
                      ) : assignedModules.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <div className="empty-state">
                              <div className="empty-text">No modules assigned yet.</div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        assignedModules.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div className="student-name">
                                {item.moduleCode} - {item.moduleName}
                              </div>
                            </td>
                            <td>{item.intakeName || "Unknown Intake"} {item.termCode ? `• ${item.termCode}` : ""}</td>
                            <td>
                              <span className={`badge ${item.status === "ACTIVE" ? "badge-available" : "badge-full"}`}>
                                {item.status}
                              </span>
                            </td>
                            <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass-strong">
                <div className="card-header">
                  <div>
                    <div className="card-title">Latest Announcements</div>
                    <div className="card-subtitle">Recent announcements shared with all users</div>
                  </div>
                  <Link className="btn-outline" href="/announcements">
                    View all
                  </Link>
                </div>
                <div className="card-body">
                  {loading ? (
                    <div className="empty-state">
                      <div className="empty-text">Loading announcements...</div>
                    </div>
                  ) : announcements.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-text">No announcements available yet.</div>
                    </div>
                  ) : (
                    <div className="slot-list">
                      {announcements.map((item) => (
                        <div className="slot-item" key={item.id}>
                          <div className="slot-indicator ind-blue" />
                          <div style={{ flex: 1 }}>
                            <div className="slot-date">{item.title}</div>
                            <div className="slot-time">{item.message}</div>
                            <div className="text-xs">
                              {item.targetLabel} • {formatDateTime(item.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="glass fadein" style={{ marginTop: 20, padding: "18px 22px" }}>
              <div
                className="inline-flex"
                style={{
                  color: "var(--ink-2)",
                  justifyContent: "space-between",
                  width: "100%",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  <FolderKanban size={16} />
                  Teaching overview updates automatically from your existing lecturer data sources.
                </span>
                <span className="text-xs">
                  {announcements.length} recent announcements • {notifications.length} total reminders
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
