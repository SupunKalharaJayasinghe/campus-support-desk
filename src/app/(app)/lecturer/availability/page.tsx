"use client";

import "../lecturer-experience.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CircleDot,
  ClipboardList,
  Download,
  GraduationCap,
  Hourglass,
  Mail,
  PieChart,
  PlusCircle,
  Search,
  Star,
  Target,
  Workflow,
} from "lucide-react";
import { lecturerBookingRequests } from "@/models/mockData";

function buildAvailabilityInsight(requests: typeof lecturerBookingRequests) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const timeBuckets = [
    { key: "morning", label: "9-11 AM", start: 9, end: 11 },
    { key: "midday", label: "11 AM-2 PM", start: 11, end: 14 },
    { key: "afternoon", label: "2-5 PM", start: 14, end: 17 },
    { key: "evening", label: "5-7 PM", start: 17, end: 19 },
  ];

  const counts = new Map<string, number>();
  requests.forEach((request) => {
    if (request.status === "CANCELLED") return;
    const dateValue = new Date(`${request.date}T00:00:00`);
    const dayLabel = dayNames[dateValue.getDay()];
    const hour = Number(request.start.split(":")[0] ?? 0);
    const bucket = timeBuckets.find((item) => hour >= item.start && hour < item.end);
    if (!bucket) return;
    const key = `${dayLabel}|${bucket.key}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  let bestKey: string | null = null;
  let bestCount = 0;
  for (const [key, value] of counts.entries()) {
    if (value > bestCount) {
      bestCount = value;
      bestKey = key;
    }
  }

  const pendingCount = requests.filter((item) => item.status === "PENDING").length;

  if (!bestKey) {
    return {
      highlight: "next Tuesday 10 AM",
      detail: `Not enough booking history yet. Pending requests: ${pendingCount}.`,
    };
  }

  const [dayLabel, bucketKey] = bestKey.split("|");
  const bucket = timeBuckets.find((item) => item.key === bucketKey);
  const label = bucket?.label ?? "peak hours";

  return {
    highlight: `${dayLabel} ${label}`,
    detail: `Most requests land in this window. Pending requests: ${pendingCount}.`,
  };
}

type SlotStatus = "available" | "booked" | "full";

type SlotItem = {
  id: number;
  date: string;
  start: string;
  end: string;
  type: string;
  mode: string;
  status: SlotStatus;
  student?: string;
  location?: string;
};

type ToastItem = {
  id: number;
  icon: string;
  text: string;
};

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

const initialSlots: SlotItem[] = [
  {
    id: 1,
    date: "2026-02-27",
    start: "09:00",
    end: "10:00",
    type: "Thesis Review",
    mode: "In-Person",
    status: "booked",
    student: "Alice Chen",
  },
  {
    id: 2,
    date: "2026-02-28",
    start: "13:00",
    end: "14:00",
    type: "Academic",
    mode: "Online",
    status: "available",
  },
  {
    id: 3,
    date: "2026-03-02",
    start: "11:30",
    end: "12:30",
    type: "Project Feedback",
    mode: "Hybrid",
    status: "available",
  },
  {
    id: 4,
    date: "2026-03-21",
    start: "10:30",
    end: "11:00",
    type: "Academic",
    mode: "In-Person",
    status: "booked",
    student: "Ravi Perera",
  },
  {
    id: 5,
    date: "2026-03-27",
    start: "14:00",
    end: "15:00",
    type: "Thesis Review",
    mode: "Online",
    status: "available",
  },
];

const slotDates: Record<string, boolean> = {
  "2026-2-21": true,
  "2026-2-25": true,
  "2026-2-27": true,
  "2026-2-28": true,
};
const bookedDates: Record<string, boolean> = {
  "2026-2-18": true,
  "2026-2-20": true,
  "2026-2-24": true,
};
const fullDates: Record<string, boolean> = {
  "2026-2-23": true,
};

function useLocalToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((icon: string, text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, icon, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  return { toasts, showToast };
}

function formatTimer(seconds: number) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
}

export default function LecturerAvailabilityPage() {
  const { toasts, showToast } = useLocalToasts();
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 2, 1));
  const [selectedDay, setSelectedDay] = useState(21);
  const [slots, setSlots] = useState<SlotItem[]>(initialSlots);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [date, setDate] = useState("2026-03-26");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [mode, setMode] = useState("In-Person");
  const [location, setLocation] = useState("Main Office");
  const [mainTab, setMainTab] = useState<"schedule" | "analytics">("schedule");
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = setInterval(() => {
      setTimerSecs((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const days: {
      key: string;
      day?: number;
      empty?: boolean;
      today?: boolean;
      selected?: boolean;
      hasSlot?: boolean;
      booked?: boolean;
      full?: boolean;
    }[] = [];

    for (let i = 0; i < firstDay; i += 1) {
      days.push({ key: `empty-${i}`, empty: true });
    }

    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = `${year}-${month}-${d}`;
      days.push({
        key,
        day: d,
        today: d === today.getDate() && month === today.getMonth() && year === today.getFullYear(),
        selected: d === selectedDay,
        hasSlot: Boolean(slotDates[key]),
        booked: Boolean(bookedDates[key]),
        full: Boolean(fullDates[key]),
      });
    }

    return days;
  }, [currentDate, selectedDay]);

  const aiInsight = buildAvailabilityInsight(lecturerBookingRequests);

  const handleAddSlot = () => {
    if (!date || !start || !end) {
      showToast("!", "Please fill all fields");
      return;
    }
    const newSlot: SlotItem = {
      id: Date.now(),
      date,
      start,
      end,
      type: "Academic Consultation",
      mode,
      status: "available",
      location: mode === "In-Person" ? location : undefined,
    };
    setSlots((prev) => [newSlot, ...prev]);
    showToast("+", `Slot added: ${date} ${start}-${end}`);
  };

  const removeSlot = (id: number) => {
    setSlots((prev) => prev.filter((slot) => slot.id !== id));
    setSelectedSlotId((prev) => (prev === id ? null : prev));
    showToast("x", "Slot removed");
  };

  return (
    <div className="lecturer-experience">
      <div className="page">
        <div className="section active" id="sec-availability">
          <div className="container">
            <div className="page-header fadein">
              <div>
                <div className="page-title">Smart Availability</div>
                <div className="page-subtitle">
                  Create and manage consultation windows with AI-powered optimization
                </div>
              </div>
              <div className="inline-flex">
                <div className="tab-bar">
                  <button
                    className={`tab-btn ${mainTab === "schedule" ? "active" : ""}`}
                    onClick={() => setMainTab("schedule")}
                    type="button"
                  >
                    <CalendarDays size={16} />
                    Schedule
                  </button>
                  <button
                    className={`tab-btn ${mainTab === "analytics" ? "active" : ""}`}
                    onClick={() => setMainTab("analytics")}
                    type="button"
                  >
                    <BarChart3 size={16} />
                    Analytics
                  </button>
                </div>
              </div>
            </div>

            <div className="stats-row">
              <div className="glass stat-card fadein fadein-1" style={{ color: "var(--green)" }}>
                <div className="stat-icon" style={{ background: "var(--green-glow)" }}>
                  <CircleDot size={18} />
                </div>
                <div className="stat-value" style={{ color: "var(--ink)" }}>14</div>
                <div className="stat-label">Available Slots</div>
                <div className="stat-delta delta-up">+3 this week</div>
              </div>
              <div className="glass stat-card fadein fadein-2" style={{ color: "var(--amber)" }}>
                <div className="stat-icon" style={{ background: "var(--amber-glow)" }}>
                  <ClipboardList size={18} />
                </div>
                <div className="stat-value" style={{ color: "var(--ink)" }}>8</div>
                <div className="stat-label">Booked Sessions</div>
                <div className="stat-delta delta-up">57% utilization</div>
              </div>
              <div className="glass stat-card fadein fadein-3" style={{ color: "var(--purple)" }}>
                <div className="stat-icon" style={{ background: "var(--purple-glow)" }}>
                  <Hourglass size={18} />
                </div>
                <div className="stat-value" style={{ color: "var(--ink)" }}>5</div>
                <div className="stat-label">Waitlisted</div>
                <div className="stat-delta delta-down">+2 new requests</div>
              </div>
              <div className="glass stat-card fadein fadein-4" style={{ color: "var(--teal)" }}>
                <div className="stat-icon" style={{ background: "var(--teal-glow)" }}>
                  <Star size={18} />
                </div>
                <div className="stat-value" style={{ color: "var(--ink)" }}>4.9</div>
                <div className="stat-label">Avg. Rating</div>
                <div className="stat-delta delta-up">Top 5% faculty</div>
              </div>
            </div>

            {mainTab === "schedule" ? (
              <div className="main-side fadein">
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="glass-strong">
                    <div className="card-header">
                      <div>
                        <div className="card-title">
                          <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}>
                            <CalendarDays size={16} />
                          </span>
                          Availability Calendar
                        </div>
                        <div className="card-subtitle">Click a date to view or add slots</div>
                      </div>
                      <div className="inline-flex">
                        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                          Available / Booked / Full
                        </span>
                      </div>
                    </div>
                    <div className="calendar-wrap">
                      <div className="cal-header">
                        <div className="cal-month">
                          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </div>
                        <div className="cal-nav">
                          <button
                            className="cal-btn"
                            onClick={() =>
                              setCurrentDate((prev) =>
                                new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                              )
                            }
                            type="button"
                          >
                            &lt;
                          </button>
                          <button
                            className="cal-btn"
                            onClick={() =>
                              setCurrentDate((prev) =>
                                new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                              )
                            }
                            type="button"
                          >
                            &gt;
                          </button>
                        </div>
                      </div>
                      <div className="cal-days-header">
                        {"Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(",").map((name) => (
                          <div className="cal-day-name" key={name}>
                            {name}
                          </div>
                        ))}
                      </div>
                      <div className="cal-grid">
                        {calendarDays.map((day) => {
                          if (day.empty) {
                            return <div className="cal-day empty" key={day.key} />;
                          }
                          let className = "cal-day";
                          if (day.today) className += " today";
                          if (day.selected) className += " selected";
                          if (day.hasSlot) className += " has-slot";
                          if (day.booked) className += " booked";
                          if (day.full) className += " full";
                          return (
                            <div
                              className={className}
                              key={day.key}
                              onClick={() => {
                                if (!day.day) return;
                                setSelectedDay(day.day);
                                showToast(
                                  "CAL",
                                  `Selected ${monthNames[currentDate.getMonth()]} ${day.day}`
                                );
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  if (!day.day) return;
                                  setSelectedDay(day.day);
                                }
                              }}
                            >
                              {day.day}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="glass">
                    <div className="card-header">
                      <div>
                        <div className="card-title">
                          <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}>
                            <Workflow size={16} />
                          </span>
                          Booking Lifecycle
                        </div>
                        <div className="card-subtitle">Real-time lifecycle visualization</div>
                      </div>
                    </div>
                    <div className="status-flow">
                      <div className="flow-step">
                        <div className="flow-icon active-step" style={{ background: "var(--green-glow)" }}>
                          <CalendarDays size={20} />
                        </div>
                        <div className="flow-label">Slot Published</div>
                      </div>
                      <div className="flow-connector done" />
                      <div className="flow-step">
                        <div className="flow-icon active-step" style={{ background: "var(--teal-glow)" }}>
                          <Search size={20} />
                        </div>
                        <div className="flow-label">Pending Request</div>
                      </div>
                      <div className="flow-connector done" />
                      <div className="flow-step">
                        <div className="flow-icon active-step" style={{ background: "var(--accent-glow)" }}>
                          <BadgeCheck size={20} />
                        </div>
                        <div className="flow-label">Booking Confirmed</div>
                      </div>
                      <div className="flow-connector" />
                      <div className="flow-step">
                        <div className="flow-icon" style={{ background: "var(--amber-glow)" }}>
                          <Mail size={20} />
                        </div>
                        <div className="flow-label">Reminder Sent</div>
                      </div>
                      <div className="flow-connector" />
                      <div className="flow-step">
                        <div className="flow-icon" style={{ background: "var(--purple-glow)" }}>
                          <GraduationCap size={20} />
                        </div>
                        <div className="flow-label">Completed</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="active-session fadein">
                    <button
                      className="session-pulse"
                      onClick={() => {
                        setTimerSecs(0);
                        setTimerRunning(true);
                      }}
                      title="Start session"
                      type="button"
                    />
                    <div className="session-text">
                      <div className="session-label">Session In Progress</div>
                    </div>
                    <div className="timer">{formatTimer(timerSecs)}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn-outline"
                        disabled={timerRunning}
                        onClick={() => {
                          setTimerSecs(0);
                          setTimerRunning(true);
                        }}
                        style={{ padding: "6px 12px", fontSize: 12 }}
                        type="button"
                      >
                        Start
                      </button>
                      <button
                        className="btn-outline"
                        disabled={!timerRunning}
                        onClick={() => setTimerRunning(false)}
                        style={{ padding: "6px 12px", fontSize: 12 }}
                        type="button"
                      >
                        Stop
                      </button>
                    </div>
                  </div>

                  <div className="glass-strong">
                    <div className="card-header">
                      <div>
                        <div className="card-title">
                          <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}>
                            <PlusCircle size={16} />
                          </span>
                          Add Time Slot
                        </div>
                        <div className="card-subtitle">Configure your consultation window</div>
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="slot-form">
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
                            onChange={(event) => setStart(event.target.value)}
                            type="time"
                            value={start}
                          />
                        </div>
                        <div className="form-field">
                          <label className="form-label" htmlFor="slot-end">End Time</label>
                          <input
                            className="form-input"
                            id="slot-end"
                            onChange={(event) => setEnd(event.target.value)}
                            type="time"
                            value={end}
                          />
                        </div>
                        <div className="form-field">
                          <label className="form-label" htmlFor="slot-type">Session Type</label>
                          <select className="form-input" id="slot-type">
                            <option>Academic Consultation</option>
                            <option>Thesis Review</option>
                            <option>Project Feedback</option>
                            <option>Career Guidance</option>
                          </select>
                        </div>
                        <div className="form-field">
                          <label className="form-label" htmlFor="slot-mode">Mode</label>
                          <select
                            className="form-input"
                            id="slot-mode"
                            onChange={(event) => setMode(event.target.value)}
                            value={mode}
                          >
                            <option>In-Person</option>
                            <option>Online (Zoom)</option>
                            <option>Hybrid</option>
                          </select>
                        </div>
                        {mode === "In-Person" ? (
                          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                            <label className="form-label" htmlFor="slot-location">Location</label>
                            <input
                              className="form-input"
                              id="slot-location"
                              list="slot-location-options"
                              onChange={(event) => setLocation(event.target.value)}
                              type="text"
                              value={location}
                            />
                            <datalist id="slot-location-options">
                              <option value="Main Office" />
                              <option value="Room 203" />
                              <option value="Library" />
                              <option value="Lab 1" />
                            </datalist>
                          </div>
                        ) : null}
                        <div className="ai-suggestion">
                          <div className="ai-badge">AI Insight</div>
                          <div className="ai-text">
                            Consider adding <strong>{aiInsight.highlight}</strong>. {aiInsight.detail}
                          </div>
                        </div>
                        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
                          <button className="btn-primary" onClick={handleAddSlot} style={{ flex: 1 }} type="button">
                            Add Slot
                          </button>
                          <button
                            className="btn-outline"
                            onClick={() => showToast("INFO", "Bulk slot creation coming soon!")}
                            type="button"
                          >
                            Bulk
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-strong" style={{ flex: 1 }}>
                    <div className="card-header">
                      <div>
                        <div className="card-title">
                          <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}>
                            <CalendarClock size={16} />
                          </span>
                          My Slots
                        </div>
                        <div className="card-subtitle">{slots.length} upcoming sessions</div>
                      </div>
                      <button
                        className="btn-outline"
                        onClick={() => showToast("EXPORT", "Export started!")}
                        type="button"
                      >
                        <Download size={14} />
                        Export
                      </button>
                    </div>
                    <div className="card-body overflow-y" style={{ paddingTop: 14 }}>
                      <div className="slot-list">
                        {slots.map((slot) => {
                          const statusMap: Record<SlotStatus, [string, string, string]> = {
                            available: ["ind-green", "badge-available", "Available"],
                            booked: ["ind-amber", "badge-booked", "Booked"],
                            full: ["ind-red", "badge-full", "Full"],
                          };
                          const [indicator, badge, label] = statusMap[slot.status];
                          const isSelected = selectedSlotId === slot.id;
                          return (
                            <div
                              className="slot-item fadein"
                              key={slot.id}
                              onClick={() => setSelectedSlotId(slot.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedSlotId(slot.id);
                                }
                              }}
                            >
                              <div className={`slot-indicator ${indicator}`} />
                              <div style={{ flex: 1 }}>
                                <div className="slot-date">{slot.date}</div>
                                <div className="slot-time">
                                  {slot.start} - {slot.end} - {slot.type} - {slot.mode}
                                  {isSelected && slot.location ? ` - ${slot.location}` : ""}
                                </div>
                              </div>
                              <div className="slot-meta">
                                <span className={`badge ${badge}`}>{label}</span>
                                <button
                                  className="btn-remove"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeSlot(slot.id);
                                  }}
                                  title="Remove"
                                  type="button"
                                >
                                  x
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="three-col fadein" style={{ marginBottom: 20 }}>
                <div className="glass card-body">
                  <div className="inline-flex" style={{ marginBottom: 16 }}>
                    <div className="card-title">
                      <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}>
                        <BarChart3 size={16} />
                      </span>
                      Weekly Bookings
                    </div>
                  </div>
                  <div className="chart-bar-container">
                    {[
                      ["Mon", 60, 6],
                      ["Tue", 90, 9],
                      ["Wed", 45, 4],
                      ["Thu", 80, 8],
                      ["Fri", 30, 3],
                      ["Sat", 10, 1],
                    ].map(([label, width, value]) => (
                      <div className="bar-row" key={label}>
                        <div className="bar-label">{label}</div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${width}%` }} />
                        </div>
                        <div className="bar-val">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass card-body">
                  <div className="card-title" style={{ marginBottom: 16 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}>
                      <PieChart size={16} />
                    </span>
                    Session Types
                  </div>
                  <div className="donut-wrap">
                    <svg className="donut-svg" width="110" height="110" viewBox="0 0 110 110">
                      <circle cx="55" cy="55" r="40" fill="none" stroke="rgba(180,190,220,0.2)" strokeWidth="16" />
                      <circle
                        cx="55"
                        cy="55"
                        r="40"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="16"
                        strokeDasharray="100 151"
                        strokeDashoffset="0"
                        strokeLinecap="round"
                        transform="rotate(-90 55 55)"
                      />
                      <circle
                        cx="55"
                        cy="55"
                        r="40"
                        fill="none"
                        stroke="var(--teal)"
                        strokeWidth="16"
                        strokeDasharray="56 195"
                        strokeDashoffset="-100"
                        strokeLinecap="round"
                        transform="rotate(-90 55 55)"
                      />
                      <circle
                        cx="55"
                        cy="55"
                        r="40"
                        fill="none"
                        stroke="var(--amber)"
                        strokeWidth="16"
                        strokeDasharray="38 213"
                        strokeDashoffset="-156"
                        strokeLinecap="round"
                        transform="rotate(-90 55 55)"
                      />
                      <text
                        x="55"
                        y="52"
                        textAnchor="middle"
                        fontFamily="Syne"
                        fontSize="13"
                        fontWeight="700"
                        fill="var(--ink)"
                      >
                        41
                      </text>
                      <text x="55" y="65" textAnchor="middle" fontSize="9" fill="var(--ink-3)">
                        sessions
                      </text>
                    </svg>
                    <div className="donut-legend">
                      {[
                        ["Academic", "40%", "var(--accent)"],
                        ["Thesis", "22%", "var(--teal)"],
                        ["Projects", "15%", "var(--amber)"],
                        ["Career", "23%", "var(--purple)"],
                      ].map(([label, pct, color]) => (
                        <div className="legend-item" key={label}>
                          <div className="legend-dot" style={{ background: color }} />
                          <div className="legend-key">{label}</div>
                          <div className="legend-pct">{pct}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="glass card-body">
                  <div className="card-title" style={{ marginBottom: 16 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}>
                      <Target size={16} />
                    </span>
                    Quick Stats
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="mini-stat">
                      <div className="mini-val" style={{ color: "var(--green)" }}>87%</div>
                      <div className="mini-label">Utilization</div>
                    </div>
                    <div className="mini-stat">
                      <div className="mini-val" style={{ color: "var(--accent)" }}>42m</div>
                      <div className="mini-label">Avg Duration</div>
                    </div>
                    <div className="mini-stat">
                      <div className="mini-val" style={{ color: "var(--amber)" }}>4.9</div>
                      <div className="mini-label">Rating</div>
                    </div>
                    <div className="mini-stat">
                      <div className="mini-val" style={{ color: "var(--purple)" }}>98%</div>
                      <div className="mini-label">Show Rate</div>
                    </div>
                  </div>
                  <div className="ai-suggestion" style={{ marginTop: 14, padding: "11px 14px" }}>
                    <div className="ai-badge">AI</div>
                    <div className="ai-text" style={{ fontSize: 12 }}>
                      Add <strong>Thu 2 PM</strong> slot - 6 waitlisted.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <div className="toast-icon">{toast.icon}</div>
            <div className="toast-text">{toast.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

