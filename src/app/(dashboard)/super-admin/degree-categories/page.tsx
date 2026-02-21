"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const data = [
  { id: "C-01", name: "Computing", code: "COMP", programs: 5, status: "Active" },
  { id: "C-02", name: "Engineering", code: "ENG", programs: 3, status: "Active" },
  { id: "C-03", name: "Business", code: "BUS", programs: 4, status: "Inactive" }
];

export default function DegreeCategoriesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Degree Categories"
        description="Manage academic degree categories."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/degree-categories/new">
            <Button>Add Category</Button>
          </Link>
        }
      />
      <DataTable
        data={data}
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "code", header: "Code", sortable: true },
          { key: "programs", header: "Programs Count" },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge variant={row.status === "Active" ? "success" : "error"}>
                {row.status}
              </Badge>
            )
          }
        ]}
        exportable
        rowActions={() => [{ label: "Edit", onClick: () => undefined }]}
      />
    </div>
  );
}
