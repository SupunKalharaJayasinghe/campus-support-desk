import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ExamSchedulePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Schedule"
        description="View and manage the full exam calendar."
        showBreadcrumbs
        actions={<Button variant="outline">List View</Button>}
      />
      <Card title="Calendar View">
        <p className="text-sm text-slate-600">
          Calendar view placeholder with filters by program and assessment type.
        </p>
      </Card>
    </div>
  );
}
