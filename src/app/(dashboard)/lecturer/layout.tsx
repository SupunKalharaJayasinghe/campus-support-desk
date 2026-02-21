import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { LecturerSidebar } from "@/components/layouts/LecturerSidebar";

export default function LecturerLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout sidebar={<LecturerSidebar />} role="Lecturer">
      {children}
    </DashboardLayout>
  );
}
