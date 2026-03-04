"use client";

import { useState } from "react";
import { AdminContextProvider } from "@/components/admin/AdminContext";
import AdminSidebar from "@/components/layout/admin/AdminSidebar";
import AdminTopbar from "@/components/layout/admin/AdminTopbar";
import Container from "@/components/ui/Container";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <AdminContextProvider>
      <div className="h-screen bg-bg">
        <div className="flex h-full overflow-hidden">
          <AdminSidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <AdminTopbar />
            <main className="min-h-0 flex-1 overflow-y-auto pb-10 pt-5">
              <Container size="6xl">{children}</Container>
            </main>
          </div>
        </div>
      </div>
    </AdminContextProvider>
  );
}
