"use client";

import { formatDateOrRelative } from "@/lib/utils";

const activities = [
  {
    id: "1",
    title: "New student registered",
    description: "Ariana Silva joined BSc Computer Science",
    time: "2026-02-17T12:20:00Z"
  },
  {
    id: "2",
    title: "Assessment published",
    description: "Mid Exam schedule updated for CS204",
    time: "2026-02-16T08:15:00Z"
  },
  {
    id: "3",
    title: "Lost item reported",
    description: "Blue backpack reported near library",
    time: "2026-02-15T10:45:00Z"
  }
];

export function RecentActivity() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Recent Activity</h3>
      <div className="mt-4 space-y-4">
        {activities.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">{item.title}</p>
              <p className="text-xs text-slate-500">{item.description}</p>
            </div>
            <span className="text-xs text-slate-400">
              {formatDateOrRelative(item.time)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
