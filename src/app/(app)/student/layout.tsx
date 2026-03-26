import RoleGuard from "@/components/auth/RoleGuard";
import TopNav from "@/components/layout/TopNav";
import Container from "@/components/ui/Container";

const STUDENT_LINKS = [
  { label: "Dashboard", href: "/student" },
  { label: "Performance", href: "/student/performance" },
  { label: "My XP", href: "/student/gamification" },
  { label: "Book Lecturer", href: "/student/booking" },
  { label: "Report Lost Item", href: "/student/lost-items" },
  { label: "Announcements", href: "/student/announcements" },
  { label: "Help Requests", href: "/student/support" },
];

export default function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoleGuard allowedRole="STUDENT">
      <div className="min-h-screen bg-bg">
        <TopNav homeHref="/student" links={STUDENT_LINKS} />
        <main className="px-0 pb-8 pt-20">
          <Container size="6xl">{children}</Container>
        </main>
      </div>
    </RoleGuard>
  );
}
