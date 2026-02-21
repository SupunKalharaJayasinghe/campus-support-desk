import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { DegreeProgramForm } from "@/components/forms/DegreeProgramForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NewDegreeProgramPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Degree Program"
        description="Create a new degree program."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/degree-programs">
            <Button variant="outline">Back</Button>
          </Link>
        }
      />
      <Card>
        <DegreeProgramForm />
      </Card>
    </div>
  );
}
