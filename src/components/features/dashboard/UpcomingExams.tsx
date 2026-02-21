"use client";

const exams = [
  { id: "1", module: "CS204", date: "Mar 12, 2026", time: "09:00 AM" },
  { id: "2", module: "CS310", date: "Mar 15, 2026", time: "01:00 PM" },
  { id: "3", module: "CS401", date: "Mar 20, 2026", time: "10:00 AM" }
];

export function UpcomingExams() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Upcoming Exams</h3>
      <div className="mt-4 space-y-3">
        {exams.map((exam) => (
          <div
            key={exam.id}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-slate-700">{exam.module}</p>
              <p className="text-xs text-slate-500">
                {exam.date} · {exam.time}
              </p>
            </div>
            <span className="text-xs font-semibold text-indigo-600">Scheduled</span>
          </div>
        ))}
      </div>
    </div>
  );
}
