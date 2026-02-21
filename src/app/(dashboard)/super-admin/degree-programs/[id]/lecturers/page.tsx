"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/features/users/RoleBadge";

const lecturers = [
  { id: "L-01", name: "Marcus Lee", email: "marcus.lee@campus.edu", role: "Coordinator" },
  { id: "L-02", name: "Amelia Tran", email: "amelia.tran@campus.edu", role: "Lecturer" }
];

export default function ProgramLecturersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Lecturers"
        description="Assigned lecturers for this program."
        showBreadcrumbs
        actions={<Button>Assign Lecturer</Button>}
      />
      <DataTable
        data={lecturers}
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          {
            key: "role",
            header: "Role",
            render: (row) => <RoleBadge role={row.role} />
          }
        ]}
        rowActions={() => [{ label: "Manage", onClick: () => undefined }]}
      />
    </div>
  );
}
