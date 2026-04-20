import { KeyRound, ShieldCheck, SlidersHorizontal, type LucideIcon } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

type SummaryTone = "sky" | "teal" | "amber" | "green" | "rose" | "violet";

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: SummaryTone;
}) {
  return (
    <Card accent className="admin-stat-card h-full p-5" data-tone={tone}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-heading">{value}</p>
        </div>
        <span className="admin-stat-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-current">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-4 text-xs text-text/60">{detail}</p>
    </Card>
  );
}

export default function RolesPermissionsPage() {
  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <Card accent className="p-6 lg:p-7">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="neutral">User Management</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                  Roles and permissions
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  Define admin and academic access rules with the same updated users
                  section visual language before the live RBAC workflows are connected.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[190px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Build Status
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                    In Progress
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    Core role templates and permission workflows are still being
                    assembled.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">Role templates, permission matrices, audit logs</Badge>
              <Badge variant="primary">Coming next</Badge>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryCard
            detail="Planned baseline roles include Admin, LIC, Lecturer, and Lab Assistant."
            icon={ShieldCheck}
            label="Role Templates"
            tone="sky"
            value="4"
          />
          <SummaryCard
            detail="Permission groups will map to academic, teaching, communication, and administration areas."
            icon={SlidersHorizontal}
            label="Permission Groups"
            tone="teal"
            value="Multi"
          />
          <SummaryCard
            detail="Sensitive changes will require tracked updates and review-friendly history."
            icon={KeyRound}
            label="Audit Coverage"
            tone="amber"
            value="Planned"
          />
          <SummaryCard
            detail="The page shell is ready for the live RBAC controls to be inserted here."
            icon={ShieldCheck}
            label="Section State"
            tone="violet"
            value="Scaffolded"
          />
        </div>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-6 py-5">
          <p className="text-lg font-semibold text-heading">Planned Workflows</p>
          <p className="mt-1 text-sm text-text/68">
            This section is ready for the same table and action surface used elsewhere
            in the updated admin users pages.
          </p>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-3">
          <Card accent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
              Scope
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-text/72">
              <li>Faculty, degree, intake, term, stream, subgroup visibility</li>
              <li>Route-level guards for admin user tools</li>
              <li>Role-aware navigation and action restrictions</li>
            </ul>
          </Card>

          <Card accent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
              Workflows
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-text/72">
              <li>Searchable role directory and assignment screens</li>
              <li>Granular module permissions per role or account</li>
              <li>Safer approval flow for sensitive permission changes</li>
            </ul>
          </Card>

          <Card accent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
              Highlights
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-text/72">
              <li>Role templates (Admin, LIC, Lecturer, LA)</li>
              <li>Fine-grained module permissions</li>
              <li>Permission change audit logs</li>
            </ul>
          </Card>
        </div>
      </Card>
    </div>
  );
}
