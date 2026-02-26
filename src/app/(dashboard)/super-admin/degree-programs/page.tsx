"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const programs = [
  {
    id: "P-01",
    name: "BSc Computer Science",
    code: "CS",
    category: "Computing",
    duration: 4,
    students: 420,
    lecturers: 24,
    status: "Active"
  },
  {
    id: "P-02",
    name: "BSc Information Systems",
    code: "IS",
    category: "Computing",
    duration: 4,
    students: 300,
    lecturers: 18,
    status: "Active"
  },
  {
    id: "P-03",
    name: "BSc Software Engineering",
    code: "SE",
    category: "Engineering",
    duration: 4,
    students: 260,
    lecturers: 14,
    status: "Inactive"
  }
];

export default function DegreeProgramsPage() {
  const router = useRouter();
  const [programsData, setProgramsData] = useState(programs);

  const handleEdit = (id: string) => {
    router.push(`/super-admin/degree-programs/${id}/edit`);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this program?")) {
      setProgramsData(programsData.filter(p => p.id !== id));
      alert("Program deleted successfully");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Degree Programs"
        description="Manage degree programs and enrollments."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/degree-programs/new">
            <Button>Add Program</Button>
          </Link>
        }
      />
      <DataTable
        data={programsData}
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "code", header: "Code", sortable: true },
          { key: "category", header: "Category" },
          { key: "duration", header: "Duration" },
          { key: "students", header: "Students" },
          { key: "lecturers", header: "Lecturers" },
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
        rowActions={(row) => [
          { label: "Edit", onClick: () => handleEdit(row.id) },
          { label: "Delete", onClick: () => handleDelete(row.id) }
        ]}
      />
    </div>
  );
}
