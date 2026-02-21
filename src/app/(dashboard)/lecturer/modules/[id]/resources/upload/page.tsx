import { PageHeader } from "@/components/shared/PageHeader";
import { ResourceForm } from "@/components/forms/ResourceForm";
import { Card } from "@/components/ui/Card";

export default function ResourceUploadPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Upload Resource" showBreadcrumbs />
      <Card>
        <ResourceForm />
      </Card>
    </div>
  );
}
