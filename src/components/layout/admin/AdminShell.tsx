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
      <div className="admin-experience min-h-screen bg-bg">
        <div className="admin-shell">
          <div className="admin-workspace flex min-h-screen overflow-hidden">
            <AdminSidebar
              collapsed={sidebarCollapsed}
              onCollapsedChange={setSidebarCollapsed}
            />

            <div className="admin-main-column flex min-w-0 flex-1 flex-col overflow-hidden">
              <AdminTopbar />
              <main className="admin-main min-h-0 flex-1 overflow-y-auto pb-12 pt-6 lg:pt-8">
                <Container className="admin-content" size="6xl">
                  {children}
                </Container>
              </main>
            </div>
          </div>
        </div>
      </div>
    </AdminContextProvider>
  );
}
