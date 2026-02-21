import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { DeptAdminSidebar } from "@/components/layouts/DeptAdminSidebar";

export default function DepartmentAdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout sidebar={<DeptAdminSidebar />} role="Department Admin">
      {children}
    </DashboardLayout>
  );
}
