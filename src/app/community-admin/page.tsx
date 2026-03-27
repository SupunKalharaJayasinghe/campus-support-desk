"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Eye, Flag, Users } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  isClosedToday,
  mapApiReportToRow,
  type ReportedPost,
} from "@/app/community-admin/_lib/reports";

type MemberStatus = "Active" | "Warned" | "Suspended";

interface CommunityMember {
  id: string;
  name: string;
  email: string;
  role: "Student";
  joinedAt: string;
  contributions: number;
  status: MemberStatus;
}

export default function CommunityAdminDashboardPage() {
  const [reports, setReports] = useState<ReportedPost[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMembersLoading(true);
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
        if (!cancelled) setMembers([]);
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
      try {
        const response = await fetch("/api/community-post-reports");
        const data: unknown = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          if (!cancelled) setReports([]);
          return;
        }
        const next = data
          .map((row) => mapApiReportToRow(row))
          .filter((m): m is ReportedPost => Boolean(m));
        if (!cancelled) setReports(next);
      } catch {
        if (!cancelled) setReports([]);
      } finally {
        if (!cancelled) setReportsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openReportCount = reports.filter((report) => report.status === "OPEN").length;

  const closedTodayCount = reports.filter(
    (report) =>
      (report.status === "REVIEWED" ||
        report.status === "AGREED" ||
        report.status === "DISMISSED") &&
      isClosedToday(report.updatedAt)
  ).length;

  const statsReady = !membersLoading && !reportsLoading;

  return (
    <div className="space-y-6 pb-6 md:space-y-8">
      <section id="overview" className="scroll-mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card accent>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text/72">Total Members</p>
              <p className="mt-2 text-2xl font-semibold text-heading">
                {membersLoading ? "…" : members.length}
              </p>
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
              <p className="mt-2 text-2xl font-semibold text-heading">
                {reportsLoading ? "…" : reports.length}
              </p>
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
              <p className="mt-2 text-2xl font-semibold text-heading">
                {statsReady ? openReportCount : "…"}
              </p>
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
              <p className="mt-2 text-2xl font-semibold text-heading">
                {statsReady ? closedTodayCount : "…"}
              </p>
            </div>
            <span className="rounded-2xl bg-primary/10 p-2 text-primary">
              <Eye size={18} />
            </span>
          </div>
        </Card>
      </section>

      <section id="quick-links" className="scroll-mt-6 grid gap-4 md:grid-cols-2">
        <Card
          title="Community members"
          description="Open the full student directory, search, and status breakdown."
        >
          <Link href="/community-admin/members">
            <Button className="h-10 w-full sm:w-auto" type="button" variant="secondary">
              Open member directory
            </Button>
          </Link>
        </Card>
        <Card
          title="Reported posts"
          description="Review the queue, read evidence, and update report status."
        >
          <Link href="/community-admin/reported-posts">
            <Button className="h-10 w-full sm:w-auto" type="button" variant="secondary">
              Open reports
            </Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}
