"use client";

import "../lecturer-experience.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, CalendarDays, PlusCircle } from "lucide-react";
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
import type { ConsultationSlotMode } from "@/models/consultation-availability";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dateKey(date: Date, day: number) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function LecturerAvailabilityPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"schedule" | "analytics">("schedule");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [slots, setSlots] = useState<ConsultationSlotApiRecord[]>([]);
  const [bookings, setBookings] = useState<ConsultationBookingApiRecord[]>([]);
  const [busyKey, setBusyKey] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [sessionType, setSessionType] = useState("Academic Consultation");
  const [mode, setMode] = useState<ConsultationSlotMode>("IN_PERSON");
  const [location, setLocation] = useState("Main Office");

  const loadData = useCallback(async () => {
    const [slotPayload, bookingPayload] = await Promise.all([
      listLecturerConsultationSlots(),
      listLecturerConsultationBookings(),
    ]);
    setSlots(slotPayload.items);
    setBookings(bookingPayload.items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await loadData();
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Availability data unavailable",
            message: error instanceof Error ? error.message : "Failed to load lecturer data.",
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

  const selectedDate = dateKey(currentDate, selectedDay);
  const visibleSlots = slots.filter((slot) => slot.date === selectedDate);
  const availableCount = slots.filter((slot) => slot.status === "AVAILABLE").length;
  const bookedCount = slots.filter((slot) => slot.status === "BOOKED").length;
  const pendingCount = bookings.filter((booking) => booking.status === "PENDING").length;
  const completedCount = bookings.filter((booking) => booking.status === "COMPLETED").length;

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const slotDates = new Set(
      slots
        .filter((slot) => {
          const slotDate = new Date(`${slot.date}T00:00:00`);
          return slotDate.getFullYear() === year && slotDate.getMonth() === month;
        })
        .map((slot) => slot.date)
    );

    return Array.from({ length: firstDay + daysInMonth }, (_, index) => {
      const day = index - firstDay + 1;
      if (day < 1) {
        return { key: `empty-${index}`, empty: true };
      }
      const key = dateKey(currentDate, day);
      return { key, day, hasSlot: slotDates.has(key), selected: day === selectedDay };
    });
  }, [currentDate, selectedDay, slots]);

  const weeklyStats = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => {
    const value = bookings.filter((booking) => {
      const slotDate = booking.slot?.date;
      return slotDate ? new Date(`${slotDate}T00:00:00`).getDay() === day : false;
    }).length;
    return { label, value };
  });

  const addSlot = useCallback(async () => {
    setBusyKey("create");
    try {
      const created = await createLecturerConsultationSlot({
        date,
        startTime,
        endTime,
        sessionType,
        mode,
        location,
      });
      setSlots((prev) =>
        [...prev, created].sort((left, right) =>
          `${left.date} ${left.startTime}`.localeCompare(`${right.date} ${right.startTime}`)
        )
      );
      toast({ title: "Slot added", message: `${created.date} ${created.startTime} - ${created.endTime}` });
    } catch (error) {
      toast({
        title: "Slot not saved",
        message: error instanceof Error ? error.message : "Failed to save consultation slot.",
        variant: "error",
      });
    } finally {
      setBusyKey("");
    }
  }, [date, endTime, location, mode, sessionType, startTime, toast]);

  const removeSlot = useCallback(
    async (slotId: string) => {
      setBusyKey(slotId);
      try {
        await deleteLecturerConsultationSlot(slotId);
        setSlots((prev) => prev.filter((slot) => slot.id !== slotId));
        toast({ title: "Slot removed", message: "The time slot was deleted." });
      } catch (error) {
        toast({
          title: "Slot not removed",
          message: error instanceof Error ? error.message : "Failed to delete slot.",
          variant: "error",
        });
      } finally {
        setBusyKey("");
      }
    },
    [toast]
  );

  if (loading) {
    return <div className="lecturer-experience"><div className="page"><div className="container"><div className="glass-strong card-body">Loading availability...</div></div></div></div>;
  }

  return (
    <div className="lecturer-experience">
      <div className="page">
        <div className="section active">
          <div className="container">
            <div className="page-header fadein">
              <div>
                <div className="page-title">Smart Availability</div>
                <div className="page-subtitle">Live consultation slots and booking demand</div>
              </div>
              <div className="tab-bar">
                <button className={`tab-btn ${tab === "schedule" ? "active" : ""}`} onClick={() => setTab("schedule")} type="button"><CalendarDays size={16} />Schedule</button>
                <button className={`tab-btn ${tab === "analytics" ? "active" : ""}`} onClick={() => setTab("analytics")} type="button"><BarChart3 size={16} />Analytics</button>
              </div>
            </div>

            <div className="stats-row">
              {[
                ["Available Slots", availableCount, "var(--green)"],
                ["Booked Sessions", bookedCount, "var(--amber)"],
                ["Pending Requests", pendingCount, "var(--purple)"],
                ["Completed", completedCount, "var(--teal)"],
              ].map(([label, value, color]) => (
                <div className="glass stat-card" key={String(label)} style={{ color: String(color) }}>
                  <div className="stat-value" style={{ color: "var(--ink)" }}>{value}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>

            {tab === "schedule" ? (
              <div className="main-side fadein">
                <div className="glass-strong">
                  <div className="card-header">
                    <div>
                      <div className="card-title"><CalendarDays size={16} style={{ display: "inline-flex", marginRight: 6 }} />Availability Calendar</div>
                      <div className="card-subtitle">Dates with slots are highlighted from real backend data</div>
                    </div>
                  </div>
                  <div className="calendar-wrap">
                    <div className="cal-header">
                      <div className="cal-month">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</div>
                      <div className="cal-nav">
                        <button className="cal-btn" onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} type="button">&lt;</button>
                        <button className="cal-btn" onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} type="button">&gt;</button>
                      </div>
                    </div>
                    <div className="cal-days-header">{"Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(",").map((name) => <div className="cal-day-name" key={name}>{name}</div>)}</div>
                    <div className="cal-grid">
                      {calendarDays.map((day) =>
                        "empty" in day ? <div className="cal-day empty" key={day.key} /> : (
                          <div className={`cal-day ${day.selected ? "selected" : ""} ${day.hasSlot ? "has-slot" : ""}`} key={day.key} onClick={() => setSelectedDay(day.day)} role="button" tabIndex={0}>
                            {day.day}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="glass-strong">
                    <div className="card-header">
                      <div>
                        <div className="card-title"><PlusCircle size={16} style={{ display: "inline-flex", marginRight: 6 }} />Add Time Slot</div>
                        <div className="card-subtitle">Overlap and booked-slot rules are enforced on the API</div>
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="slot-form">
                        <input className="form-input" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
                        <input className="form-input" onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
                        <input className="form-input" onChange={(event) => setEndTime(event.target.value)} type="time" value={endTime} />
                        <select className="form-input" onChange={(event) => setSessionType(event.target.value)} value={sessionType}>
                          <option>Academic Consultation</option>
                          <option>Thesis Review</option>
                          <option>Project Feedback</option>
                          <option>Career Guidance</option>
                        </select>
                        <select className="form-input" onChange={(event) => setMode(event.target.value as ConsultationSlotMode)} value={mode}>
                          <option value="IN_PERSON">In-Person</option>
                          <option value="ONLINE">Online</option>
                          <option value="HYBRID">Hybrid</option>
                        </select>
                        <input className="form-input" onChange={(event) => setLocation(event.target.value)} placeholder="Location" type="text" value={location} />
                        <button className="btn-primary" disabled={busyKey === "create"} onClick={() => void addSlot()} type="button">{busyKey === "create" ? "Saving..." : "Add Slot"}</button>
                      </div>
                    </div>
                  </div>

                  <div className="glass-strong">
                    <div className="card-header">
                      <div>
                        <div className="card-title"><CalendarClock size={16} style={{ display: "inline-flex", marginRight: 6 }} />Slots On {selectedDate}</div>
                        <div className="card-subtitle">{visibleSlots.length > 0 ? `${visibleSlots.length} slots selected` : `${slots.length} total slots available`}</div>
                      </div>
                    </div>
                    <div className="card-body overflow-y" style={{ paddingTop: 14 }}>
                      <div className="slot-list">
                        {(visibleSlots.length > 0 ? visibleSlots : slots).map((slot) => (
                          <div className="slot-item" key={slot.id}>
                            <div className={`slot-indicator ${slot.status === "BOOKED" ? "ind-amber" : "ind-green"}`} />
                            <div style={{ flex: 1 }}>
                              <div className="slot-date">{slot.date}</div>
                              <div className="slot-time">{slot.startTime} - {slot.endTime} - {slot.sessionType} - {toConsultationModeLabel(slot.mode)}{slot.location ? ` - ${slot.location}` : ""}</div>
                            </div>
                            <div className="slot-meta">
                              <span className={`badge ${slot.status === "BOOKED" ? "badge-booked" : "badge-available"}`}>{slot.status === "BOOKED" ? "Booked" : "Available"}</span>
                              <button className="btn-remove" disabled={busyKey === slot.id} onClick={() => void removeSlot(slot.id)} type="button">x</button>
                            </div>
                          </div>
                        ))}
                        {slots.length === 0 ? <div className="slot-item"><div style={{ flex: 1 }}><div className="slot-date">No slots yet</div><div className="slot-time">Create your first consultation window above.</div></div></div> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="three-col fadein">
                <div className="glass card-body">
                  <div className="card-title" style={{ marginBottom: 16 }}>Weekly Bookings</div>
                  <div className="chart-bar-container">
                    {weeklyStats.map((item) => (
                      <div className="bar-row" key={item.label}>
                        <div className="bar-label">{item.label}</div>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(12, item.value * 18)}%` }} /></div>
                        <div className="bar-val">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass card-body">
                  <div className="card-title" style={{ marginBottom: 16 }}>Session Types</div>
                  <div className="donut-legend">
                    {Array.from(new Set(bookings.map((booking) => booking.slot?.sessionType || booking.purpose))).slice(0, 4).map((label) => (
                      <div className="legend-item" key={label}>
                        <div className="legend-dot" style={{ background: "var(--accent)" }} />
                        <div className="legend-key">{label}</div>
                        <div className="legend-pct">{bookings.filter((booking) => (booking.slot?.sessionType || booking.purpose) === label).length}</div>
                      </div>
                    ))}
                    {bookings.length === 0 ? <div className="legend-item"><div className="legend-key">No booking history yet.</div></div> : null}
                  </div>
                </div>
                <div className="glass card-body">
                  <div className="card-title" style={{ marginBottom: 16 }}>Rule Coverage</div>
                  <div className="ai-suggestion"><div className="ai-badge">Live</div><div className="ai-text">Overlapping slots are rejected. Booked slots cannot be edited or deleted. Student double-booking windows are blocked.</div></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
