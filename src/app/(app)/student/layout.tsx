import RoleGuard from "@/components/auth/RoleGuard";
import TopNav from "@/components/layout/TopNav";
import Container from "@/components/ui/Container";

const STUDENT_LINKS = [
  { label: "Dashbord", href: "/student" },
  { label: "Book lecture", href: "/student/booking" },
  { label: "Announcement", href: "/student/announcements" },
  { label: "Report a problem", href: "/student/support" },
  { label: "Community help", href: "/community" },
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
