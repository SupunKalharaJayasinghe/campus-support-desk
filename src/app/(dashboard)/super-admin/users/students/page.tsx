"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { UserStatusBadge } from "@/components/features/users/UserStatusBadge";

const students = [
  { id: "ST-1001", name: "Ariana Silva", program: "CS", year: 2, semester: 1, group: "A", status: "Active" },
  { id: "ST-1002", name: "Noah Kim", program: "IS", year: 2, semester: 1, group: "B", status: "Active" }
];

export default function StudentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage student records."
        showBreadcrumbs
        actions={
          <div className="flex gap-2">
            <Link href="/super-admin/users/students/new">
              <Button>Add Student</Button>
            </Link>
            <Button variant="outline">Bulk Import</Button>
          </div>
        }
      />
      <DataTable
        data={students}
        columns={[
          { key: "id", header: "Student ID" },
          { key: "name", header: "Name" },
          { key: "program", header: "Program" },
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
