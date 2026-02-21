import { PageHeader } from "@/components/shared/PageHeader";
import { ReportFilters } from "@/components/features/reports/ReportFilters";
import { ExportOptions } from "@/components/features/reports/ExportOptions";
import { Card } from "@/components/ui/Card";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate academic reports." showBreadcrumbs />
      <Card title="Report Filters">
        <ReportFilters />
      </Card>
      <Card title="Export Options">
        <ExportOptions />
      </Card>
    </div>
  );
}
