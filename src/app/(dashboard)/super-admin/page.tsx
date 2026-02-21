import { StatsGrid } from "@/components/features/dashboard/StatsGrid";
import { QuickActions } from "@/components/features/dashboard/QuickActions";
import { RecentActivity } from "@/components/features/dashboard/RecentActivity";
import { UpcomingExams } from "@/components/features/dashboard/UpcomingExams";
import { PendingTasks } from "@/components/features/dashboard/PendingTasks";

export default function SuperAdminDashboardPage() {
  return (
    <div className="space-y-6">
      <StatsGrid />
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions />
        <PendingTasks />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity />
        <UpcomingExams />
      </div>
    </div>
  );
}
