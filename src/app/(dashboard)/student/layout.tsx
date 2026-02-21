import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { StudentSidebar } from "@/components/layouts/StudentSidebar";

export default function StudentLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout sidebar={<StudentSidebar />} role="Student">
      {children}
    </DashboardLayout>
  );
}
