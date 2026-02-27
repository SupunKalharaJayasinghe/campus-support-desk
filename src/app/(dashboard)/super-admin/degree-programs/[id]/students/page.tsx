"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { UserStatusBadge } from "@/components/features/users/UserStatusBadge";

const students = [
  { id: "S-01", name: "Ariana Silva", year: 2, semester: 1, group: "A", status: "Active" },
  { id: "S-02", name: "Noah Kim", year: 2, semester: 1, group: "B", status: "Active" }
];

export default function ProgramStudentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Students"
        description="Manage students enrolled in this program."
        showBreadcrumbs
        actions={<Button>Add Student</Button>}
      />
      <DataTable
        data={students}
        columns={[
          { key: "id", header: "Student ID" },
          { key: "name", header: "Name" },
          { key: "year", header: "Year" },
          { key: "semester", header: "Semester" },
          { key: "group", header: "Group" },
          {
            key: "status",
            header: "Status",
            render: (row) => <UserStatusBadge status={row.status} />
          }
        ]}
        selectable
      />
    </div>
  );
}
