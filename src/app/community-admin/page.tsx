"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Eye, Flag, ShieldCheck, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

type MemberRole = "Student" | "Lecturer" | "Moderator" | "Alumni";
type MemberStatus = "Active" | "Warned" | "Suspended";
type ReportStatus = "Open" | "Investigating" | "Resolved";
type ReportPriority = "High" | "Medium" | "Low";

interface CommunityMember {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
  contributions: number;
  status: MemberStatus;
}

interface ReportedPost {
  id: string;
  reportedBy: string;
  postAuthor: string;
  category: "academic_question" | "study_material" | "lost_item";
  reason: string;
  reportedAt: string;
  priority: ReportPriority;
  status: ReportStatus;
  postTitle: string;
  postSummary: string;
}

const MEMBERS: CommunityMember[] = [
  {
    id: "M-1001",
    name: "Nethmi Fernando",
    email: "nethmi.fernando@unihub.edu",
    role: "Student",
    joinedAt: "2025-10-01",
    contributions: 34,
    status: "Active",
  },
  {
    id: "M-1002",
    name: "Kavindu Silva",
    email: "kavindu.silva@unihub.edu",
    role: "Student",
    joinedAt: "2025-09-12",
    contributions: 12,
    status: "Warned",
  },
  {
    id: "M-1003",
    name: "Dr. A. Wickramasinghe",
    email: "a.wickramasinghe@unihub.edu",
    role: "Lecturer",
    joinedAt: "2025-07-22",
    contributions: 51,
    status: "Active",
  },
  {
    id: "M-1004",
    name: "Ravindu Perera",
    email: "ravindu.perera@unihub.edu",
    role: "Moderator",
    joinedAt: "2025-05-17",
    contributions: 140,
    status: "Active",
  },
  {
    id: "M-1005",
    name: "Malshi Gunasekara",
    email: "malshi.g@unihub.edu",
    role: "Alumni",
    joinedAt: "2025-03-08",
    contributions: 22,
    status: "Suspended",
  },
];

const INITIAL_REPORTS: ReportedPost[] = [
  {
    id: "RP-901",
    reportedBy: "IT23104567",
    postAuthor: "IT23107112",
    category: "study_material",
    reason: "Contains external paid link and misleading title",
    reportedAt: "2026-03-24 08:45",
    priority: "High",
    status: "Open",
    postTitle: "Free assignment answers for SE module",
    postSummary:
      "Post shares an off-platform payment link claiming guaranteed final answers.",
  },
  {
    id: "RP-902",
    reportedBy: "Sara Liyanage",
    postAuthor: "K.D. Jayasekara",
    category: "academic_question",
    reason: "Harassment in comments",
    reportedAt: "2026-03-23 16:30",
    priority: "Medium",
    status: "Investigating",
    postTitle: "Need help with DBMS project",
    postSummary:
      "Thread started as a genuine question, later received insulting replies from multiple users.",
  },
  {
    id: "RP-903",
    reportedBy: "IT23109821",
    postAuthor: "IT23109345",
    category: "lost_item",
    reason: "Possible fake item ownership claim",
    reportedAt: "2026-03-22 14:10",
    priority: "Low",
    status: "Resolved",
    postTitle: "Lost laptop near library",
    postSummary:
      "Reporter says details in comments do not match the actual owner information.",
  },
];

const SECTION_LINKS = [
  { id: "overview", label: "Overview" },
  { id: "filters", label: "Filters" },
  { id: "members", label: "Community Members" },
  { id: "reports", label: "Reported Posts" },
  { id: "report-details", label: "Report Details" },
];

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function memberStatusVariant(status: MemberStatus) {
  if (status === "Active") return "success" as const;
  if (status === "Warned") return "warning" as const;
  return "danger" as const;
}

function reportStatusVariant(status: ReportStatus) {
  if (status === "Resolved") return "success" as const;
  if (status === "Investigating") return "warning" as const;
  return "danger" as const;
}

function priorityVariant(priority: ReportPriority) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "info" as const;
}

function categoryLabel(value: ReportedPost["category"]) {
  if (value === "academic_question") return "Academic Question";
  if (value === "study_material") return "Study Material";
  return "Lost Item";
}

