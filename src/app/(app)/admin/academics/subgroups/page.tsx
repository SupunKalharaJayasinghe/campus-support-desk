import PlaceholderPage from "@/components/admin/PlaceholderPage";

export default function SubgroupsPage() {
  return (
    <PlaceholderPage
      description="Create subgroups (e.g., 1.1, 1.2) used for timetable, labs, and subgroup deadlines."
      highlights={[
        "Auto-generate subgroup sets per intake",
        "Assign subgroup coordinators",
        "Subgroup-level deadline overrides",
      ]}
      status="In Progress"
      title="Subgroups"
    />
  );
}

