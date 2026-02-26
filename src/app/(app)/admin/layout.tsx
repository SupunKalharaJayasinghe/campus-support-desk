import RoleGuard from "@/components/auth/RoleGuard";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RoleGuard allowedRole="SUPER_ADMIN">{children}</RoleGuard>;
}
