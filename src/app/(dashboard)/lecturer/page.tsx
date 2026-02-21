import { StatsCard } from "@/components/shared/StatsCard";
import { ModuleProgress } from "@/components/features/dashboard/ModuleProgress";
import { RecentActivity } from "@/components/features/dashboard/RecentActivity";
import { QuickActions } from "@/components/features/dashboard/QuickActions";

export default function LecturerDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="My Modules" value="6" change="+1" />
        <StatsCard title="Pending Submissions" value="18" change="-4" trend="down" />
        <StatsCard title="Upcoming Quizzes" value="3" change="+2" />
        <StatsCard title="Total Students" value="220" change="+8" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions />
        <ModuleProgress />
      </div>
      <RecentActivity />
    </div>
  );
}
