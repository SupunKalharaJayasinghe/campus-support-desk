import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { DegreeCategoryForm } from "@/components/forms/DegreeCategoryForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NewDegreeCategoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Degree Category"
        description="Create a new degree category."
        showBreadcrumbs
        actions={
          <Link href="/super-admin/degree-categories">
            <Button variant="outline">Back</Button>
          </Link>
        }
      />
      <Card>
        <DegreeCategoryForm />
      </Card>
    </div>
  );
}
