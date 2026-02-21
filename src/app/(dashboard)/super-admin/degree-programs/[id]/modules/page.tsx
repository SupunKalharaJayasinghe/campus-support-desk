"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const modules = [
  { id: "M-201", name: "Data Structures", code: "CS204", year: 2, semester: 1, status: "Active" },
  { id: "M-310", name: "Database Systems", code: "CS310", year: 3, semester: 1, status: "Active" }
];

export default function ProgramModulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Modules"
        description="Modules for this degree program."
        showBreadcrumbs
        actions={<Button>Add Module</Button>}
      />
      <DataTable
        data={modules}
        columns={[
          { key: "name", header: "Name" },
          { key: "code", header: "Code" },
          { key: "year", header: "Year" },
          { key: "semester", header: "Semester" },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge variant={row.status === "Active" ? "success" : "warning"}>
                {row.status}
              </Badge>
            )
          }
        ]}
        rowActions={() => [{ label: "Edit", onClick: () => undefined }]}
      />
    </div>
  );
}
