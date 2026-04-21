"use client";

import { usePathname } from "next/navigation";
import RoleGuard from "@/components/auth/RoleGuard";
import TopNav from "@/components/layout/TopNav";

const TECHNICIAN_LINKS = [
  { label: "Dashboard", href: "/technician" },
  { label: "My in progress", href: "/technician/tickets/in-progress" },
  { label: "My accepted", href: "/technician/tickets/accepted" },
  { label: "My resolved", href: "/technician/tickets/resolved" },
];

export default function TechnicianLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <RoleGuard allowedRole="TECHNICIAN">
      <div className="min-h-screen bg-[#f0f2f7]">
        <TopNav currentPath={pathname} homeHref="/technician" links={TECHNICIAN_LINKS} />
        <main className="px-0 pb-8 pt-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </RoleGuard>
  );
}
