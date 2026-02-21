"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { UserStatusBadge } from "@/components/features/users/UserStatusBadge";

const lecturers = [
  { id: "L-01", name: "Marcus Lee", email: "marcus@campus.edu", employeeId: "EMP-201", program: "CS", modules: 4, status: "Active" },
  { id: "L-02", name: "Amelia Tran", email: "amelia@campus.edu", employeeId: "EMP-202", program: "IS", modules: 3, status: "Active" }
];

export default function LecturersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lecturers"
        description="Manage lecturer accounts."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/users/lecturers/new">
            <Button>Add Lecturer</Button>
          </Link>
        }
      />
      <DataTable
        data={lecturers}
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          { key: "employeeId", header: "Employee ID" },
          { key: "program", header: "Program" },
          { key: "modules", header: "Modules Count" },
          {
            key: "status",
            header: "Status",
            render: (row) => <UserStatusBadge status={row.status} />
          }
        ]}
      />
    </div>
  );
}
