import RoleGuard from "@/components/auth/RoleGuard";
import TopNav from "@/components/layout/TopNav";
import Container from "@/components/ui/Container";

const ADMIN_LINKS = [
  { label: "Overview", href: "/admin" },
  { label: "Faculty", href: "/admin/faculty" },
  { label: "Users", href: "/admin/users" },
  { label: "Grouping", href: "/admin/groups" },
  { label: "Notifications", href: "/admin/notifications" },
  { label: "Settings", href: "/admin/settings" },
];

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoleGuard allowedRole="SUPER_ADMIN">
      <div className="min-h-screen bg-bg">
        <TopNav homeHref="/admin" links={ADMIN_LINKS} />
        <main className="px-0 pb-8 pt-20">
          <Container size="6xl">{children}</Container>
        </main>
      </div>
    </RoleGuard>
  );
}
