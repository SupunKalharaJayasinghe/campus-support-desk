import { PageHeader } from "@/components/shared/PageHeader";
import { AnnouncementForm } from "@/components/forms/AnnouncementForm";
import { Card } from "@/components/ui/Card";

export default function NewAnnouncementPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Create Announcement" showBreadcrumbs />
      <Card>
        <AnnouncementForm />
      </Card>
    </div>
  );
}
