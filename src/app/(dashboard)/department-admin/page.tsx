import { StatsGrid } from "@/components/features/dashboard/StatsGrid";
import { QuickActions } from "@/components/features/dashboard/QuickActions";
import { RecentActivity } from "@/components/features/dashboard/RecentActivity";
import { PendingTasks } from "@/components/features/dashboard/PendingTasks";

export default function DepartmentAdminDashboardPage() {
  return (
    <div className="space-y-6">
      <StatsGrid />
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions />
        <PendingTasks />
      </div>
      <RecentActivity />
    </div>
  );
}
