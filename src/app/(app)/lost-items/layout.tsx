import RoleGuard from "@/components/auth/RoleGuard";
import TopNav from "@/components/layout/TopNav";
import Container from "@/components/ui/Container";

const LOST_ITEMS_LINKS = [
  { label: "Dashboard", href: "/lost-items" },
  { label: "Found Items", href: "/lost-items/found" },
  { label: "Claims", href: "/lost-items/claims" },
  { label: "Inventory", href: "/lost-items/inventory" },
  { label: "Notifications", href: "/lost-items/notifications" },
];

export default function LostItemsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoleGuard allowedRole="LOST_ITEM_STAFF">
      <div className="min-h-screen bg-bg">
        <TopNav homeHref="/lost-items" links={LOST_ITEMS_LINKS} />
        <main className="px-0 pb-8 pt-20">
          <Container size="6xl">{children}</Container>
        </main>
      </div>
    </RoleGuard>
  );
}
