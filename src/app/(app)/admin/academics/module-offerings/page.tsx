"use client";

import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Search,
  Users,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useAdminContext } from "@/components/admin/AdminContext";

type OfferingStatus = "Draft" | "Published";
type PageSize = 10 | 25 | 50 | 100;

interface ModuleOffering {
  id: string;
  moduleCode: string;
  moduleTitle: string;
  term: string;
  intake: string;
  stream: string;
  subgroups: string[];
  lic: string;
  lecturer: string;
  labAssistant: string;
  location: string;
  schedule: string;
  enrolled: number;
  capacity: number;
  status: OfferingStatus;
}

const OFFERINGS_SEED: ModuleOffering[] = [
  {
    id: "off-SE101-Y1S1-WD",
    moduleCode: "SE101",
    moduleTitle: "Programming Fundamentals",
    term: "Y1S1",
    intake: "2026 June",
    stream: "Weekday",
    subgroups: ["1.1", "1.2", "1.3"],
    lic: "Dr. Liam Harper",
    lecturer: "Ms. Ruvini Silva",
    labAssistant: "LA: Nuwan Perera",
    location: "Lab A-12",
    schedule: "Tue • 09:00 – 11:00",
    enrolled: 126,
    capacity: 150,
    status: "Published",
  },
  {
    id: "off-SE102-Y1S1-WD",
    moduleCode: "SE102",
    moduleTitle: "Discrete Mathematics",
    term: "Y1S1",
    intake: "2026 June",
    stream: "Weekday",
    subgroups: ["1.1", "1.2", "1.3"],
    lic: "Prof. Ayesha Fernando",
    lecturer: "Mr. Sahan Rodrigo",
    labAssistant: "—",
    location: "Hall C-03",
    schedule: "Thu • 13:00 – 15:00",
    enrolled: 118,
    capacity: 160,
    status: "Published",
  },
  {
    id: "off-SE201-Y2S1-WE",
    moduleCode: "SE201",
    moduleTitle: "Database Systems",
    term: "Y2S1",
    intake: "2026 October",
    stream: "Weekend",
    subgroups: ["2.1", "2.2"],
    lic: "Dr. Kavindu Sen",
    lecturer: "Dr. Kavindu Sen",
    labAssistant: "LA: Sachi Perera",
    location: "Lab B-06",
    schedule: "Sat • 10:00 – 12:00",
    enrolled: 72,
    capacity: 90,
    status: "Draft",
  },
  {
    id: "off-CS105-Y1S2-WD",
    moduleCode: "CS105",
    moduleTitle: "Computer Systems & Networks",
    term: "Y1S2",
    intake: "2027 February",
    stream: "Weekday",
    subgroups: ["1.1", "1.2"],
    lic: "Dr. Nirosha Jayasinghe",
    lecturer: "Mr. Chamath Perera",
    labAssistant: "LA: Thilini Dias",
    location: "Lab C-01",
    schedule: "Mon • 14:00 – 16:00",
    enrolled: 64,
    capacity: 120,
    status: "Draft",
  },
];

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function statusBadgeVariant(status: OfferingStatus) {
  return status === "Published" ? "success" : "neutral";
}

