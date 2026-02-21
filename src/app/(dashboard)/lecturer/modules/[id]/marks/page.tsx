import { PageHeader } from "@/components/shared/PageHeader";
import { GradeSubmissionForm } from "@/components/forms/GradeSubmissionForm";
import { Card } from "@/components/ui/Card";

export default function ModuleMarksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Marks Entry" showBreadcrumbs />
      <Card title="Grade Submission">
        <GradeSubmissionForm />
      </Card>
    </div>
  );
}