export default function CommunityAdminPage() {
  const [reports, setReports] = useState<ReportedPost[]>(INITIAL_REPORTS);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState<"" | MemberRole>("");
  const [reportStatusFilter, setReportStatusFilter] = useState<"" | ReportStatus>("");
  const [selectedReportId, setSelectedReportId] = useState<string>(INITIAL_REPORTS[0]?.id ?? "");

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return MEMBERS.filter((member) => {
      const matchesQuery =
        !query ||
        `${member.name} ${member.email} ${member.id}`.toLowerCase().includes(query);
      const matchesRole = !memberRoleFilter || member.role === memberRoleFilter;
      return matchesQuery && matchesRole;
    });
  }, [memberRoleFilter, memberSearch]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (!reportStatusFilter) return true;
      return report.status === reportStatusFilter;
    });
  }, [reportStatusFilter, reports]);

  const selectedReport =
    filteredReports.find((report) => report.id === selectedReportId) ?? filteredReports[0] ?? null;

  const openReportCount = reports.filter((report) => report.status === "Open").length;

  const updateReportStatus = (id: string, nextStatus: ReportStatus) => {
    setReports((previous) =>
      previous.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
    );
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="xl:sticky xl:top-5 xl:h-fit">
        <Card
          title="Sections"
          description="Jump to each admin area."
          className="rounded-2xl p-4"
        >
          <nav aria-label="Community admin sections" className="space-y-1.5">
            {SECTION_LINKS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block rounded-xl border border-border bg-card px-3 py-2 text-sm text-text/80 transition-colors hover:bg-tint hover:text-heading whitespace-nowrap"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </Card>
      </aside>

      <div className="space-y-6 lg:space-y-8">
        <PageHeader
          title="Community Admin"
          description="Monitor members, inspect reported posts, and manage moderation actions from one place."
          actions={
            <Button className="gap-2" variant="secondary">
              <ShieldCheck size={16} />
              Moderation Rules
            </Button>
          }
        />

        <section id="overview" className="scroll-mt-24 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card accent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text/72">Total Members</p>
                <p className="mt-2 text-2xl font-semibold text-heading">{MEMBERS.length}</p>
              </div>
              <span className="rounded-2xl bg-primary/10 p-2 text-primary">
                <Users size={18} />
              </span>
            </div>
          </Card>

          <Card accent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text/72">Reported Posts</p>
                <p className="mt-2 text-2xl font-semibold text-heading">{reports.length}</p>
              </div>
              <span className="rounded-2xl bg-primary/10 p-2 text-primary">
                <Flag size={18} />
              </span>
            </div>
          </Card>

          <Card accent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text/72">Open Reports</p>
                <p className="mt-2 text-2xl font-semibold text-heading">{openReportCount}</p>
              </div>
              <span className="rounded-2xl bg-primary/10 p-2 text-primary">
                <AlertTriangle size={18} />
              </span>
            </div>
          </Card>

          <Card accent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text/72">Resolved Today</p>
                <p className="mt-2 text-2xl font-semibold text-heading">
                  {reports.filter((report) => report.status === "Resolved").length}
                </p>
              </div>
              <span className="rounded-2xl bg-primary/10 p-2 text-primary">
                <Eye size={18} />
              </span>
            </div>
          </Card>
        </section>

        <section id="filters" className="scroll-mt-24">
          <Card title="Filters" description="Quickly narrow members and report queues.">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Search member by name, email, or ID"
              />
              <Select
                value={memberRoleFilter}
                onChange={(event) => setMemberRoleFilter(event.target.value as "" | MemberRole)}
              >
                <option value="">All Member Roles</option>
                <option value="Student">Student</option>
                <option value="Lecturer">Lecturer</option>
                <option value="Moderator">Moderator</option>
                <option value="Alumni">Alumni</option>
              </Select>
              <Select
                value={reportStatusFilter}
                onChange={(event) => setReportStatusFilter(event.target.value as "" | ReportStatus)}
              >
                <option value="">All Report Status</option>
                <option value="Open">Open</option>
                <option value="Investigating">Investigating</option>
                <option value="Resolved">Resolved</option>
              </Select>
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-12">
          <Card
            id="members"
            className="scroll-mt-24 xl:col-span-7"
            title="Community Members"
            description="All current members visible to community administration."
          >
            {filteredMembers.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-tint px-4 py-8 text-center text-sm text-text/70">
                No members match the current filters.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[740px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text/70">
                      <th className="px-2 py-2.5 font-medium">Member</th>
                      <th className="px-2 py-2.5 font-medium">Role</th>
                      <th className="px-2 py-2.5 font-medium">Joined</th>
                      <th className="px-2 py-2.5 font-medium">Posts/Replies</th>
                      <th className="px-2 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr className="border-b border-border/70" key={member.id}>
                        <td className="px-2 py-3 align-top">
                          <p className="font-medium text-heading">{member.name}</p>
                          <p className="text-xs text-text/70">{member.email}</p>
                          <p className="text-xs text-text/60">{member.id}</p>
                        </td>
                        <td className="px-2 py-3 align-top text-text/85">{member.role}</td>
                        <td className="px-2 py-3 align-top text-text/85">{member.joinedAt}</td>
                        <td className="px-2 py-3 align-top text-text/85">{member.contributions}</td>
                        <td className="px-2 py-3 align-top">
                          <Badge variant={memberStatusVariant(member.status)}>{member.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            id="reports"
            className="scroll-mt-24 xl:col-span-5"
            title="Reported Posts"
            description="Click a report to inspect full details."
          >
            {filteredReports.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-tint px-4 py-8 text-center text-sm text-text/70">
                No reports found for this status.
              </p>
            ) : (
              <div className="space-y-2.5">
                {filteredReports.map((report) => {
                  const active = selectedReport?.id === report.id;

                  return (
                    <button
                      className={cn(
                        "w-full rounded-2xl border px-3.5 py-3 text-left transition-colors",
                        active
                          ? "border-primary/35 bg-primary/10"
                          : "border-border bg-card hover:bg-tint"
                      )}
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      type="button"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-heading">{report.id}</p>
                        <Badge variant={priorityVariant(report.priority)}>{report.priority}</Badge>
                        <Badge variant={reportStatusVariant(report.status)}>{report.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-heading">{report.postTitle}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-text/72">{report.reason}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        <Card
          id="report-details"
          className="scroll-mt-24"
          title="Reported Post Details"
          description="Review evidence and apply moderation decision."
        >
          {selectedReport ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border bg-tint px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text/60">Report ID</p>
                  <p className="mt-1 text-sm font-semibold text-heading">{selectedReport.id}</p>
                </div>
                <div className="rounded-2xl border border-border bg-tint px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text/60">Reported By</p>
                  <p className="mt-1 text-sm font-semibold text-heading">{selectedReport.reportedBy}</p>
                </div>
                <div className="rounded-2xl border border-border bg-tint px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text/60">Post Author</p>
                  <p className="mt-1 text-sm font-semibold text-heading">{selectedReport.postAuthor}</p>
                </div>
                <div className="rounded-2xl border border-border bg-tint px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text/60">Category</p>
                  <p className="mt-1 text-sm font-semibold text-heading">
                    {categoryLabel(selectedReport.category)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-tint px-4 py-4">
                <p className="text-xs uppercase tracking-[0.08em] text-text/60">Reason</p>
                <p className="mt-1 text-sm leading-6 text-heading">{selectedReport.reason}</p>

                <p className="mt-4 text-xs uppercase tracking-[0.08em] text-text/60">Post Summary</p>
                <p className="mt-1 text-sm leading-6 text-text/85">{selectedReport.postSummary}</p>

                <p className="mt-4 text-xs uppercase tracking-[0.08em] text-text/60">Reported At</p>
                <p className="mt-1 text-sm text-text/85">{selectedReport.reportedAt}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="h-10"
                  disabled={selectedReport.status === "Investigating"}
                  onClick={() => updateReportStatus(selectedReport.id, "Investigating")}
                  variant="secondary"
                >
                  Mark Investigating
                </Button>
                <Button
                  className="h-10"
                  disabled={selectedReport.status === "Resolved"}
                  onClick={() => updateReportStatus(selectedReport.id, "Resolved")}
                >
                  Resolve Report
                </Button>
                <Button
                  className="h-10"
                  disabled={selectedReport.status === "Open"}
                  onClick={() => updateReportStatus(selectedReport.id, "Open")}
                  variant="ghost"
                >
                  Reopen
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-tint px-4 py-8 text-center text-sm text-text/70">
              Select a report from the right panel to view full details.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
