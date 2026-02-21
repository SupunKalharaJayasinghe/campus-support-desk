import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { FileUpload } from "@/components/ui/FileUpload";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export default function AssessmentSubmitPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Submit Assessment" showBreadcrumbs />
      <Card>
        <form className="space-y-4">
          <Textarea label="Answer" placeholder="Type your response here..." />
          <FileUpload label="Upload Files" multiple helper="Max 5 files" />
          <Button type="submit">Submit</Button>
        </form>
      </Card>
    </div>
  );
}
