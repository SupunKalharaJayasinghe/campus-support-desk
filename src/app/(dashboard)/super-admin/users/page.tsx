"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/features/users/RoleBadge";
import { UserStatusBadge } from "@/components/features/users/UserStatusBadge";
import { useToast } from "@/hooks/useToast";
import type { UserRole, UserStatus } from "@/types/user";

type UserRow = {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  status: UserStatus;
};

const initialUsers: UserRow[] = [
  {
    id: "U-01",
    name: "Nadine Okafor",
    role: "Department Admin",
    email: "nadine@campus.edu",
    status: "Active"
  },
  {
    id: "U-02",
    name: "Marcus Lee",
    role: "Lecturer",
    email: "marcus@campus.edu",
    status: "Active"
  },
  {
    id: "U-03",
    name: "Ariana Silva",
    role: "Student",
    email: "ariana@campus.edu",
    status: "Active"
  }
];

export default function UsersPage() {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState(initialUsers);

  const handleEdit = (user: UserRow) => {
    const params = new URLSearchParams({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    });
    router.push(`/super-admin/users/${user.id}/edit?${params.toString()}`);
  };

  const handleDelete = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted successfully.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage system users and roles."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/users/new">
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
        rowActions={(row) => [
          { label: "Edit", onClick: () => handleEdit(row) },
          { label: "Delete", onClick: () => handleDelete(row.id) }
        ]}
      />
    </div>
  );
}
