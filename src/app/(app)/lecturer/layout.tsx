"use client";

import { usePathname } from "next/navigation";
import RoleGuard from "@/components/auth/RoleGuard";
import TopNav from "@/components/layout/TopNav";
import Container from "@/components/ui/Container";

const LECTURER_LINKS = [
  { label: "Dashboard", href: "/lecturer" },
  { label: "Availability", href: "/lecturer/availability" },
  { label: "Bookings", href: "/lecturer/bookings" },
  { label: "Notifications", href: "/lecturer/notifications" },
  { label: "Posts", href: "/lecturer/posts" },
];

export default function LecturerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isImmersive =
    pathname === "/lecturer/availability" ||
    pathname === "/lecturer/bookings" ||
    pathname.startsWith("/lecturer/availability/") ||
    pathname.startsWith("/lecturer/bookings/");

  return (
    <RoleGuard allowedRole="LECTURER">
      <div className="min-h-screen bg-bg">
        <TopNav homeHref="/lecturer" links={LECTURER_LINKS} />
        <main className="px-0 pb-8 pt-20">
          {isImmersive ? children : <Container size="6xl">{children}</Container>}
        </main>
      </div>
    </RoleGuard>
  );
}
