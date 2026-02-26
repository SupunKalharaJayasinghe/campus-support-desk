"use client";

import { useState } from "react";
import RoleGuard from "@/components/auth/RoleGuard";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import Container from "@/components/ui/Container";
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
        <div className="min-h-screen bg-bg md:pl-72">
          <Sidebar onClose={() => setSidebarOpen(false)} open={sidebarOpen} />
          <div className="min-h-screen">
            <Topbar onMenuClick={() => setSidebarOpen((previous) => !previous)} />
            <main className="py-8">
              <Container>{children}</Container>
            </main>
          </div>
        </div>
      </RoleGuard>
    </ToastProvider>
  );
}
