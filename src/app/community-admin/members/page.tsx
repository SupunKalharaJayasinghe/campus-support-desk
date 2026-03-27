"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { UserCheck, UserMinus, Users, UserX } from "lucide-react";

type MemberStatus = "Active" | "Warned" | "Suspended";

interface CommunityMemberRow {
  id: string;
  name: string;
  email: string;
  role: "Student";
  joinedAt: string;
  contributions: number;
  status: MemberStatus;
}

function memberStatusVariant(status: MemberStatus) {
  if (status === "Active") return "success" as const;
  if (status === "Warned") return "warning" as const;
  return "danger" as const;
}

export default function CommunityAdminMembersPage() {
  const [members, setMembers] = useState<CommunityMemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

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
        const next: CommunityMemberRow[] = rawItems
          .map((row): CommunityMemberRow | null => {
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
          .filter((m): m is CommunityMemberRow => Boolean(m));
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

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return members.filter((member) => {
      if (!query) return true;
      return `${member.name} ${member.email} ${member.id}`.toLowerCase().includes(query);
    });
  }, [memberSearch, members]);

  const activeCount = members.filter((m) => m.status === "Active").length;
  const warnedCount = members.filter((m) => m.status === "Warned").length;
  const suspendedCount = members.filter((m) => m.status === "Suspended").length;

  return (
    <div className="space-y-6 pb-6 md:space-y-8">
      <section id="overview" className="scroll-mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card accent>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text/72">Total members</p>
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
              <p className="text-sm text-text/72">Active</p>
              <p className="mt-2 text-2xl font-semibold text-heading">{activeCount}</p>
            </div>
            <span className="rounded-2xl bg-primary/10 p-2 text-primary">
              <UserCheck size={18} />
            </span>
          </div>
        </Card>

        <Card accent>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text/72">Warned</p>
              <p className="mt-2 text-2xl font-semibold text-heading">{warnedCount}</p>
            </div>
            <span className="rounded-2xl bg-primary/10 p-2 text-primary">
              <UserMinus size={18} />
            </span>
          </div>
        </Card>

        <Card accent>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text/72">Suspended</p>
              <p className="mt-2 text-2xl font-semibold text-heading">{suspendedCount}</p>
            </div>
            <span className="rounded-2xl bg-primary/10 p-2 text-primary">
              <UserX size={18} />
            </span>
          </div>
        </Card>
      </section>

      <section id="filters" className="scroll-mt-6">
        <Card
          title="Search"
          description="Filter the directory by username, email, or user ID."
        >
          <Input
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder="Search by username, email, or user ID"
          />
        </Card>
      </section>

      <Card
        id="directory"
        className="scroll-mt-6"
        title="Member directory"
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
    </div>
  );
}
