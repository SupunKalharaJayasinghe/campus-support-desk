import { FileSpreadsheet, UploadCloud, UsersRound, type LucideIcon } from "lucide-react";
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

export default function BulkImportPage() {
  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <Card accent className="p-6 lg:p-7">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="neutral">User Management</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                  Bulk import workspace
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  Prepare CSV-based student, lecturer, and lab assistant imports with
                  the same updated admin users layout before the live import pipeline is
                  connected.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[190px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Section Status
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                    Planned
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    Import validation and execution steps are scaffolded for future
                    rollout.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">CSV mapping, validation, dry runs, error export</Badge>
              <Badge variant="primary">Scaffold ready</Badge>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryCard
            detail="Import flows will cover students, lecturers, lab assistants, and future admin account batches."
            icon={UsersRound}
            label="Target Directories"
            tone="sky"
            value="3+"
          />
          <SummaryCard
            detail="CSV templates and field mapping will align to the live user APIs and validation rules."
            icon={FileSpreadsheet}
            label="CSV Templates"
            tone="teal"
            value="Planned"
          />
          <SummaryCard
            detail="Dry-run validation will identify row-level issues before records are committed."
            icon={UploadCloud}
            label="Import Safety"
            tone="amber"
            value="Dry Run"
          />
          <SummaryCard
            detail="Error exports and corrective review screens will fit into this same updated surface."
            icon={FileSpreadsheet}
            label="Review Output"
            tone="violet"
            value="CSV"
          />
        </div>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-6 py-5">
          <p className="text-lg font-semibold text-heading">Planned Import Flow</p>
          <p className="mt-1 text-sm text-text/68">
            This page is staged to become the import control center for the admin users
            section.
          </p>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-3">
          <Card accent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
              Preparation
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-text/72">
              <li>Download CSV templates for each user directory</li>
              <li>Map fields to student, lecturer, and assistant schemas</li>
              <li>Check required identity and status fields before upload</li>
            </ul>
          </Card>

          <Card accent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
              Validation
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-text/72">
              <li>Schema validation with row-level feedback</li>
              <li>Duplicate checks against existing user records</li>
              <li>Dry-run summaries before committing changes</li>
            </ul>
          </Card>

          <Card accent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
              Operations
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-text/72">
              <li>Bulk status updates and enrollment-aware imports</li>
              <li>Error export files for failed rows</li>
              <li>Audit-friendly import history and traceability</li>
            </ul>
          </Card>
        </div>
      </Card>
    </div>
  );
}
