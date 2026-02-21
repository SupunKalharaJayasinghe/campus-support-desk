import { PageHeader } from "@/components/shared/PageHeader";
import { QuizForm } from "@/components/forms/QuizForm";
import { Card } from "@/components/ui/Card";

export default function NewQuizPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Create Quiz" showBreadcrumbs />
      <Card>
        <QuizForm />
      </Card>
    </div>
  );
}
