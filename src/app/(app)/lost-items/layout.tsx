import RoleGuard from "@/components/auth/RoleGuard";

export default function LostItemsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RoleGuard allowedRole="LOST_ITEM_STAFF">{children}</RoleGuard>;
}
