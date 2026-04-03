"use client";

import "../lecturer-experience.css";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarRange, Layers3, MonitorPlay } from "lucide-react";
import { authHeaders } from "@/models/rbac";

interface LecturerCourseItem {
  id: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  intakeId: string;
  intakeName: string;
  termCode: string;
  currentWeekNo: number | null;
  totalWeeks: number;
  assignedLecturer: boolean;
}

interface LecturerCoursePayload {
  items: LecturerCourseItem[];
  total: number;
}

export default function LecturerMyCoursePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<LecturerCoursePayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch("/api/lecturer/my-course", {
          cache: "no-store",
          headers: {
            ...authHeaders(),
          },
        });
        const payload = (await response.json().catch(() => null)) as
          | LecturerCoursePayload
          | { message?: string }
          | null;
        if (!response.ok) {
          throw new Error(
            payload && typeof payload === "object" && "message" in payload
              ? payload.message || "Failed to load course modules."
              : "Failed to load course modules."
          );
        }

        if (!cancelled) {
          const normalizedPayload = (payload ?? {
            items: [],
            total: 0,
          }) as LecturerCoursePayload;
          setData({
            items: Array.isArray(normalizedPayload.items)
              ? normalizedPayload.items
              : [],
            total: Math.max(0, Number(normalizedPayload.total) || 0),
          });
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load course modules."
          );
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
  }, []);

  if (loading) {
    return (
      <div className="lecturer-experience">
        <div className="page">
          <div className="container">
            <div className="glass-strong card-body">Loading course modules...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lecturer-experience">
        <div className="page">
          <div className="container">
            <div className="glass-strong">
              <div className="card-body">
                <div className="page-title" style={{ fontSize: 24 }}>My Course</div>
                <div className="page-subtitle" style={{ color: "var(--red)", marginTop: 8 }}>{error}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const modules = data?.items ?? [];
  const activeWeekCount = modules.filter((module) => module.currentWeekNo !== null).length;
  const totalWeeks = modules.reduce((sum, module) => sum + Math.max(0, module.totalWeeks), 0);
  const intakeCount = new Set(modules.map((module) => module.intakeId).filter(Boolean)).size;

  return (
    <div className="lecturer-experience">
      <div className="page">
        <div className="section active">
          <div className="container">
            <div className="page-header fadein">
              <div>
                <div className="page-title">My Course</div>
                <div className="page-subtitle">
                  Weekly teaching content grouped by assigned module offerings and intake schedules.
                </div>
              </div>
            </div>

            <div className="stats-row fadein">
              {[
                { icon: <BookOpen size={18} />, label: "Assigned modules", value: modules.length, color: "var(--accent)" },
                { icon: <MonitorPlay size={18} />, label: "Active weeks", value: activeWeekCount, color: "var(--green)" },
                { icon: <CalendarRange size={18} />, label: "Planned weeks", value: totalWeeks, color: "var(--purple)" },
                { icon: <Layers3 size={18} />, label: "Intakes", value: intakeCount, color: "var(--amber)" },
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
                  <div className="card-title">Assigned Module Offerings</div>
                  <div className="card-subtitle">
                    Open a module to edit weekly content in the same lecturer workspace.
                  </div>
                </div>
              </div>
              <div className="card-body">
                {modules.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-text">
                      No active module offerings are assigned to your lecturer account.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: 16,
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    }}
                  >
                    {modules.map((module) => (
                      <div className="glass" key={module.id} style={{ padding: 20 }}>
                        <div
                          className="inline-flex"
                          style={{
                            justifyContent: "space-between",
                            width: "100%",
                            alignItems: "flex-start",
                          }}
                        >
                          <div>
                            <div className="student-name">{module.moduleCode}</div>
                            <div className="slot-time" style={{ marginTop: 4 }}>{module.moduleName}</div>
                          </div>
                          <span className={`badge ${module.currentWeekNo ? "badge-available" : "badge-waitlist"}`}>
                            {module.currentWeekNo ? `Week ${module.currentWeekNo}` : "Planned"}
                          </span>
                        </div>

                        <div className="slot-list" style={{ marginTop: 14 }}>
                          <div className="slot-item" style={{ cursor: "default" }}>
                            <div className="slot-indicator ind-blue" />
                            <div style={{ flex: 1 }}>
                              <div className="slot-date">{module.intakeName}</div>
                              <div className="slot-time">{module.termCode || "Term not set"}</div>
                            </div>
                          </div>
                          <div className="slot-item" style={{ cursor: "default" }}>
                            <div className="slot-indicator ind-green" />
                            <div style={{ flex: 1 }}>
                              <div className="slot-date">{module.totalWeeks} academic weeks</div>
                              <div className="slot-time">
                                {module.currentWeekNo
                                  ? `Current teaching week: ${module.currentWeekNo}`
                                  : "No active academic week right now"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                          <Link
                            className="btn-outline"
                            href={`/lecturer/my-course/${encodeURIComponent(module.id)}`}
                          >
                            Manage Weekly Content
                            <ArrowRight size={16} />
                          </Link>
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
