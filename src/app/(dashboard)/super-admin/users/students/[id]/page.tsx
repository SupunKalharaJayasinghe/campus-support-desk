import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatsCard } from "@/components/shared/StatsCard";
import { Button } from "@/components/ui/Button";

export default function StudentDetailsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Profile"
        description="Academic and enrollment details."
        showBreadcrumbs
        actions={
          <div className="flex gap-2">
            <Button variant="outline">Edit</Button>
            <Button variant="outline">Change Program</Button>
            <Button variant="outline">Promote</Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Current GPA" value="3.6" />
        <StatsCard title="Enrolled Modules" value="5" />
        <StatsCard title="Status" value="Active" />
      </div>
      <Card title="Academic Info">
        <p className="text-sm text-slate-600">
          Student academic information and module enrollments appear here.
        </p>
      </Card>
    </div>
  );
}
