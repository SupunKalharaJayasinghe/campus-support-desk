"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";

const batches = [
  { id: "B-2024", year: 2024, name: "2024 Intake", students: 120 },
  { id: "B-2025", year: 2025, name: "2025 Intake", students: 140 }
];

export default function ProgramBatchesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Batches"
        description="Manage batches and student intake."
        showBreadcrumbs
        actions={<Button>Add Batch</Button>}
      />
      <DataTable
        data={batches}
        columns={[
          { key: "year", header: "Year" },
          { key: "name", header: "Batch Name" },
          { key: "students", header: "Students" }
        ]}
      />
    </div>
  );
}
