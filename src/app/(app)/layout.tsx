"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { ToastProvider } from "@/components/ui/ToastProvider";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <RoleGuard>
        <div className="min-h-screen bg-bg">{children}</div>
      </RoleGuard>
    </ToastProvider>
  );
}
