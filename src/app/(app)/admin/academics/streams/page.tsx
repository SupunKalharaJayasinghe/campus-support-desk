import {
  CalendarRange,
  Clock3,
  GitBranchPlus,
  Layers3,
  type LucideIcon,
} from "lucide-react";
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

export default function StreamsPage() {
  const highlights = [
    "Stream availability by intake and academic term",
    "Location and timetable constraints by stream",
    "Separate assessment calendars per stream",
  ];

  const plannedWorkflows = [
    "Define delivery stream records such as Weekday and Weekend.",
    "Attach streams to intakes, terms, and teaching availability rules.",
    "Support stream-specific scheduling and assessment boundaries.",
  ];

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <div className="flex justify-end">
        <Badge variant="neutral">Planned</Badge>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <Card accent className="p-6 lg:p-7">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="neutral">Academic Structure</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                  Stream management
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  Define delivery streams such as Weekday and Weekend and attach
                  stream-level scheduling constraints to the academic structure.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[210px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Planned Capabilities
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                    3
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    Stream setup, constraints, and term-scoped availability
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {highlights.map((item) => (
                <div
                  className="rounded-[22px] border border-border bg-white/72 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,41,0.04)]"
                  key={item}
                >
                  <p className="text-sm font-medium text-heading">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryCard
            detail="Default delivery patterns such as Weekday and Weekend."
            icon={Layers3}
            label="Stream Types"
            tone="violet"
            value="2"
          />
          <SummaryCard
            detail="Streams are expected to be scoped to academic terms."
            icon={CalendarRange}
            label="Term Scoped"
            tone="green"
            value="Yes"
          />
          <SummaryCard
            detail="Availability, location, and assessment windows can be layered per stream."
            icon={GitBranchPlus}
            label="Constraint Layers"
            tone="amber"
            value="3"
          />
          <SummaryCard
            detail="This section is visually aligned and ready for future data wiring."
            icon={Clock3}
            label="Build State"
            tone="sky"
            value="Planned"
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
        <Card className="p-6 lg:p-7">
          <p className="text-lg font-semibold text-heading">Planned Stream Workflows</p>
          <p className="mt-1 text-sm text-text/68">
            This page does not have backend-driven records yet, but the UI now matches
            the updated admin surface used across other academic setup pages.
          </p>

          <div className="mt-5 space-y-3">
            {plannedWorkflows.map((item) => (
              <div
                className="rounded-[22px] border border-border bg-white/76 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,41,0.04)]"
                key={item}
              >
                <p className="text-sm font-medium text-heading">{item}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card accent className="p-6 lg:p-7">
          <Badge variant="neutral">Implementation Notes</Badge>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
            Ready for the next step
          </p>
          <p className="mt-2 text-sm leading-6 text-text/68">
            The page now follows the same visual language as Faculties, Degree
            Programs, Intakes, Academic Terms, and the updated admin dashboard. When
            stream APIs are ready, this surface can be extended with filters, records,
            and edit flows without another design reset.
          </p>
        </Card>
      </section>
    </div>
  );
}
