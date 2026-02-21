"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { UserStatusBadge } from "@/components/features/users/UserStatusBadge";

const staff = [
  { id: "LI-01", name: "Gavin Cruz", email: "gavin@campus.edu", status: "Active" },
  { id: "LI-02", name: "Tessa Reed", email: "tessa@campus.edu", status: "Active" }
];

export default function LostItemStaffPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lost Item Staff"
        description="Manage lost & found staff members."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/users/lost-item-staff/new">
            <Button>Add Staff</Button>
          </Link>
        }
      />
      <DataTable
        data={staff}
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
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
