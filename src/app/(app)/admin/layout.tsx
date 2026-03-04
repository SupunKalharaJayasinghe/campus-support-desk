import RoleGuard from "@/components/auth/RoleGuard";
import AdminShell from "@/components/layout/admin/AdminShell";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoleGuard allowedRole="SUPER_ADMIN">
      <AdminShell>{children}</AdminShell>
    </RoleGuard>
  );
}
