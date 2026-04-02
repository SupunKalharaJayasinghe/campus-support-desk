"use client";

import "../lecturer-experience.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, History, Hourglass } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  listLecturerConsultationBookings,
  toConsultationModeLabel,
  updateConsultationBooking,
  type ConsultationBookingApiRecord,
} from "@/lib/consultation-client";
import { getConsultationBookingStatusLabel } from "@/models/consultation-booking";

function statusClass(status: ConsultationBookingApiRecord["status"]) {
  if (status === "CONFIRMED") return "badge-waitlist";
  if (status === "COMPLETED") return "badge-available";
  if (status === "CANCELLED") return "badge-full";
  return "badge-booked";
}

export default function LecturerBookingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "history" | "waitlist">("upcoming");
  const [busyKey, setBusyKey] = useState("");
  const [bookings, setBookings] = useState<ConsultationBookingApiRecord[]>([]);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    const payload = await listLecturerConsultationBookings();
    setBookings(payload.items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await loadData();
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Booking data unavailable",
            message: error instanceof Error ? error.message : "Failed to load lecturer bookings.",
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
  }, [loadData, toast]);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const studentName = booking.student?.fullName ?? booking.studentId;
      if (!normalized) return true;
      return studentName.toLowerCase().includes(normalized);
    });
  }, [bookings, search]);

  const upcoming = filtered.filter((booking) => booking.status === "PENDING" || booking.status === "CONFIRMED");
  const history = filtered.filter((booking) => booking.status === "COMPLETED" || booking.status === "CANCELLED");
  const pendingCount = bookings.filter((booking) => booking.status === "PENDING").length;
  const confirmedCount = bookings.filter((booking) => booking.status === "CONFIRMED").length;
  const completedCount = bookings.filter((booking) => booking.status === "COMPLETED").length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcomingToday = bookings.filter((booking) => booking.slot?.date === todayKey && booking.status !== "CANCELLED" && booking.status !== "COMPLETED").length;

  const runAction = useCallback(
    async (
      booking: ConsultationBookingApiRecord,
      action: "confirm" | "complete" | "cancel"
    ) => {
      setBusyKey(`${action}:${booking.id}`);
      try {
        const updated = await updateConsultationBooking(booking.id, { action });
        setBookings((prev) => prev.map((item) => (item.id === booking.id ? updated : item)));
        toast({
          title: `Booking ${action}ed`,
          message: `${booking.student?.fullName ?? booking.studentId} updated successfully.`,
        });
      } catch (error) {
        toast({
          title: "Booking update failed",
          message: error instanceof Error ? error.message : "Failed to update booking.",
          variant: "error",
        });
      } finally {
        setBusyKey("");
      }
    },
    [toast]
  );

  if (loading) {
    return <div className="lecturer-experience"><div className="page"><div className="container"><div className="glass-strong card-body">Loading bookings...</div></div></div></div>;
  }

  return (
    <div className="lecturer-experience">
      <div className="page">
        <div className="section active">
          <div className="container">
            <div className="page-header fadein">
              <div>
                <div className="page-title">Bookings</div>
                <div className="page-subtitle">Live student consultation requests and status actions</div>
              </div>
              <div className="tab-bar">
                <button className={`tab-btn ${tab === "upcoming" ? "active" : ""}`} onClick={() => setTab("upcoming")} type="button"><CalendarCheck size={16} />Upcoming</button>
                <button className={`tab-btn ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")} type="button"><History size={16} />History</button>
                <button className={`tab-btn ${tab === "waitlist" ? "active" : ""}`} onClick={() => setTab("waitlist")} type="button"><Hourglass size={16} />Waitlist</button>
              </div>
            </div>

            <div className="stats-row fadein">
              {[
                ["Upcoming Today", upcomingToday, "var(--accent)"],
                ["Pending", pendingCount, "var(--amber)"],
                ["Confirmed", confirmedCount, "var(--purple)"],
                ["Completed", completedCount, "var(--green)"],
              ].map(([label, value, color]) => (
                <div className="glass stat-card" key={String(label)} style={{ color: String(color) }}>
                  <div className="stat-icon" style={{ background: "rgba(52,97,255,0.08)" }} />
                  <div className="stat-value" style={{ color: "var(--ink)" }}>{value}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>

            {tab !== "waitlist" ? (
              <div className="glass-strong fadein" style={{ overflow: "hidden" }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{tab === "upcoming" ? "Upcoming Sessions" : "Session History"}</div>
                    <div className="card-subtitle">{tab === "upcoming" ? "Confirm, complete, or cancel live bookings" : "Completed and cancelled consultations"}</div>
                  </div>
                  <input className="form-input" onChange={(event) => setSearch(event.target.value)} placeholder="Search student" style={{ width: 220 }} type="text" value={search} />
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="booking-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th>Mode</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tab === "upcoming" ? upcoming : history).map((booking) => (
                        <tr key={booking.id}>
                          <td>
                            <div className="student-info">
                              <div className="avatar" style={{ background: "var(--accent)" }}>
                                {(booking.student?.fullName ?? booking.studentId).split(" ").map((part) => part[0]).join("").slice(0, 2)}
                              </div>
                              <div>
                                <div className="student-name">{booking.student?.fullName ?? booking.studentId}</div>
                                <div className="student-id">{booking.student?.studentId ?? booking.studentId}</div>
                              </div>
                            </div>
                          </td>
                          <td>{booking.slot ? `${booking.slot.date} ${booking.slot.startTime} - ${booking.slot.endTime}` : "Unavailable"}</td>
                          <td>{booking.slot?.sessionType ?? booking.purpose}</td>
                          <td>{booking.slot ? toConsultationModeLabel(booking.slot.mode) : "-"}</td>
                          <td><span className={`badge ${statusClass(booking.status)}`}>{getConsultationBookingStatusLabel(booking.status)}</span></td>
                          <td>
                            {tab === "history" ? (
                              <span className="text-xs" style={{ color: "var(--ink-3)" }}>No actions</span>
                            ) : (
                              <div style={{ display: "flex", gap: 6 }}>
                                {booking.status === "PENDING" ? (
                                  <button className="btn-outline" disabled={busyKey === `confirm:${booking.id}`} onClick={() => void runAction(booking, "confirm")} type="button">Confirm</button>
                                ) : null}
                                {booking.status === "CONFIRMED" ? (
                                  <button className="btn-outline" disabled={busyKey === `complete:${booking.id}`} onClick={() => void runAction(booking, "complete")} type="button">Complete</button>
                                ) : null}
                                {booking.status !== "CANCELLED" && booking.status !== "COMPLETED" ? (
                                  <button className="btn-outline" disabled={busyKey === `cancel:${booking.id}`} onClick={() => void runAction(booking, "cancel")} style={{ color: "var(--red)" }} type="button">Cancel</button>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(tab === "upcoming" ? upcoming : history).length === 0 ? (
                        <tr>
                          <td colSpan={6}>
                            <div className="empty-state"><div className="empty-text">No bookings found for this view.</div></div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="glass-strong fadein">
                <div className="card-header">
                  <div>
                    <div className="card-title">Waitlist</div>
                    <div className="card-subtitle">No waitlist backend exists yet for this module</div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="ai-suggestion">
                    <div className="ai-badge">Later</div>
                    <div className="ai-text">Reminder settings and queue automation can be added after the core slot and booking flow is complete.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
