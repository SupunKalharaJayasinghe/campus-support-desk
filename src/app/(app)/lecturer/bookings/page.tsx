"use client";

import "../lecturer-experience.css";

import { useCallback, useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  GraduationCap,
  History,
  Hourglass,
  Settings,
  Sparkles,
} from "lucide-react";

type ToastItem = {
  id: number;
  icon: string;
  text: string;
};

type BookingRow = {
  student: string;
  id: string;
  avatar: string;
  color: string;
  date: string;
  type: string;
  mode: string;
  status: "active" | "upcoming" | "confirmed";
};

type HistoryRow = {
  name: string;
  id: string;
  date: string;
  duration: string;
  type: string;
  rating: number;
  note: string;
};

const bookingsSeed: BookingRow[] = [
  {
    student: "Alice Chen",
    id: "STU-2024-003",
    avatar: "AC",
    color: "var(--accent)",
    date: "Mar 21, 09:00",
    type: "Thesis Review",
    mode: "In-Person",
    status: "active",
  },
  {
    student: "Ravi Perera",
    id: "STU-2024-011",
    avatar: "RP",
    color: "var(--teal)",
    date: "Mar 21, 10:30",
    type: "Academic",
    mode: "Online",
    status: "upcoming",
  },
  {
    student: "Maya Patel",
    id: "STU-2024-017",
    avatar: "MP",
    color: "var(--purple)",
    date: "Mar 21, 14:00",
    type: "Project Feedback",
    mode: "Hybrid",
    status: "upcoming",
  },
  {
    student: "James Kim",
    id: "STU-2024-029",
    avatar: "JK",
    color: "var(--amber)",
    date: "Mar 25, 11:00",
    type: "Career",
    mode: "In-Person",
    status: "confirmed",
  },
  {
    student: "Sara Rodriguez",
    id: "STU-2024-041",
    avatar: "SR",
    color: "var(--red)",
    date: "Mar 26, 09:00",
    type: "Thesis Review",
    mode: "Online",
    status: "confirmed",
  },
];

