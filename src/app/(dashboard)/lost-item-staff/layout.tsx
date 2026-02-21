import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { LostItemStaffSidebar } from "@/components/layouts/LostItemStaffSidebar";

export default function LostItemStaffLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout sidebar={<LostItemStaffSidebar />} role="Lost Item Staff">
      {children}
    </DashboardLayout>
  );
}
