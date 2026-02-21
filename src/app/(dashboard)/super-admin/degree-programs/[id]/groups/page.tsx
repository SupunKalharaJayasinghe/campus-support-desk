import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ProgramGroupsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups & Sub-groups"
        description="Manage student groups and sub-groups."
        showBreadcrumbs
        actions={<Button>Add Group</Button>}
      />
      <Card title="Groups">
        <p className="text-sm text-slate-600">
          Group list placeholder with expandable sub-groups.
        </p>
      </Card>
    </div>
  );
}
