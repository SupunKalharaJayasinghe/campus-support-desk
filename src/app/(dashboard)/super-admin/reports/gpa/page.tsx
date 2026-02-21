import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProgramReport } from "@/components/features/reports/ProgramReport";

export default function GPAReportPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="GPA Report" description="Program-wise GPA statistics." showBreadcrumbs />
      <Card title="GPA Overview">
        <ProgramReport />
      </Card>
    </div>
  );
}