export default function ModuleOfferingsPage() {
  const { scope } = useAdminContext();
  const [items] = useState<ModuleOffering[]>(OFFERINGS_SEED);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | OfferingStatus>("");
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => item.term === scope.term && item.stream === scope.stream)
      .filter((item) => (statusFilter ? item.status === statusFilter : true))
      .filter((item) => {
        if (!query) return true;
        const target = `${item.moduleCode} ${item.moduleTitle} ${item.lic} ${item.location}`.toLowerCase();
        return target.includes(query);
      });
  }, [items, scope.stream, scope.term, searchQuery, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const safePage = Math.min(page, pageCount);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleItems.slice(start, start + pageSize);
  }, [pageSize, safePage, visibleItems]);

  const selected = pagedItems.find((item) => item.id === selectedId) ?? pagedItems[0] ?? null;

  const publishedCount = visibleItems.filter((item) => item.status === "Published").length;
  const draftCount = visibleItems.filter((item) => item.status === "Draft").length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <>
            <Button variant="secondary">Add Offering</Button>
            <Button className="gap-2">
              <CheckCircle2 size={16} />
              Publish Updates
            </Button>
          </>
        }
        description="Create offerings for modules and assign teaching staff, locations, and subgroup schedules."
        title="Module Offerings"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <span>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                Visible offerings
              </p>
              <p className="mt-2 text-3xl font-semibold text-heading">{visibleItems.length}</p>
            </span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpenCheck size={18} />
            </span>
          </div>
          <p className="mt-2 text-sm text-text/70">
            Filtered by {scope.term} • {scope.stream}.
          </p>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <span>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                Published
              </p>
              <p className="mt-2 text-3xl font-semibold text-heading">{publishedCount}</p>
            </span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <p className="mt-2 text-sm text-text/70">Offerings visible to students.</p>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <span>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                Draft
              </p>
              <p className="mt-2 text-3xl font-semibold text-heading">{draftCount}</p>
            </span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 text-text/75">
              <CalendarDays size={18} />
            </span>
          </div>
          <p className="mt-2 text-sm text-text/70">Pending staff/time allocation.</p>
        </Card>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 shadow-shadow sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text/55" size={16} />
            <Input
              className="pl-9"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search module code, title, staff, or location…"
              value={searchQuery}
            />
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-[200px_220px]">
            <Select
              aria-label="Status filter"
              onChange={(event) => {
                setStatusFilter(event.target.value as "" | OfferingStatus);
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All statuses</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
            </Select>
            <div className="rounded-2xl border border-border bg-tint px-3.5 py-2.5 text-sm text-text/75">
              Scope: {scope.faculty} / {scope.degree} / {scope.intake}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="overflow-hidden rounded-3xl border border-border bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[780px] w-full border-collapse">
                <thead className="bg-tint text-left text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                  <tr>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">LIC</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedItems.map((item) => {
                    const isActive = selected?.id === item.id;
                    return (
                      <tr
                        className={cn(
                          "cursor-pointer transition-colors",
                          isActive ? "bg-primary/6" : "hover:bg-tint/60"
                        )}
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-heading">{item.moduleCode}</p>
                          <p className="mt-1 text-sm text-text/72">{item.moduleTitle}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-text/75">
                          {item.schedule}
                          <p className="mt-1 text-xs text-text/60">{item.location}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-text/75">{item.lic}</td>
                        <td className="px-4 py-4">
                          <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedItems.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-sm text-text/70" colSpan={4}>
                        No offerings match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <TablePagination
                className="mt-4 border-t-0 pt-0"
                onPageChange={setPage}
                onPageSizeChange={(value) => {
                  setPageSize(value as PageSize);
                  setPage(1);
                }}
                page={safePage}
                pageCount={pageCount}
                pageSize={pageSize}
                totalItems={visibleItems.length}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-white p-5 shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
            {selected ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                      Selected offering
                    </p>
                    <p className="mt-1 text-xl font-semibold text-heading">
                      {selected.moduleCode} — {selected.moduleTitle}
                    </p>
                    <p className="mt-1 text-sm text-text/72">
                      {selected.intake} • {selected.term} • {selected.stream}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(selected.status)}>{selected.status}</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-tint p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                      Teaching staff
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-text/80">
                      <p>
                        <span className="font-semibold text-heading">LIC:</span> {selected.lic}
                      </p>
                      <p>
                        <span className="font-semibold text-heading">Lecturer:</span>{" "}
                        {selected.lecturer}
                      </p>
                      <p>
                        <span className="font-semibold text-heading">Lab:</span> {selected.labAssistant}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-tint p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                      Enrollment
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-heading">
                      {selected.enrolled}/{selected.capacity}
                    </p>
                    <div className="mt-2 h-2 rounded-full bg-black/10">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((selected.enrolled / selected.capacity) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-text/60">Capacity planning for selected scope.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Subgroups
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.subgroups.map((item) => (
                      <span
                        className="rounded-full border border-border bg-tint px-2.5 py-1 text-xs font-semibold text-text/70"
                        key={item}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button className="gap-2" variant="secondary">
                    <GraduationCap size={16} />
                    Assign Staff
                  </Button>
                  <Button className="gap-2" variant="secondary">
                    <CalendarDays size={16} />
                    Edit Schedule
                  </Button>
                  <Button className="gap-2">
                    <Users size={16} />
                    View Enrollments
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text/70">Select an offering to view details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
