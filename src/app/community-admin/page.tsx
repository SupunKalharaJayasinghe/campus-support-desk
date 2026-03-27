"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Eye, Flag, UserCheck, UserMinus, Users, UserX } from "lucide-react";
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

  const activeMemberCount = members.filter((m) => m.status === "Active").length;
  const warnedMemberCount = members.filter((m) => m.status === "Warned").length;
  const suspendedMemberCount = members.filter((m) => m.status === "Suspended").length;

  return (
    <div className="space-y-10 pb-6 md:space-y-12">
      <section id="overview" className="scroll-mt-6 space-y-10">
        <div id="member-overview" className="scroll-mt-6 space-y-4 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-sky-50/40 via-card to-card p-5 shadow-sm md:p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-heading md:text-xl">
              Member details
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text/70">
              Headcounts and moderation status for students in the community directory.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card accent className="border-l-[3px] border-l-primary">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total members</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-heading">
                    {membersLoading ? "…" : members.length}
                  </p>
                </div>
                <span className="rounded-2xl bg-primary/12 p-2.5 text-primary ring-1 ring-primary/15">
                  <Users size={18} />
                </span>
              </div>
            </Card>

            <Card accent className="border-l-[3px] border-l-emerald-600">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Active</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-heading">
                    {membersLoading ? "…" : activeMemberCount}
                  </p>
                </div>
                <span className="rounded-2xl bg-emerald-600/12 p-2.5 text-emerald-800 ring-1 ring-emerald-600/20">
                  <UserCheck size={18} />
                </span>
              </div>
            </Card>

            <Card accent className="border-l-[3px] border-l-amber-500">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Warned</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-heading">
                    {membersLoading ? "…" : warnedMemberCount}
                  </p>
                </div>
                <span className="rounded-2xl bg-amber-500/14 p-2.5 text-amber-800 ring-1 ring-amber-500/25">
                  <UserMinus size={18} />
                </span>
              </div>
            </Card>

            <Card accent className="border-l-[3px] border-l-rose-600">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Suspended</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-heading">
                    {membersLoading ? "…" : suspendedMemberCount}
                  </p>
                </div>
                <span className="rounded-2xl bg-rose-600/12 p-2.5 text-rose-800 ring-1 ring-rose-600/20">
                  <UserX size={18} />
                </span>
              </div>
            </Card>
          </div>

          <Card
            title="Community members"
            description="Open the full student directory, search, and status breakdown."
            className="border-l-[3px] border-l-primary bg-gradient-to-br from-card to-primary/[0.04]"
          >
            <Link href="/community-admin/members">
              <Button
                className="h-10 border-violet-400/40 bg-blue-600 text-white hover:border-violet-500 hover:bg-blue-900 sm:w-auto"
                type="button"
                variant="primary"
              >
                Open member directory
              </Button>
            </Link>
          </Card>
        </div>

        <div
          id="post-reports-overview"
          className="scroll-mt-6 space-y-4 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/35 via-card to-card p-5 shadow-sm md:p-6"
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-heading md:text-xl">
              Post &amp; report details
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text/70">
              Report volume, open queue size, and reports closed today after moderation.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card accent className="border-l-[3px] border-l-violet-500">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Reported posts</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-heading">
                    {reportsLoading ? "…" : reports.length}
                  </p>
                </div>
                <span className="rounded-2xl bg-violet-500/12 p-2.5 text-violet-700 ring-1 ring-violet-500/20">
                  <Flag size={18} />
                </span>
              </div>
            </Card>

            <Card accent className="border-l-[3px] border-l-amber-500">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Open reports</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-heading">
                    {statsReady ? openReportCount : "…"}
                  </p>
                </div>
                <span className="rounded-2xl bg-amber-500/14 p-2.5 text-amber-800 ring-1 ring-amber-500/25">
                  <AlertTriangle size={18} />
                </span>
              </div>
            </Card>

            <Card accent className="border-l-[3px] border-l-emerald-600">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Closed today</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-heading">
                    {statsReady ? closedTodayCount : "…"}
                  </p>
                </div>
                <span className="rounded-2xl bg-emerald-600/12 p-2.5 text-emerald-800 ring-1 ring-emerald-600/20">
                  <Eye size={18} />
                </span>
              </div>
            </Card>
          </div>

          <Card
            title="Reported posts"
            description="Review the queue, read evidence, and update report status."
            className="border-l-[3px] border-l-violet-500 bg-gradient-to-br from-card to-violet-500/[0.05]"
          >
            <Link href="/community-admin/reported-posts">
              <Button
                className="h-10 w-full border-violet-400/40 bg-blue-600 text-white hover:border-violet-500 hover:bg-blue-900 sm:w-auto"
                type="button"
                variant="secondary"
              >
                Open reported posts
              </Button>
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}
