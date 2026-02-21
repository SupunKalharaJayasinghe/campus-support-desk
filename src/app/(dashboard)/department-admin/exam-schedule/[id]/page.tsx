import { PageHeader } from "@/components/shared/PageHeader";
import { AssessmentScheduleForm } from "@/components/forms/AssessmentScheduleForm";
import { Card } from "@/components/ui/Card";

export default function DepartmentExamSchedulePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Schedule Assessment" showBreadcrumbs />
      <Card>
        <AssessmentScheduleForm />
      </Card>
    </div>
  );
}
