"use client";

import { ProgressBar } from "@/components/ui/ProgressBar";

const modules = [
  { id: "1", name: "Data Structures", progress: 72 },
  { id: "2", name: "Database Systems", progress: 54 },
  { id: "3", name: "Cloud Computing", progress: 88 }
];

export function ModuleProgress() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Module Progress</h3>
      <div className="mt-4 space-y-4">
        {modules.map((module) => (
          <div key={module.id}>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>{module.name}</span>
              <span>{module.progress}%</span>
            </div>
            <ProgressBar value={module.progress} />
          </div>
        ))}
      </div>
    </div>
  );
}
