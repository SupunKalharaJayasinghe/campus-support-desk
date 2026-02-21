import { PageHeader } from "@/components/shared/PageHeader";
import { ModuleForm } from "@/components/forms/ModuleForm";
import { Card } from "@/components/ui/Card";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Add Module" showBreadcrumbs />
      <Card>
        <ModuleForm />
      </Card>
    </div>
  );
}
