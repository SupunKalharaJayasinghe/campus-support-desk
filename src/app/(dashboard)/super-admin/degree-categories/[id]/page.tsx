import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";

export default function DegreeCategoryDetailsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Degree Category Details" showBreadcrumbs />
      <Card
        title="Computing"
        description="Category for computing-related programs."
        actions={<Badge variant="success">Active</Badge>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Code</p>
            <p className="text-sm font-medium text-slate-700">COMP</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Programs</p>
            <p className="text-sm font-medium text-slate-700">5</p>
          </div>
        </div>
      </Card>
      <Tabs
        items={[
          { id: "details", label: "Details" },
          { id: "programs", label: "Degree Programs" }
        ]}
      />
      <Card title="Programs">
        <p className="text-sm text-slate-600">
          Program list placeholder for this category.
        </p>
      </Card>
    </div>
  );
}
