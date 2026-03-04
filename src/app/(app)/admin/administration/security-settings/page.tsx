import PlaceholderPage from "@/components/admin/PlaceholderPage";

export default function SecuritySettingsPage() {
  return (
    <PlaceholderPage
      description="Security policies for authentication, sessions, and privileged operations."
      highlights={[
        "Password policy & MFA",
        "Session timeouts and device rules",
        "Privileged action approvals",
      ]}
      status="Planned"
      title="Security Settings"
    />
  );
}

