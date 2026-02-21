"use client";

import { useState } from "react";
import { Header } from "@/components/layouts/Header";
import { SearchInput } from "@/components/ui/SearchInput";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { UserDropdown } from "@/components/shared/UserDropdown";

export function DashboardLayout({
  children,
  sidebar,
  role
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  role: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden md:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-64 bg-white shadow-lg">{sidebar}</div>
          <div
            className="flex-1 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
      <div className="flex min-h-screen flex-1 flex-col">
        <Header
          onMenuToggle={() => setOpen(true)}
          rightSlot={
            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                <SearchInput placeholder="Search students, modules..." />
              </div>
              <NotificationBell />
              <UserDropdown role={role} />
            </div>
          }
        />
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
