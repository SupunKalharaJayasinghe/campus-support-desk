"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, Flag, LogOut, ShieldCheck, Users } from "lucide-react";
import { clearDemoSession, isDemoModeEnabled } from "@/lib/rbac";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

type MemberStatus = "Active" | "Warned" | "Suspended";
type ReportStatus = "OPEN" | "REVIEWED" | "DISMISSED";
type ReportPriority = "High" | "Medium" | "Low";

interface CommunityMember {
  id: string;
  name: string;
  email: string;
  role: "Student";
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
  updatedAt: string;
}

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
  if (status === "REVIEWED") return "success" as const;
  if (status === "DISMISSED") return "warning" as const;
  return "danger" as const;
}

function reportStatusLabel(status: ReportStatus) {
  if (status === "OPEN") return "Open";
  if (status === "REVIEWED") return "Reviewed";
  return "Dismissed";
}

function priorityVariant(priority: ReportPriority) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "info" as const;
}

function priorityFromReasonKey(reasonKey: string): ReportPriority {
  if (reasonKey === "harassment") return "High";
  if (reasonKey === "inappropriate" || reasonKey === "misinformation") return "Medium";
  return "Low";
}

function formatReportedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso || "—";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isClosedToday(iso: string) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function mapApiReportToRow(raw: unknown): ReportedPost | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = String(r._id ?? "").trim();
  if (!id) return null;

  const post = r.postId;
  let postTitle = "";
  let postSummary = "";
  let category: ReportedPost["category"] = "academic_question";
  let postAuthor = "Unknown";

  if (post && typeof post === "object" && !Array.isArray(post)) {
    const p = post as Record<string, unknown>;
    postTitle = String(p.title ?? "").trim();
    postSummary = String(p.description ?? "").trim();
    const cat = String(p.category ?? "");
    if (cat === "lost_item" || cat === "study_material" || cat === "academic_question") {
      category = cat;
    }
    postAuthor = String(p.authorDisplayName ?? "").trim() || "Unknown";
  }

  const reporter = r.userId;
  let reportedBy = "Unknown";
  if (reporter && typeof reporter === "object" && !Array.isArray(reporter)) {
    const u = reporter as Record<string, unknown>;
    reportedBy =
      String(u.username ?? "").trim() ||
      String(u.email ?? "").trim() ||
      "Unknown";
  }

  const statusRaw = String(r.status ?? "OPEN").toUpperCase();
  const status: ReportStatus =
    statusRaw === "REVIEWED" || statusRaw === "DISMISSED" || statusRaw === "OPEN"
      ? statusRaw
      : "OPEN";

  const reasonKey = typeof r.reasonKey === "string" ? r.reasonKey : "";
  const priority = priorityFromReasonKey(reasonKey);

  const reason = String(r.reason ?? "").trim();
  const details = typeof r.details === "string" ? r.details.trim() : "";
  const reasonText =
    details && reason && !reason.includes(details)
      ? `${reason}\n${details}`
      : reason || details || "—";

  const createdRaw = r.createdAt;
  const updatedRaw = r.updatedAt;
  const createdIso =
    createdRaw instanceof Date
      ? createdRaw.toISOString()
      : typeof createdRaw === "string"
        ? createdRaw
        : "";
  const updatedIso =
    updatedRaw instanceof Date
      ? updatedRaw.toISOString()
      : typeof updatedRaw === "string"
        ? updatedRaw
        : "";

  return {
    id,
    reportedBy,
    postAuthor,
    category,
    reason: reasonText,
    reportedAt: formatReportedAt(createdIso),
    priority,
    status,
    postTitle: postTitle || "—",
    postSummary: postSummary || "—",
    updatedAt: updatedIso,
  };
}

function categoryLabel(value: ReportedPost["category"]) {
  if (value === "academic_question") return "Academic Question";
  if (value === "study_material") return "Study Material";
  return "Lost Item";
}

function reportListLabel(mongoId: string) {
  const tail = mongoId.replace(/\s/g, "").slice(-6).toUpperCase();
  return tail.length >= 4 ? `RPT-${tail}` : mongoId;
}