const historyRows: HistoryRow[] = [
  {
    name: "Alice Chen",
    id: "STU-2024-003",
    date: "Mar 18, 09:00",
    duration: "65 min",
    type: "Thesis Review",
    rating: 5,
    note: "Resolved",
  },
  {
    name: "Ravi Perera",
    id: "STU-2024-011",
    date: "Mar 17, 14:00",
    duration: "30 min",
    type: "Academic",
    rating: 5,
    note: "Resolved",
  },
  {
    name: "Maya Patel",
    id: "STU-2024-017",
    date: "Mar 15, 11:00",
    duration: "45 min",
    type: "Project Feedback",
    rating: 4,
    note: "Follow-up",
  },
  {
    name: "James Kim",
    id: "STU-2024-029",
    date: "Mar 14, 10:00",
    duration: "25 min",
    type: "Career Guidance",
    rating: 5,
    note: "Resolved",
  },
];

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdfDocument(lines: string[]) {
  const header = "%PDF-1.4\n";
  const safeLines = lines.map((line) => escapePdfText(line));
  const contentLines: string[] = [];
  safeLines.forEach((line, index) => {
    if (index > 0) contentLines.push("T*");
    contentLines.push(`(${line}) Tj`);
  });
  const content = ["BT", "/F1 12 Tf", "14 TL", "72 740 Td", ...contentLines, "ET"].join("\n");
  const objects = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 2, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    {
      id: 3,
      body: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    },
    { id: 4, body: `<< /Length ${content.length} >>\nstream\n${content}\nendstream` },
    { id: 5, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
  ];

  let output = header;
  const offsets = [0];
  let currentOffset = header.length;

  objects.forEach((object) => {
    offsets[object.id] = currentOffset;
    const chunk = `${object.id} 0 obj\n${object.body}\nendobj\n`;
    output += chunk;
    currentOffset += chunk.length;
  });

  const xrefStart = currentOffset;
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    const offset = String(offsets[i]).padStart(10, "0");
    output += `${offset} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(output);
}

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

export default function LecturerBookingsPage() {
  const { toasts, showToast } = useLocalToasts();
  const [bookTab, setBookTab] = useState<"upcoming" | "history" | "waitlist">("upcoming");
  const [autoPromote, setAutoPromote] = useState(true);
  const [remindersOn, setRemindersOn] = useState(true);
  const [maxQueue, setMaxQueue] = useState("5");
  const [studentSearch, setStudentSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  const statusMap: Record<BookingRow["status"], [string, string]> = {
    active: ["badge-available", "Active Now"],
    upcoming: ["badge-booked", "Upcoming"],
    confirmed: ["badge-waitlist", "Confirmed"],
  };

  const validateStudentSearch = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.length < 2) return "Enter at least 2 characters to filter.";
    if (!/^[A-Za-z\s'-]+$/.test(trimmed)) {
      return "Use letters, spaces, apostrophes, or hyphens only.";
    }
    return "";
  }, []);

  const applyStudentSearch = useCallback(() => {
    const error = validateStudentSearch(studentSearch);
    setSearchError(error || null);
    if (error) return;
    setAppliedSearch(studentSearch.trim());
  }, [studentSearch, validateStudentSearch]);

  const clearStudentSearch = useCallback(() => {
    setStudentSearch("");
    setAppliedSearch("");
    setSearchError(null);
  }, []);

  const normalizedSearch = appliedSearch.toLowerCase();
  const filteredBookings = bookingsSeed.filter((booking) => {
    if (!normalizedSearch) return true;
    return booking.student.toLowerCase().includes(normalizedSearch);
  });

  const downloadHistoryPdf = useCallback(() => {
    const generatedOn = new Date().toISOString().slice(0, 10);
    const lines = [
      "Session History",
      `Generated: ${generatedOn}`,
      `Total sessions: ${historyRows.length}`,
      "",
    ];

    historyRows.forEach((row, index) => {
      lines.push(`${index + 1}. ${row.name} (${row.id})`);
      lines.push(`Date: ${row.date} | Duration: ${row.duration}`);
      lines.push(`Type: ${row.type} | Rating: ${row.rating} | Notes: ${row.note}`);
      lines.push("");
    });

    const pdfBytes = buildPdfDocument(lines);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `session-history-${generatedOn}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="lecturer-experience">
      <div className="page">
        <div className="section active" id="sec-bookings">
          <div className="container">
            <div className="page-header fadein">
              <div>
                <div className="page-title">Bookings</div>
                <div className="page-subtitle">Manage student appointments and auto-waitlist queue</div>
              </div>
              <div className="inline-flex">
                <div className="tab-bar">
                  <button
                    className={`tab-btn ${bookTab === "upcoming" ? "active" : ""}`}
                    onClick={() => setBookTab("upcoming")}
                    type="button"
                  >
                    <CalendarCheck size={16} />
                    Upcoming
                  </button>
                  <button
                    className={`tab-btn ${bookTab === "history" ? "active" : ""}`}
                    onClick={() => setBookTab("history")}
                    type="button"
                  >
                    <History size={16} />
                    History
                  </button>
                  <button
                    className={`tab-btn ${bookTab === "waitlist" ? "active" : ""}`}
                    onClick={() => setBookTab("waitlist")}
                    type="button"
                  >
                    <Hourglass size={16} />
                    Waitlist
                  </button>
                </div>
              </div>
            </div>

            <div className="stats-row fadein">
              <div className="glass stat-card" style={{ color: "var(--accent)" }}>
                <div className="stat-icon" style={{ background: "var(--accent-glow)" }}><CalendarClock size={18} /></div>
                <div className="stat-value" style={{ color: "var(--ink)" }}>12</div>
                <div className="stat-label">Upcoming Today</div>
                <div className="stat-delta delta-up">Next at 10:30 AM</div>
              </div>
              <div className="glass stat-card" style={{ color: "var(--purple)" }}>
                <div className="stat-icon" style={{ background: "var(--purple-glow)" }}><GraduationCap size={18} /></div>
                <div className="stat-value" style={{ color: "var(--ink)" }}>87</div>
                <div className="stat-label">Total This Month</div>
                <div className="stat-delta delta-up">+12% vs last month</div>
              </div>
              <div className="glass stat-card" style={{ color: "var(--amber)" }}>
                <div className="stat-icon" style={{ background: "var(--amber-glow)" }}><Hourglass size={18} /></div>
                <div className="stat-value" style={{ color: "var(--ink)" }}>5</div>
                <div className="stat-label">Waitlist Queue</div>
                <div className="stat-delta delta-up">Auto-managed by AI</div>
              </div>
              <div className="glass stat-card" style={{ color: "var(--green)" }}>
                <div className="stat-icon" style={{ background: "var(--green-glow)" }}><CheckCircle2 size={18} /></div>
                <div className="stat-value" style={{ color: "var(--ink)" }}>98%</div>
                <div className="stat-label">Completion Rate</div>
                <div className="stat-delta delta-up">Top instructor</div>
              </div>
            </div>

            {bookTab === "upcoming" ? (
              <div className="main-side fadein">
                <div className="glass-strong" style={{ overflow: "hidden" }}>
                  <div className="card-header">
                    <div>
                      <div className="card-title"><span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><CalendarCheck size={16} /></span>Upcoming Sessions</div>
                      <div className="card-subtitle">Next 7 days - sorted by time</div>
                    </div>
                    <div className="inline-flex" style={{ alignItems: "flex-start" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <input
                          aria-describedby={searchError ? "student-search-error" : undefined}
                          aria-invalid={searchError ? "true" : "false"}
                          className="form-input"
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setStudentSearch(nextValue);
                            if (searchError) {
                              const nextError = validateStudentSearch(nextValue);
                              setSearchError(nextError || null);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              applyStudentSearch();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              clearStudentSearch();
                            }
                          }}
                          placeholder="Search student"
                          style={{
                            width: 220,
                            padding: "8px 14px",
                            fontSize: 13,
                            borderColor: searchError ? "var(--red)" : undefined,
                          }}
                          type="text"
                          value={studentSearch}
                        />
                        {searchError ? (
                          <div className="text-xs" id="student-search-error" style={{ color: "var(--red)" }}>
                            {searchError}
                          </div>
                        ) : null}
                      </div>
                      <button className="btn-outline" onClick={applyStudentSearch} type="button">
                        Filter
                      </button>
                      {appliedSearch ? (
                        <button className="btn-outline" onClick={clearStudentSearch} type="button">
                          Clear
                        </button>
                      ) : null}
                    </div>
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
                        {filteredBookings.length === 0 ? (
                          <tr>
                            <td colSpan={6}>
                              <div className="empty-state">
                                <div className="empty-text">
                                  No matching students found
                                  {appliedSearch ? ` for "${appliedSearch}".` : "."}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredBookings.map((booking) => {
                            const [badge, label] = statusMap[booking.status];
                            return (
                              <tr key={`${booking.id}-${booking.date}`}>
                                <td>
                                  <div className="student-info">
                                    <div className="avatar" style={{ background: booking.color }}>
                                      {booking.avatar}
                                    </div>
                                    <div>
                                      <div className="student-name">{booking.student}</div>
                                      <div className="student-id">{booking.id}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ color: "var(--ink-2)", fontSize: 13 }}>{booking.date}</td>
                                <td style={{ color: "var(--ink-2)", fontSize: 13 }}>{booking.type}</td>
                                <td style={{ color: "var(--ink-2)", fontSize: 13 }}>{booking.mode}</td>
                                <td>
                                  <span className={`badge ${badge}`}>{label}</span>
                                </td>
                                <td>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      className="btn-outline"
                                      onClick={() => showToast("VIEW", `Viewing ${booking.student}`)}
                                      style={{ padding: "6px 12px", fontSize: 12 }}
                                      type="button"
                                    >
                                      View
                                    </button>
                                    <button
                                      className="btn-outline"
                                      onClick={() => showToast("MOVE", `${booking.student} rescheduled`)}
                                      style={{ padding: "6px 12px", fontSize: 12, color: "var(--red)" }}
                                      type="button"
                                    >
                                      Reschedule
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="glass-strong">
                    <div className="card-header">
                      <div>
                      <div className="card-title"><span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><Sparkles size={16} /></span>AI Duration Suggester</div>
                        <div className="card-subtitle">Optimized for each student</div>
                      </div>
                    </div>
                    <div className="card-body">
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div className="slot-item" style={{ cursor: "default", borderColor: "rgba(52,97,255,0.2)" }}>
                          <div style={{ fontSize: 22 }}>AI</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                              Alice Chen - Thesis
                            </div>
                            <div className="text-xs" style={{ marginTop: 3 }}>
                              Complex topic detected
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div className="font-syne" style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>
                              75 min
                            </div>
                            <div className="text-xs">Suggested</div>
                          </div>
                        </div>
                        <div className="slot-item" style={{ cursor: "default" }}>
                          <div style={{ fontSize: 22 }}>AI</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                              Ravi Perera - Grades
                            </div>
                            <div className="text-xs" style={{ marginTop: 3 }}>
                              Simple query
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div className="font-syne" style={{ fontWeight: 700, fontSize: 16, color: "var(--teal)" }}>
                              20 min
                            </div>
                            <div className="text-xs">Suggested</div>
                          </div>
                        </div>
                        <div className="ai-suggestion">
                          <div className="ai-badge">AI</div>
                          <div className="ai-text" style={{ fontSize: 12 }}>
                            Based on past history and query complexity analysis.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-strong">
                    <div className="card-header">
                      <div>
                        <div className="card-title"><span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><Clock size={16} /></span>Todays Timeline</div>
                        <div className="card-subtitle">March 21, 2026</div>
                      </div>
                    </div>
                    <div className="card-body" style={{ paddingTop: 14 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div
                            style={{
                              textAlign: "right",
                              minWidth: 48,
                              paddingTop: 2,
                              fontSize: 12,
                              color: "var(--ink-3)",
                              fontWeight: 600,
                            }}
                          >
                            09:00
                          </div>
                          <div
                            style={{
                              width: 2,
                              background: "var(--green)",
                              borderRadius: 2,
                              flexShrink: 0,
                              marginTop: 4,
                              height: 48,
                              boxShadow: "0 0 8px var(--green)",
                            }}
                          />
                          <div
                            className="slot-item"
                            style={{
                              flex: 1,
                              margin: 0,
                              padding: "10px 14px",
                              borderColor: "rgba(16,185,129,0.3)",
                              background: "var(--green-glow)",
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Alice Chen</div>
                            <div className="badge badge-available" style={{ marginTop: 0 }}>
                              In Progress
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div
                            style={{
                              textAlign: "right",
                              minWidth: 48,
                              paddingTop: 2,
                              fontSize: 12,
                              color: "var(--ink-3)",
                              fontWeight: 600,
                            }}
                          >
                            10:30
                          </div>
                          <div
                            style={{
                              width: 2,
                              background: "var(--border)",
                              borderRadius: 2,
                              flexShrink: 0,
                              marginTop: 4,
                              height: 48,
                            }}
                          />
                          <div className="slot-item" style={{ flex: 1, margin: 0, padding: "10px 14px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Ravi Perera</div>
                            <div className="badge badge-booked" style={{ marginTop: 0 }}>
                              Upcoming
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div
                            style={{
                              textAlign: "right",
                              minWidth: 48,
                              paddingTop: 2,
                              fontSize: 12,
                              color: "var(--ink-3)",
                              fontWeight: 600,
                            }}
                          >
                            14:00
                          </div>
                          <div
                            style={{
                              width: 2,
                              background: "var(--border)",
                              borderRadius: 2,
                              flexShrink: 0,
                              marginTop: 4,
                              height: 48,
                            }}
                          />
                          <div className="slot-item" style={{ flex: 1, margin: 0, padding: "10px 14px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Maya Patel</div>
                            <div className="badge badge-booked" style={{ marginTop: 0 }}>
                              Upcoming
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {bookTab === "history" ? (
              <div className="fadein">
                <div className="glass-strong" style={{ overflow: "hidden" }}>
                  <div className="card-header">
                    <div>
                      <div className="card-title"><span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><History size={16} /></span>Session History</div>
                      <div className="card-subtitle">All completed consultations</div>
                    </div>
                    <button className="btn-outline" onClick={downloadHistoryPdf} type="button">
                      Export PDF
                    </button>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="booking-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Date</th>
                          <th>Duration</th>
                          <th>Type</th>
                          <th>Rating</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRows.map((row) => (
                          <tr key={`${row.name}-${row.date}`}>
                            <td>
                              <div className="student-info">
                                <div className="avatar" style={{ background: "var(--accent)" }}>
                                  {row.name
                                    .split(" ")
                                    .map((part) => part[0])
                                    .join("")}
                                </div>
                                <div>
                                  <div className="student-name">{row.name}</div>
                                  <div className="student-id">{row.id}</div>
                                </div>
                              </div>
                            </td>
                            <td>{row.date}</td>
                            <td>{row.duration}</td>
                            <td>{row.type}</td>
                            <td>{"*".repeat(row.rating)}</td>
                            <td>
                              <span className="badge badge-available">{row.note}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {bookTab === "waitlist" ? (
              <div className="two-col fadein">
                <div className="glass-strong">
                  <div className="card-header">
                    <div>
                      <div className="card-title"><span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><Hourglass size={16} /></span>Auto-Waitlist Queue</div>
                      <div className="card-subtitle">AI manages promotion automatically</div>
                    </div>
                    <div className="ai-chip">Auto-Promote ON</div>
                  </div>
                  <div className="card-body">
                    <div className="ai-suggestion" style={{ marginBottom: 18 }}>
                      <div className="ai-badge">AI</div>
                      <div className="ai-text">
                        Slot on <strong>Mar 27 at 2 PM</strong> just freed up. Notifying #1 in queue automatically.
                      </div>
                    </div>
                    {[
                      [1, "Sara Rodriguez", "2h ago - Thesis Review", "SR", "var(--accent)"],
                      [2, "Liam Murphy", "5h ago - Academic", "LM", "var(--teal)"],
                      [3, "Nina Kumar", "1d ago - Project", "NK", "var(--purple)"],
                      [4, "Temi Okafor", "1d ago - Career", "TO", "var(--amber)"],
                      [5, "Hana Wong", "2d ago - Thesis", "HW", "var(--red)"],
                    ].map(([pos, name, time, initials, color]) => (
                      <div className="waitlist-item" key={name}>
                        <div className="wl-position">{pos}</div>
                        <div
                          className="avatar"
                          style={{ background: color, width: 28, height: 28, fontSize: 11, flexShrink: 0 }}
                        >
                          {initials}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="wl-name">{name}</div>
                          <div className="text-xs">Requested: {time}</div>
                        </div>
                        <button
                          className="wl-promote"
                          onClick={() => showToast("OK", `${name} confirmed for slot.`)}
                          type="button"
                        >
                          Confirm Slot
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="glass-strong">
                    <div className="card-header">
                      <div>
                        <div className="card-title"><span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><Settings size={16} /></span>Waitlist Settings</div>
                        <div className="card-subtitle">Auto-promotion rules</div>
                      </div>
                    </div>
                    <div className="card-body">
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px 16px",
                            background: "rgba(52,97,255,0.05)",
                            borderRadius: 11,
                            border: "1px solid rgba(52,97,255,0.1)",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Auto-Promote on Cancel</div>
                            <div className="text-xs" style={{ marginTop: 2 }}>
                              Instantly notify next in queue
                            </div>
                          </div>
                          <div
                            className={`toggle ${autoPromote ? "on" : ""}`}
                            onClick={() => setAutoPromote((prev) => !prev)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setAutoPromote((prev) => !prev);
                              }
                            }}
                          >
                            <span> </span>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px 16px",
                            background: "rgba(255,255,255,0.4)",
                            borderRadius: 11,
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600 }}>48h Reminder Emails</div>
                            <div className="text-xs" style={{ marginTop: 2 }}>
                              Auto email 48h before slot
                            </div>
                          </div>
                          <div
                            className={`toggle ${remindersOn ? "on" : ""}`}
                            onClick={() => setRemindersOn((prev) => !prev)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setRemindersOn((prev) => !prev);
                              }
                            }}
                          >
                            <span> </span>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px 16px",
                            background: "rgba(255,255,255,0.4)",
                            borderRadius: 11,
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Max Queue Size</div>
                            <div className="text-xs" style={{ marginTop: 2 }}>
                              Per time slot
                            </div>
                          </div>
                          <select
                            className="form-input"
                            onChange={(event) => setMaxQueue(event.target.value)}
                            style={{ width: 80, padding: "6px 10px", fontSize: 13 }}
                            value={maxQueue}
                          >
                            <option>5</option>
                            <option>10</option>
                            <option>15</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-strong">
                    <div className="card-header">
                      <div>
                        <div className="card-title"><span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><BarChart3 size={16} /></span>Queue Analytics</div>
                      </div>
                    </div>
                    <div className="card-body">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div className="mini-stat">
                          <div className="mini-val" style={{ color: "var(--purple)" }}>5</div>
                          <div className="mini-label">Queue Length</div>
                        </div>
                        <div className="mini-stat">
                          <div className="mini-val" style={{ color: "var(--accent)" }}>2.4h</div>
                          <div className="mini-label">Avg Wait</div>
                        </div>
                        <div className="mini-stat">
                          <div className="mini-val" style={{ color: "var(--green)" }}>94%</div>
                          <div className="mini-label">Accept Rate</div>
                        </div>
                        <div className="mini-stat">
                          <div className="mini-val" style={{ color: "var(--amber)" }}>8 min</div>
                          <div className="mini-label">Avg Response</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
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

