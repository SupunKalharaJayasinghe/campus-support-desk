"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/features/users/RoleBadge";
import { UserStatusBadge } from "@/components/features/users/UserStatusBadge";

const users = [
  { id: "U-01", name: "Nadine Okafor", role: "Department Admin", email: "nadine@campus.edu", status: "Active" },
  { id: "U-02", name: "Marcus Lee", role: "Lecturer", email: "marcus@campus.edu", status: "Active" },
  { id: "U-03", name: "Ariana Silva", role: "Student", email: "ariana@campus.edu", status: "Active" }
];

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage system users and roles."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/users/admins/new">
            <Button>Add User</Button>
          </Link>
        }
      />
      <Tabs
        items={[
          { id: "all", label: "All" },
          { id: "admins", label: "Admins" },
          { id: "lecturers", label: "Lecturers" },
          { id: "students", label: "Students" },
          { id: "lost", label: "Lost Item Staff" }
        ]}
      />
      <DataTable
        data={users}
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          {
            key: "role",
            header: "Role",
            render: (row) => <RoleBadge role={row.role} />
          },
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
