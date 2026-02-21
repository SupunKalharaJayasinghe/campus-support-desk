"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";
import { Settings, User, LogOut } from "lucide-react";

export function UserDropdown({
  name = "Jordan Parker",
  role = "Super Admin"
}: {
  name?: string;
  role?: string;
}) {
  return (
    <Dropdown
      trigger={
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50">
          <Avatar name={name} size="sm" />
          <div className="hidden flex-col text-left text-xs text-slate-600 md:flex">
            <span className="font-medium text-slate-700">{name}</span>
            <span>{role}</span>
          </div>
        </div>
      }
      items={[
        { label: "Profile", icon: <User className="h-4 w-4" /> },
        { label: "Settings", icon: <Settings className="h-4 w-4" /> },
        { divider: true, label: "divider" },
        { label: "Logout", icon: <LogOut className="h-4 w-4" /> }
      ]}
    />
  );
}
