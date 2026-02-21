import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { StatsCard } from "@/components/shared/StatsCard";
import { Button } from "@/components/ui/Button";

export default function DegreeProgramDetailsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Details"
        description="Manage modules, lecturers, and students for this program."
        showBreadcrumbs
        actions={<Button variant="outline">Edit Program</Button>}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Total Students" value="420" />
        <StatsCard title="Lecturers" value="24" />
        <StatsCard title="Active Modules" value="18" />
      </div>
      <Card title="BSc Computer Science">
        <p className="text-sm text-slate-600">
          Program overview and highlights appear here.
        </p>
      </Card>
      <Tabs
        items={[
          { id: "overview", label: "Overview" },
          { id: "modules", label: "Modules" },
          { id: "lecturers", label: "Lecturers" },
          { id: "students", label: "Students" },
          { id: "groups", label: "Groups" },
          { id: "batches", label: "Batches" }
        ]}
      />
      <Card title="Overview">
        <p className="text-sm text-slate-600">Tab content placeholder.</p>
      </Card>
    </div>
  );
}
