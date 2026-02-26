"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const initialModules = [
  {
    id: "M-01",
    code: "CS101",
    name: "Introduction to Programming",
    credits: 3,
    degrees: "BSc Computer Science, BSc IS",
    year: "Y1S1",
    status: "Active"
  },
  {
    id: "M-02",
    code: "CS201",
    name: "Data Structures",
    credits: 4,
    degrees: "BSc Computer Science",
    year: "Y2S1",
    status: "Active"
  },
  {
    id: "M-03",
    code: "SE301",
    name: "Software Design",
    credits: 3,
    degrees: "BSc Software Engineering",
    year: "Y3S1",
    status: "Active"
  }
];

const yearOptions = [
  "Y1S1", "Y1S2",
  "Y2S1", "Y2S2",
  "Y3S1", "Y3S2",
  "Y4S1", "Y4S2"
];

export default function ModulesPage() {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);

  const handleEdit = (moduleId: string) => {
    router.push(`/super-admin/modules/${moduleId}/edit`);
  };

  const handleDelete = (moduleId: string) => {
    if (confirm("Are you sure you want to delete this module?")) {
      setModules(modules.filter(m => m.id !== moduleId));
      alert("Module deleted successfully");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Management"
        description="Manage modules, assign degrees and academic years."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/modules/new">
            <Button>Add Module</Button>
          </Link>
        }
      />
      <DataTable
        data={modules}
        columns={[
          { key: "code", header: "Code", sortable: true },
          { key: "name", header: "Module Name", sortable: true },
          { key: "credits", header: "Credits" },
          { key: "degrees", header: "Degrees" },
          { key: "year", header: "Year/Semester" },
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
