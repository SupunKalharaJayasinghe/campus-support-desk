import PlaceholderPage from "@/components/admin/PlaceholderPage";

export default function BulkImportPage() {
  return (
    <PlaceholderPage
      description="Bulk import users via CSV (students, lecturers, lab assistants) with validation."
      highlights={[
        "CSV mapping + schema validation",
        "Dry-run import with error export",
        "Bulk status updates and enrollments",
      ]}
      status="Planned"
      title="Bulk Import"
    />
  );
}

