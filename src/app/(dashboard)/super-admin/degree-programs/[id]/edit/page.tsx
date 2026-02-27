"use client";

import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import DegreeProgramForm from "@/components/forms/DegreeProgramForm";

export default function EditDegreeProgramPage() {
  const router = useRouter();
  const params = useParams();
  const programId = params.id as string;
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      // API call to update program
      console.log("Updating program:", programId, data);
      // await updateProgram(programId, data);
      router.push("/super-admin/degree-programs");
    } catch (error) {
      console.error("Error updating program:", error);
    } finally {
      setIsLoading(false);
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
        <DegreeProgramForm onSubmit={handleSubmit} isLoading={isLoading} />
      </Card>
    </div>
  );
}
