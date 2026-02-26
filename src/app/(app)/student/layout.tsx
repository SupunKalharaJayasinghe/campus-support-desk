import RoleGuard from "@/components/auth/RoleGuard";

export default function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RoleGuard allowedRole="STUDENT">{children}</RoleGuard>;
}
