import { PageHeader } from "@/components/shared/PageHeader";
import { AssessmentForm } from "@/components/forms/AssessmentForm";
import { Card } from "@/components/ui/Card";

export default function NewAssessmentPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Create Assessment" showBreadcrumbs />
      <Card>
        <AssessmentForm />
      </Card>
    </div>
  );
}
