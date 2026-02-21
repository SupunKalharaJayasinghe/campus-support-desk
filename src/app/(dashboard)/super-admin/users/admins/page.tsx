"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { UserStatusBadge } from "@/components/features/users/UserStatusBadge";

const admins = [
  { id: "A-01", name: "Nadine Okafor", programs: "CS, IS", status: "Active" },
  { id: "A-02", name: "Ravi Patel", programs: "SE", status: "Active" }
];

export default function AdminsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admins"
        description="Manage admin accounts."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/users/admins/new">
            <Button>Add Admin</Button>
          </Link>
        }
      />
      <DataTable
        data={admins}
        columns={[
          { key: "name", header: "Name" },
          { key: "programs", header: "Assigned Programs" },
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