export default function CommunityAdminPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportedPost[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState<"" | ReportStatus>("");
  const [selectedReportId, setSelectedReportId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMembersLoading(true);
      setMembersError(null);
      try {
        const response = await fetch("/api/community-members");
        const data: unknown = await response.json();
        const rawItems =
          data && typeof data === "object" && "items" in data
            ? (data as { items: unknown }).items
            : null;
        if (!Array.isArray(rawItems)) {
          if (!cancelled) setMembers([]);
          return;
        }
        const next: CommunityMember[] = rawItems
          .map((row): CommunityMember | null => {
            if (!row || typeof row !== "object") return null;
            const r = row as Record<string, unknown>;
            const id = String(r.id ?? "").trim();
            const email = String(r.email ?? "").trim();
            if (!id && !email) return null;
            const name = String(r.name ?? "").trim();
            const statusRaw = String(r.status ?? "Active");
            const status: MemberStatus =
              statusRaw === "Suspended" || statusRaw === "Warned" || statusRaw === "Active"
                ? statusRaw
                : "Active";
            const contributions = Number(r.contributions);
            return {
              id: id || email,
              name: name || id || email,
              email: email || "",
              role: "Student",
              joinedAt: String(r.joinedAt ?? ""),
              contributions: Number.isFinite(contributions) ? contributions : 0,
              status,
            };
          })
          .filter((m): m is CommunityMember => Boolean(m));
        if (!cancelled) setMembers(next);
      } catch {
        if (!cancelled) {
          setMembers([]);
          setMembersError("Could not load community members.");
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReportsLoading(true);
      setReportsError(null);
      try {
        const response = await fetch("/api/community-post-reports");
        const data: unknown = await response.json();
        if (!response.ok) {
          if (!cancelled) {
            setReports([]);
            setReportsError(
              typeof data === "object" && data !== null && "error" in data
                ? String((data as { error: unknown }).error)
                : "Could not load reports."
            );
          }
          return;
        }
        if (!Array.isArray(data)) {
          if (!cancelled) {
            setReports([]);
            setReportsError("Invalid report response.");
          }
          return;
        }
        const next = data
          .map((row) => mapApiReportToRow(row))
          .filter((m): m is ReportedPost => Boolean(m));
        if (!cancelled) setReports(next);
      } catch {
        if (!cancelled) {
          setReports([]);
          setReportsError("Could not load reports.");
        }
      } finally {
        if (!cancelled) setReportsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reports.length === 0) {
      setSelectedReportId("");
      return;
    }
    setSelectedReportId((prev) =>
      prev && reports.some((r) => r.id === prev) ? prev : reports[0].id
    );
  }, [reports]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return members.filter((member) => {
      if (!query) return true;
      return `${member.name} ${member.email} ${member.id}`.toLowerCase().includes(query);
    });
  }, [memberSearch, members]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (!reportStatusFilter) return true;
      return report.status === reportStatusFilter;
    });
  }, [reportStatusFilter, reports]);

  const selectedReport =
    filteredReports.find((report) => report.id === selectedReportId) ?? filteredReports[0] ?? null;

  const openReportCount = reports.filter((report) => report.status === "OPEN").length;

  const closedTodayCount = reports.filter(
    (report) =>
      (report.status === "REVIEWED" || report.status === "DISMISSED") &&
      isClosedToday(report.updatedAt)
  ).length;

  const updateReportStatus = async (id: string, nextStatus: ReportStatus) => {
    const response = await fetch(`/api/community-post-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) {
      return;
    }
    const raw: unknown = await response.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      setReports((previous) =>
        previous.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
      );
      return;
    }
    const doc = raw as Record<string, unknown>;
    const statusRaw = String(doc.status ?? nextStatus).toUpperCase();
    const status: ReportStatus =
      statusRaw === "REVIEWED" || statusRaw === "DISMISSED" || statusRaw === "OPEN"
        ? statusRaw
        : nextStatus;
    const updatedRaw = doc.updatedAt;
    const updatedIso =
      updatedRaw instanceof Date
        ? updatedRaw.toISOString()
        : typeof updatedRaw === "string"
          ? updatedRaw
          : undefined;
    setReports((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              updatedAt: updatedIso ?? item.updatedAt,
            }
          : item
      )
    );
  };

  const handleLogout = () => {
    clearDemoSession();
    router.replace(isDemoModeEnabled() ? "/" : "/login");
  };

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-bg">
      <header className="flex shrink-0 flex-col gap-4 border-b border-border bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
            Community Admin
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text/72">
            Monitor members, inspect reported posts, and manage moderation actions from one place.
          </p>
        </div>
        <Button
          className="h-11 shrink-0 gap-2 !rounded-full border-heading/20 px-5 text-heading hover:border-heading/35 hover:bg-tint"
          type="button"
          variant="secondary"
        >
          <ShieldCheck size={16} className="text-heading/80" aria-hidden />
          Moderation Rules
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-3 pb-3 pt-3 md:flex-row md:gap-6 md:px-5 md:pb-4 md:pt-4">
        <aside
          aria-label="Community admin navigation"
          className="flex w-full shrink-0 flex-col border-b border-border pb-3 md:w-[260px] md:min-h-0 md:shrink-0 md:self-stretch md:border-b-0 md:border-r md:pb-0 md:pr-5"
        >
          <Card
            title="Sections"
            description="Jump to each admin area."
            className="min-h-0 rounded-2xl p-4 md:flex-1 md:overflow-y-auto md:overscroll-contain"
          >
            <nav aria-label="Community admin sections" className="space-y-1.5">
              {SECTION_LINKS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-xl border border-border bg-card px-3 py-2 text-sm whitespace-nowrap text-text/80 transition-colors hover:bg-tint hover:text-heading"
                >
                  {section.label}
                </a>
              ))}
            </nav>
          </Card>
          <div className="mt-3 shrink-0 border-t border-border pt-3 md:mt-auto">
            <Button
              className="h-10 w-full gap-2 focus-visible:ring-red-500"
              type="button"
              variant="danger"
              onClick={handleLogout}
            >
              <LogOut size={16} aria-hidden />
              Logout
            </Button>
          </div>
        </aside>

        <main
          id="community-admin-main"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1"
        >
          <div className="space-y-6 pb-6 md:space-y-8">
        <section id="overview" className="scroll-mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card accent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text/72">Total Members</p>
                <p className="mt-2 text-2xl font-semibold text-heading">{members.length}</p>
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
                <p className="text-sm text-text/72">Closed today</p>
                <p className="mt-2 text-2xl font-semibold text-heading">{closedTodayCount}</p>
              </div>
              <span className="rounded-2xl bg-primary/10 p-2 text-primary">
                <Eye size={18} />
              </span>
            </div>
          </Card>
        </section>

        <section id="filters" className="scroll-mt-6">
          <Card
            title="Filters"
            description="Search student users in the User table and filter the report queue."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Search by username, email, or user ID"
              />
              <Select
                value={reportStatusFilter}
                onChange={(event) => setReportStatusFilter(event.target.value as "" | ReportStatus)}
              >
                <option value="">All report status</option>
                <option value="OPEN">Open</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="DISMISSED">Dismissed</option>
              </Select>
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-12">
          <Card
            id="members"
            className="scroll-mt-6 xl:col-span-7"
            title="Community Members"
            description="Rows from the User table (role: STUDENT). Names and identifiers come from user records."
          >
            {membersError ? (
              <p className="rounded-2xl border border-dashed border-border bg-tint px-4 py-8 text-center text-sm text-text/70">
                {membersError}
              </p>
            ) : membersLoading ? (
              <p className="rounded-2xl border border-dashed border-border bg-tint px-4 py-8 text-center text-sm text-text/70">
                Loading community members…
              </p>
            ) : filteredMembers.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-tint px-4 py-8 text-center text-sm text-text/70">
                {members.length === 0
                  ? "No student users found in the User table."
                  : "No members match the current search."}
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
            className="scroll-mt-6 xl:col-span-5"
            title="Reported Posts"
            description="Post reports from the database (CommunityPostReport)."
          >
            {reportsError ? (
              <p className="rounded-2xl border border-dashed border-border bg-tint px-4 py-8 text-center text-sm text-text/70">
                {reportsError}
              </p>
            ) : reportsLoading ? (
              <p className="rounded-2xl border border-dashed border-border bg-tint px-4 py-8 text-center text-sm text-text/70">
                Loading reports…
              </p>
            ) : filteredReports.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-tint px-4 py-8 text-center text-sm text-text/70">
                {reports.length === 0
                  ? "No post reports yet."
                  : "No reports match this status filter."}
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
                        <p className="text-sm font-semibold text-heading">
                          {reportListLabel(report.id)}
                        </p>
                        <Badge variant={priorityVariant(report.priority)}>{report.priority}</Badge>
                        <Badge variant={reportStatusVariant(report.status)}>
                          {reportStatusLabel(report.status)}
                        </Badge>
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
          className="scroll-mt-6"
          title="Reported Post Details"
          description="Review evidence and apply moderation decision."
        >
          {selectedReport ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border bg-tint px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text/60">Report ID</p>
                  <p className="mt-1 break-all text-sm font-semibold text-heading">
                    {selectedReport.id}
                  </p>
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
                  disabled={selectedReport.status === "REVIEWED"}
                  onClick={() => updateReportStatus(selectedReport.id, "REVIEWED")}
                  variant="secondary"
                >
                  Mark reviewed
                </Button>
                <Button
                  className="h-10"
                  disabled={selectedReport.status === "DISMISSED"}
                  onClick={() => updateReportStatus(selectedReport.id, "DISMISSED")}
                >
                  Dismiss
                </Button>
                <Button
                  className="h-10"
                  disabled={selectedReport.status === "OPEN"}
                  onClick={() => updateReportStatus(selectedReport.id, "OPEN")}
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
        </main>
      </div>
    </div>
  );
}
