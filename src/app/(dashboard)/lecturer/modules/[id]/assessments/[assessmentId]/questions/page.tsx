import { PageHeader } from "@/components/shared/PageHeader";
import { QuestionForm } from "@/components/forms/QuestionForm";
import { Card } from "@/components/ui/Card";

export default function AssessmentQuestionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Question Builder" showBreadcrumbs />
      <Card>
        <QuestionForm />
      </Card>
    </div>
  );
}
