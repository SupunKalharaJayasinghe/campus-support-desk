import RoleGuard from "@/components/auth/RoleGuard";

export default function LecturerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RoleGuard allowedRole="LECTURER">{children}</RoleGuard>;
}
