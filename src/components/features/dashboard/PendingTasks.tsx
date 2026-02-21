"use client";

const tasks = [
  { id: "1", title: "Review pending lost items", due: "Today" },
  { id: "2", title: "Approve lecturer assignments", due: "Tomorrow" },
  { id: "3", title: "Publish exam timetable", due: "Feb 20" }
];

export function PendingTasks() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Pending Tasks</h3>
      <ul className="mt-4 space-y-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
          >
            <span className="text-slate-700">{task.title}</span>
            <span className="text-xs text-slate-500">{task.due}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
