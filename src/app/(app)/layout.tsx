"use client";

import { useState } from "react";
import RoleGuard from "@/components/auth/RoleGuard";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { ToastProvider } from "@/components/ui/ToastProvider";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <RoleGuard>
        <div className="min-h-screen bg-slate-50 md:pl-64">
          <Sidebar onClose={() => setSidebarOpen(false)} open={sidebarOpen} />
          <div className="min-h-screen">
            <Topbar onMenuClick={() => setSidebarOpen((previous) => !previous)} />
            <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </RoleGuard>
    </ToastProvider>
  );
}
