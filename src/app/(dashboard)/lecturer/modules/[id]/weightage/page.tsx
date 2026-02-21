import { PageHeader } from "@/components/shared/PageHeader";
import { ModuleWeightageForm } from "@/components/forms/ModuleWeightageForm";
import { Card } from "@/components/ui/Card";

export default function ModuleWeightagePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Module Weightage" showBreadcrumbs />
      <Card>
        <ModuleWeightageForm />
      </Card>
    </div>
  );
}
