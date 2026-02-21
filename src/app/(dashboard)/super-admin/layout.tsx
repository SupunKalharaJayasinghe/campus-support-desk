import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { SuperAdminSidebar } from "@/components/layouts/SuperAdminSidebar";

export default function SuperAdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout sidebar={<SuperAdminSidebar />} role="Super Admin">
      {children}
    </DashboardLayout>
  );
}
