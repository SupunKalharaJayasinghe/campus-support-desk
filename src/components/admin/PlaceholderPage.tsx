import Card from "@/components/ui/Card";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/ui/Badge";

export default function PlaceholderPage({
  title,
  description,
  status = "Planned",
  highlights = [],
}: {
  title: string;
  description: string;
  status?: "Planned" | "In Progress" | "Ready";
  highlights?: string[];
}) {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={<Badge variant={status === "Ready" ? "success" : "neutral"}>{status}</Badge>}
        description={description}
        title={title}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card accent title="Scope">
          <ul className="admin-placeholder-list text-sm text-text/75">
            <li>Faculty, degree, intake, term, stream, subgroup</li>
            <li>Role-based visibility for navigation</li>
            <li>Enterprise-ready layout patterns</li>
          </ul>
        </Card>

        <Card title="Workflows">
          <ul className="admin-placeholder-list text-sm text-text/75">
            <li>Search + filters + pagination</li>
            <li>Add / Edit / Delete actions</li>
            <li>Audit-friendly, minimal UI</li>
          </ul>
        </Card>

        <Card title="Highlights">
          {highlights.length ? (
            <ul className="admin-placeholder-list text-sm text-text/75">
              {highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text/70">
              This section is scaffolded. Add backend integration and real data
              sources when ready.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

