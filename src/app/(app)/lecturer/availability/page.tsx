"use client";

import "../lecturer-experience.css";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarCheck,
  CalendarDays,
  Clock3,
  Link2,
  MapPin,
  PlusCircle,
  RefreshCw,
  Trash2,
  Video,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createLecturerConsultationSlot,
  deleteLecturerConsultationSlot,
  listLecturerConsultationBookings,
  listLecturerConsultationSlots,
  toConsultationModeLabel,
  type ConsultationBookingApiRecord,
  type ConsultationSlotApiRecord,
} from "@/lib/consultation-client";
import {
  CONSULTATION_SLOT_MODES,
  getConsultationSlotStatusLabel,
  type ConsultationSlotMode,
} from "@/models/consultation-availability";
import {
  getConsultationBookingStatusLabel,
} from "@/models/consultation-booking";

function statusClass(status: ConsultationSlotApiRecord["status"]) {
  if (status === "AVAILABLE") return "badge-available";
  if (status === "BOOKED") return "badge-booked";
  return "badge-full";
}

function bookingStatusClass(status: ConsultationBookingApiRecord["status"]) {
  if (status === "CONFIRMED") return "badge-waitlist";
  if (status === "COMPLETED") return "badge-available";
  if (status === "CANCELLED") return "badge-full";
  return "badge-booked";
}

function sortBySlotTime(
  left: Pick<ConsultationSlotApiRecord, "date" | "startTime">,
  right: Pick<ConsultationSlotApiRecord, "date" | "startTime">
) {
  return `${left.date} ${left.startTime}`.localeCompare(
    `${right.date} ${right.startTime}`
  );
}

const DEFAULT_SESSION_TYPE = "Academic Consultation";

