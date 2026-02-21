import { StatsCard } from "@/components/shared/StatsCard";
import { ModuleProgress } from "@/components/features/dashboard/ModuleProgress";
import { RecentActivity } from "@/components/features/dashboard/RecentActivity";
import { UpcomingExams } from "@/components/features/dashboard/UpcomingExams";

export default function StudentDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatsCard title="Current Semester" value="Semester 1" />
        <StatsCard title="Enrolled Modules" value="5" />
        <StatsCard title="Pending Assignments" value="2" />
        <StatsCard title="Upcoming Quizzes" value="1" />
        <StatsCard title="Current GPA" value="3.6" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ModuleProgress />
        <UpcomingExams />
      </div>
      <RecentActivity />
    </div>
  );
}
