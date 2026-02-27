"use client";

import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { DegreeProgramForm, type DegreeProgramFormValues } from "@/components/forms/DegreeProgramForm";

export default function EditDegreeProgramPage() {
  const router = useRouter();
  const params = useParams();
  const programId = params.id as string;

  const handleSubmit = async (data: DegreeProgramFormValues) => {
    try {
      // API call to update program
      console.log("Updating program:", programId, data);
      // await updateProgram(programId, data);
      router.push("/super-admin/degree-programs");
    } catch (error) {
      console.error("Error updating program:", error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Degree Program"
        description="Update degree program details."
        showBreadcrumbs
        backHref="/super-admin/degree-programs"
      />
      <Card title="Program Information">
        <DegreeProgramForm submitLabel="Update Program" onSubmit={handleSubmit} />
      </Card>
    </div>
  );
}