export default function LecturerAvailabilityPage() {
  const { toast } = useToast();
  const todayKey = new Date().toISOString().slice(0, 10);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [slots, setSlots] = useState<ConsultationSlotApiRecord[]>([]);
  const [bookings, setBookings] = useState<ConsultationBookingApiRecord[]>([]);
  const [search, setSearch] = useState("");

  const [date, setDate] = useState(todayKey);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [sessionType, setSessionType] = useState(DEFAULT_SESSION_TYPE);
  const [mode, setMode] = useState<ConsultationSlotMode>("IN_PERSON");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");

  const loadData = useCallback(async () => {
    const [slotsPayload, bookingsPayload] = await Promise.all([
      listLecturerConsultationSlots(),
      listLecturerConsultationBookings(),
    ]);

    setSlots([...slotsPayload.items].sort(sortBySlotTime));
    setBookings(
      [...bookingsPayload.items].sort((left, right) =>
        `${right.slot?.date ?? ""} ${right.slot?.startTime ?? ""}`.localeCompare(
          `${left.slot?.date ?? ""} ${left.slot?.startTime ?? ""}`
        )
      )
    );
    setError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await loadData();
      } catch (requestError) {
        if (!cancelled) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : "Failed to load lecturer availability.";
          setError(message);
          toast({
            title: "Availability unavailable",
            message,
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

  const latestBookingBySlotId = useMemo(() => {
    const map = new Map<string, ConsultationBookingApiRecord>();
    for (const booking of bookings) {
      if (!booking.slotId || map.has(booking.slotId)) {
        continue;
      }
      map.set(booking.slotId, booking);
    }
    return map;
  }, [bookings]);

  const filteredSlots = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return slots.filter((slot) => {
      if (!normalized) {
        return true;
      }

      const linkedBooking = latestBookingBySlotId.get(slot.id);
      const studentName = linkedBooking?.student?.fullName ?? linkedBooking?.studentId ?? "";

      return [
        slot.date,
        slot.startTime,
        slot.endTime,
        slot.sessionType,
        toConsultationModeLabel(slot.mode),
        slot.location,
        slot.meetingLink,
        getConsultationSlotStatusLabel(slot.status),
        studentName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [latestBookingBySlotId, search, slots]);

  const availableCount = slots.filter((slot) => slot.status === "AVAILABLE").length;
  const bookedCount = slots.filter((slot) => slot.status === "BOOKED").length;
  const cancelledCount = slots.filter((slot) => slot.status === "CANCELLED").length;
  const todaySlots = slots.filter((slot) => slot.date === todayKey).length;
  const pendingBookings = bookings.filter((booking) => booking.status === "PENDING").length;
  const confirmedBookings = bookings.filter(
    (booking) => booking.status === "CONFIRMED"
  ).length;
  const recentBookings = bookings.slice(0, 6);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (requestError) {
      toast({
        title: "Refresh failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Failed to refresh lecturer availability.",
        variant: "error",
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadData, toast]);

  const handleCreateSlot = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting) {
        return;
      }

      if (!date || !startTime || !endTime || !sessionType.trim()) {
        toast({
          title: "Missing slot details",
          message: "Date, time range, and session type are required.",
          variant: "error",
        });
        return;
      }

      if ((mode === "IN_PERSON" || mode === "HYBRID") && !location.trim()) {
        toast({
          title: "Location required",
          message: "Add a location for in-person and hybrid consultation slots.",
          variant: "error",
        });
        return;
      }

      if ((mode === "ONLINE" || mode === "HYBRID") && !meetingLink.trim()) {
        toast({
          title: "Meeting link required",
          message: "Add a meeting link for online and hybrid consultation slots.",
          variant: "error",
        });
        return;
      }

      setSubmitting(true);
      try {
        await createLecturerConsultationSlot({
          date,
          startTime,
          endTime,
          sessionType: sessionType.trim(),
          mode,
          location: location.trim(),
          meetingLink: meetingLink.trim(),
        });
        toast({
          title: "Slot created",
          message: `${date} ${startTime} - ${endTime} updated successfully.`,
        });
        if (mode === "ONLINE") {
          setLocation("");
        }
        if (mode === "IN_PERSON") {
          setMeetingLink("");
        }
        await loadData();
      } catch (requestError) {
        toast({
          title: "Slot creation failed",
          message:
            requestError instanceof Error
              ? requestError.message
              : "Could not create the consultation slot.",
          variant: "error",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [date, endTime, loadData, location, meetingLink, mode, sessionType, startTime, submitting, toast]
  );

  const handleDeleteSlot = useCallback(
    async (slot: ConsultationSlotApiRecord) => {
      if (deletingId) {
        return;
      }

      const linkedBooking = latestBookingBySlotId.get(slot.id);
      const hasActiveBooking =
        linkedBooking?.status === "PENDING" || linkedBooking?.status === "CONFIRMED";

      if (slot.status === "BOOKED" || slot.bookingId || hasActiveBooking) {
        toast({
          title: "Slot cannot be removed",
          message: "Booked slots must be cancelled from the bookings page first.",
          variant: "error",
        });
        return;
      }

      setDeletingId(slot.id);
      try {
        await deleteLecturerConsultationSlot(slot.id);
        toast({
          title: "Slot deleted",
          message: `${slot.date} ${slot.startTime} - ${slot.endTime} removed successfully.`,
        });
        await loadData();
      } catch (requestError) {
        toast({
          title: "Delete failed",
          message:
            requestError instanceof Error
              ? requestError.message
              : "Could not delete the consultation slot.",
          variant: "error",
        });
      } finally {
        setDeletingId("");
      }
    },
    [deletingId, latestBookingBySlotId, loadData, toast]
  );

  if (loading) {
    return (
      <div className="lecturer-experience">
        <div className="page">
          <div className="container">
            <div className="glass-strong card-body">Loading availability...</div>
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
                <div className="page-title">Availability</div>
                <div className="page-subtitle">
                  Manage consultation slots with the same workspace style as bookings.
                </div>
              </div>
              <button
                className="btn-outline"
                disabled={refreshing}
                onClick={() => {
                  void refreshData();
                }}
                type="button"
              >
                <RefreshCw className={refreshing ? "animate-spin" : ""} size={16} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="stats-row fadein">
              {[
                ["Today", todaySlots, "var(--accent)"],
                ["Available", availableCount, "var(--green)"],
                ["Booked", bookedCount, "var(--amber)"],
                ["Cancelled", cancelledCount, "var(--purple)"],
              ].map(([label, value, color]) => (
                <div className="glass stat-card" key={String(label)} style={{ color: String(color) }}>
                  <div className="stat-icon" style={{ background: "rgba(52,97,255,0.08)" }} />
                  <div className="stat-value" style={{ color: "var(--ink)" }}>{value}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>

            {error ? (
              <div className="glass-strong fadein" style={{ marginBottom: 20 }}>
                <div className="card-body">
                  <div className="empty-state" style={{ padding: "12px 0", textAlign: "left" }}>
                    <div className="empty-text">{error}</div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="two-col fadein" style={{ marginBottom: 20 }}>
              <div className="glass-strong">
                <div className="card-header">
                  <div>
                    <div className="card-title">
                      <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}>
                        <PlusCircle size={16} />
                      </span>
                      Add Slot
                    </div>
                    <div className="card-subtitle">Create a new consultation time window</div>
                  </div>
                </div>
                <div className="card-body">
                  <form className="slot-form" onSubmit={handleCreateSlot}>
                    <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                      <label className="form-label" htmlFor="slot-date">Date</label>
                      <input
                        className="form-input"
                        id="slot-date"
                        onChange={(event) => setDate(event.target.value)}
                        type="date"
                        value={date}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label" htmlFor="slot-start">Start Time</label>
                      <input
                        className="form-input"
                        id="slot-start"
                        onChange={(event) => setStartTime(event.target.value)}
                        type="time"
                        value={startTime}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label" htmlFor="slot-end">End Time</label>
                      <input
                        className="form-input"
                        id="slot-end"
                        onChange={(event) => setEndTime(event.target.value)}
                        type="time"
                        value={endTime}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label" htmlFor="slot-type">Session Type</label>
                      <input
                        className="form-input"
                        id="slot-type"
                        onChange={(event) => setSessionType(event.target.value)}
                        placeholder="Academic Consultation"
                        type="text"
                        value={sessionType}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label" htmlFor="slot-mode">Mode</label>
                      <select
                        className="form-input"
                        id="slot-mode"
                        onChange={(event) => setMode(event.target.value as ConsultationSlotMode)}
                        value={mode}
                      >
                        {CONSULTATION_SLOT_MODES.map((item) => (
                          <option key={item} value={item}>
                            {toConsultationModeLabel(item)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(mode === "IN_PERSON" || mode === "HYBRID") ? (
                      <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                        <label className="form-label" htmlFor="slot-location">Location</label>
                        <input
                          className="form-input"
                          id="slot-location"
                          onChange={(event) => setLocation(event.target.value)}
                          placeholder="Main Office / Lab 1 / Meeting room"
                          type="text"
                          value={location}
                        />
                      </div>
                    ) : null}

                    {(mode === "ONLINE" || mode === "HYBRID") ? (
                      <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                        <label className="form-label" htmlFor="slot-meeting-link">Meeting Link</label>
                        <input
                          className="form-input"
                          id="slot-meeting-link"
                          inputMode="url"
                          onChange={(event) => setMeetingLink(event.target.value)}
                          placeholder="https://meet.google.com/..."
                          type="text"
                          value={meetingLink}
                        />
                      </div>
                    ) : null}

                    <div className="ai-suggestion">
                      <div className="ai-badge">Live</div>
                      <div className="ai-text">
                        Pending requests: <strong>{pendingBookings}</strong>. Confirmed future sessions:{" "}
                        <strong>{confirmedBookings}</strong>.
                      </div>
                    </div>

                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
                      <button className="btn-primary" disabled={submitting} style={{ flex: 1 }} type="submit">
                        {submitting ? "Saving..." : "Save Slot"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="glass-strong">
                <div className="card-header">
                  <div>
                    <div className="card-title">
                      <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}>
                        <CalendarCheck size={16} />
                      </span>
                      Recent Booking Activity
                    </div>
                    <div className="card-subtitle">Latest requests linked to your slots</div>
                  </div>
                </div>
                <div className="card-body">
                  {recentBookings.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-text">No booking activity found yet.</div>
                    </div>
                  ) : (
                    <div className="slot-list">
                      {recentBookings.map((booking) => (
                        <div className="slot-item" key={booking.id}>
                          <div className="slot-indicator ind-blue" />
                          <div style={{ flex: 1 }}>
                            <div className="slot-date">
                              {booking.student?.fullName ?? booking.student?.studentId ?? booking.studentId}
                            </div>
                            <div className="slot-time">
                              {booking.slot
                                ? `${booking.slot.date} ${booking.slot.startTime} - ${booking.slot.endTime}`
                                : "Slot unavailable"}
                            </div>
                          </div>
                          <div className="slot-meta">
                            <span className={`badge ${bookingStatusClass(booking.status)}`}>
                              {getConsultationBookingStatusLabel(booking.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-strong fadein" style={{ overflow: "hidden" }}>
              <div className="card-header">
                <div>
                  <div className="card-title">My Slots</div>
                  <div className="card-subtitle">Search, review, and remove current availability</div>
                </div>
                <input
                  className="form-input"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search date, type, location, link"
                  style={{ width: 240 }}
                  type="text"
                  value={search}
                />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="booking-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Type</th>
                      <th>Mode</th>
                      <th>Location</th>
                      <th>Meeting Link</th>
                      <th>Status</th>
                      <th>Student</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSlots.map((slot) => {
                      const linkedBooking = latestBookingBySlotId.get(slot.id) ?? null;
                      const hasActiveBooking =
                        linkedBooking?.status === "PENDING" ||
                        linkedBooking?.status === "CONFIRMED";
                      const locked =
                        slot.status === "BOOKED" || Boolean(slot.bookingId) || hasActiveBooking;

                      return (
                        <tr key={slot.id}>
                          <td>
                            <div className="inline-flex" style={{ gap: 10 }}>
                              <span className="avatar" style={{ background: "var(--accent)" }}>
                                <CalendarDays size={14} />
                              </span>
                              <div>
                                <div className="student-name">{slot.date}</div>
                                <div className="student-id">{slot.startTime} - {slot.endTime}</div>
                              </div>
                            </div>
                          </td>
                          <td>{slot.sessionType}</td>
                          <td>
                            <span className="inline-flex" style={{ gap: 6 }}>
                              <Video size={14} />
                              {toConsultationModeLabel(slot.mode)}
                            </span>
                          </td>
                          <td>
                            {slot.location ? (
                              <span className="inline-flex" style={{ gap: 6 }}>
                                <MapPin size={14} />
                                {slot.location}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>
                            {slot.meetingLink ? (
                              <a
                                className="inline-flex"
                                href={slot.meetingLink}
                                rel="noreferrer"
                                style={{ gap: 6 }}
                                target="_blank"
                              >
                                <Link2 size={14} />
                                Open link
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>
                            <span className={`badge ${statusClass(slot.status)}`}>
                              {getConsultationSlotStatusLabel(slot.status)}
                            </span>
                          </td>
                          <td>
                            {linkedBooking ? (
                              <div>
                                <div className="student-name">
                                  {linkedBooking.student?.fullName ??
                                    linkedBooking.student?.studentId ??
                                    linkedBooking.studentId}
                                </div>
                                <div className="student-id">
                                  {getConsultationBookingStatusLabel(linkedBooking.status)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs">No booking</span>
                            )}
                          </td>
                          <td>
                            {locked ? (
                              <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                                Locked
                              </span>
                            ) : (
                              <button
                                className="btn-outline"
                                disabled={deletingId === slot.id}
                                onClick={() => {
                                  void handleDeleteSlot(slot);
                                }}
                                style={{ color: "var(--red)" }}
                                type="button"
                              >
                                <Trash2 size={14} />
                                {deletingId === slot.id ? "Deleting..." : "Delete"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredSlots.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="empty-state">
                            <div className="empty-text">No slots found for this view.</div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="stats-row fadein" style={{ marginTop: 20, marginBottom: 0 }}>
              {[
                ["Confirmed", confirmedBookings, "var(--teal)"],
                ["Pending", pendingBookings, "var(--amber)"],
                ["Future Slots", availableCount + bookedCount, "var(--accent)"],
                ["Need Review", pendingBookings + bookedCount, "var(--purple)"],
              ].map(([label, value, color]) => (
                <div className="glass stat-card" key={String(label)} style={{ color: String(color) }}>
                  <div className="stat-icon" style={{ background: "rgba(52,97,255,0.08)" }}>
                    <Clock3 size={18} />
                  </div>
                  <div className="stat-value" style={{ color: "var(--ink)" }}>{value}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
