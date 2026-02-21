"use client";

import { Button } from "@/components/ui/Button";
import { UserPlus, GraduationCap, Bell, BookOpen } from "lucide-react";

const actions = [
  { label: "Add New Student", icon: <UserPlus className="h-4 w-4" /> },
  { label: "Add New Lecturer", icon: <UserPlus className="h-4 w-4" /> },
  { label: "Create Degree Program", icon: <GraduationCap className="h-4 w-4" /> },
  { label: "Send Notification", icon: <Bell className="h-4 w-4" /> },
  { label: "Add Module", icon: <BookOpen className="h-4 w-4" /> }
];

export function QuickActions() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Quick Actions</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Button key={action.label} variant="outline" iconLeft={action.icon}>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
