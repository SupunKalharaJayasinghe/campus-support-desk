"use client";

import { usePathname } from "next/navigation";
import RoleGuard from "@/components/auth/RoleGuard";
import TopNav from "@/components/layout/TopNav";

const LECTURER_LINKS = [
  { label: "Dashboard", href: "/lecturer" },
  { label: "My Course", href: "/lecturer/my-course" },
  { label: "Quizzes", href: "/lecturer/quizzes" },
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
  const activePath = pathname.startsWith("/lecturer") ? pathname : "/lecturer";

  return (
    <RoleGuard allowedRole="LECTURER">
      <div className="min-h-screen bg-[#f0f2f7]">
        <TopNav currentPath={activePath} homeHref="/lecturer" links={LECTURER_LINKS} />
        <main className="px-0 pb-0 pt-20">{children}</main>
      </div>
    </RoleGuard>
  );
}
