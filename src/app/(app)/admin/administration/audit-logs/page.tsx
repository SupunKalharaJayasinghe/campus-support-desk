import PlaceholderPage from "@/components/admin/PlaceholderPage";

export default function AuditLogsPage() {
  return (
    <PlaceholderPage
      description="Audit logs for critical actions across the LMS (users, grades, content, permissions)."
      highlights={[
        "Immutable append-only events",
        "Filtered exports by scope",
        "Actor, target, and diff summaries",
      ]}
      status="In Progress"
      title="Audit Logs"
    />
  );
}

