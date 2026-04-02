"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { authHeaders } from "@/lib/rbac";

type MemberStatus = "Active" | "Warned" | "Suspended";

interface CommunityMemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "Student";
  joinedAt: string;
  contributions: number;
  /** Same `points` field shown on /community/profile (community profile Points card). */
  communityProfilePoints: number;
  /** One-time +20 admin bonus already applied (server-enforced). */
  adminBonus20Used: boolean;
  status: MemberStatus;
  hasCommunityProfile: boolean;
}

function memberStatusVariant(status: MemberStatus) {
  if (status === "Active") return "success" as const;
  if (status === "Warned") return "warning" as const;
  return "danger" as const;
}

type AddFormState = {
  displayName: string;
  username: string;
  email: string;
  bio: string;
  faculty: string;
  studyYear: string;
};

const emptyAddForm: AddFormState = {
  displayName: "",
  username: "",
  email: "",
  bio: "",
  faculty: "Computing",
  studyYear: "Year 2",
};

/** High-contrast field styles so the modal form stays readable on any admin theme. */
const addModalFieldClassName =
  "!border-slate-300 !bg-white !text-slate-900 shadow-inner shadow-slate-200/60 !placeholder:text-slate-400 focus-visible:!border-sky-600 focus-visible:!ring-2 focus-visible:!ring-sky-400/50";

const DELETE_CONFIRM_PHRASE = "Delete";

function parseMembersPayload(data: unknown): CommunityMemberRow[] {
  const rawItems =
    data && typeof data === "object" && "items" in data
      ? (data as { items: unknown }).items
      : null;
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((row): CommunityMemberRow | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const userId = String(r.userId ?? r.id ?? "").trim();
      const email = String(r.email ?? "").trim();
      if (!userId && !email) return null;
      const legacyId = String(r.id ?? "").trim();
      const id = legacyId || userId || email;
      const name = String(r.name ?? "").trim();
      const statusRaw = String(r.status ?? "Active");
      const status: MemberStatus =
        statusRaw === "Suspended" || statusRaw === "Warned" || statusRaw === "Active"
          ? statusRaw
          : "Active";
      const contributions = Number(r.contributions);
      const hasCommunityProfile = Boolean(r.hasCommunityProfile);
      const profilePts = Number(r.communityProfilePoints ?? r.profilePoints);
      const adminBonus20Used = Boolean(r.adminBonus20Used);
      return {
        id,
        userId: userId || legacyId || id,
        name: name || id,
        email: email || "",
        role: "Student",
        joinedAt: String(r.joinedAt ?? ""),
        contributions: Number.isFinite(contributions) ? contributions : 0,
        communityProfilePoints: Number.isFinite(profilePts) ? profilePts : 0,
        adminBonus20Used,
        status,
        hasCommunityProfile,
      };
    })
    .filter((m): m is CommunityMemberRow => Boolean(m));
}

export default function CommunityAdminMembersPage() {
  const [members, setMembers] = useState<CommunityMemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [addTarget, setAddTarget] = useState<CommunityMemberRow | null>(null);
  const [addForm, setAddForm] = useState<AddFormState>(emptyAddForm);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityMemberRow | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [memberRowsBusy, setMemberRowsBusy] = useState<
    Partial<Record<string, "points" | "delete">>
  >({});
  const [memberRowFlash, setMemberRowFlash] = useState<{
    userId: string;
    message: string;
  } | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const pointsInFlightRef = useRef<Set<string>>(new Set());
  const deleteInFlightRef = useRef<Set<string>>(new Set());
  const deleteConfirmInputRef = useRef<HTMLInputElement | null>(null);

  const setRowBusy = useCallback((userId: string, kind: "points" | "delete") => {
    setMemberRowsBusy((prev) => ({ ...prev, [userId]: kind }));
  }, []);

  const clearRowBusy = useCallback((userId: string, kind: "points" | "delete") => {
    setMemberRowsBusy((prev) => {
      if (prev[userId] !== kind) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const loadMembers = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setMembersLoading(true);
      setMembersError(null);
    }
    try {
      const response = await fetch("/api/community-members");
      const data: unknown = await response.json();
      setMembers(parseMembersPayload(data));
      setMembersError(null);
    } catch {
      if (!silent) {
        setMembers([]);
        setMembersError("Could not load community members.");
      }
    } finally {
      if (!silent) setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (!memberRowFlash) return;
    const timer = window.setTimeout(() => setMemberRowFlash(null), 4500);
    return () => window.clearTimeout(timer);
  }, [memberRowFlash]);

  useEffect(() => {
    if (!deleteTarget) return;
    const t = window.setTimeout(() => deleteConfirmInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [deleteTarget]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return members.filter((member) => {
      if (!query) return true;
      return `${member.name} ${member.email} ${member.id} ${member.userId}`
        .toLowerCase()
        .includes(query);
    });
  }, [memberSearch, members]);

  const openAddModal = (member: CommunityMemberRow) => {
    setAddError(null);
    setAddTarget(member);
    setAddForm({
      displayName: member.name.slice(0, 30),
      username: member.id !== member.userId ? member.id.slice(0, 40) : "",
      email: member.email.slice(0, 120),
      bio: "",
      faculty: "Computing",
      studyYear: "Year 2",
    });
  };

  const closeAddModal = () => {
    setAddTarget(null);
    setAddForm(emptyAddForm);
    setAddError(null);
  };

  const submitAddToCommunity = async () => {
    if (!addTarget || addSaving) return;
    const displayName = addForm.displayName.trim();
    if (!displayName) {
      setAddError("Display name is required.");
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch("/api/community-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          userId: addTarget.userId,
          displayName: displayName.slice(0, 30),
          username: addForm.username.trim().slice(0, 40),
          email: addForm.email.trim().slice(0, 120),
          bio: addForm.bio.trim().slice(0, 500),
          faculty: addForm.faculty.trim() || "Computing",
          studyYear: addForm.studyYear.trim() || "Year 2",
          visibility: "public",
        }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        throw new Error(body?.message || "Could not create community profile.");
      }
      setAddTarget(null);
      setAddForm(emptyAddForm);
      setAddError(null);
      await loadMembers();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Could not add to community.");
    } finally {
      setAddSaving(false);
    }
  };

  const openDeleteModal = (member: CommunityMemberRow) => {
    setDeleteConfirmInput("");
    setDeleteTarget(member);
  };

  const closeDeleteModal = () => {
    if (deleteTarget && memberRowsBusy[deleteTarget.userId] === "delete") return;
    setDeleteTarget(null);
    setDeleteConfirmInput("");
  };

  const confirmDeleteCommunityMember = async () => {
    if (!deleteTarget || deleteConfirmInput !== DELETE_CONFIRM_PHRASE) return;
    const member = deleteTarget;
    if (deleteInFlightRef.current.has(member.userId)) return;
    setMemberActionError(null);
    deleteInFlightRef.current.add(member.userId);
    setRowBusy(member.userId, "delete");
    try {
      const res = await fetch(
        `/api/community-profile?userId=${encodeURIComponent(member.userId)}`,
        { method: "DELETE", headers: { ...authHeaders() } }
      );
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        throw new Error(body?.message || "Could not remove member.");
      }
      setDeleteTarget(null);
      setDeleteConfirmInput("");
      setMemberRowFlash({ userId: member.userId, message: "Removed from community." });
      await loadMembers();
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : "Could not remove member.");
    } finally {
      deleteInFlightRef.current.delete(member.userId);
      clearRowBusy(member.userId, "delete");
    }
  };

  const addTwentyCommunityPoints = async (member: CommunityMemberRow) => {
    if (member.adminBonus20Used) return;
    if (pointsInFlightRef.current.has(member.userId)) return;
    pointsInFlightRef.current.add(member.userId);
    setMemberActionError(null);
    setRowBusy(member.userId, "points");
    try {
      const res = await fetch("/api/community-profile/admin-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ userId: member.userId }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        throw new Error(body?.message || "Could not add points.");
      }
      setMemberRowFlash({
        userId: member.userId,
        message: body?.message?.trim() || "20 points added",
      });
      await loadMembers({ silent: true });
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : "Could not add points.");
    } finally {
      pointsInFlightRef.current.delete(member.userId);
      clearRowBusy(member.userId, "points");
    }
  };

  return (
    <div className="space-y-6 pb-6 md:space-y-8">
      <section id="filters" className="scroll-mt-6">
        <Card
          title="Search"
          description="Filter the directory by username, email, or user ID."
          className="border-l-[3px] border-l-sky-500 bg-gradient-to-br from-card to-sky-500/[0.04]"
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
        className="scroll-mt-6 border-l-[3px] border-l-slate-400"
        title="Member directory"
        description="Student accounts from the User table. Add a community profile so they appear as a community member with profile details."
      >
        {memberActionError ? (
          <p
            className="mb-4 rounded-2xl border border-rose-200/90 bg-rose-50/80 px-4 py-3 text-sm font-medium text-rose-900/90"
            role="alert"
          >
            {memberActionError}
          </p>
        ) : null}
        {membersError ? (
          <p className="rounded-2xl border border-dashed border-rose-200/80 bg-rose-50/50 px-4 py-8 text-center text-sm text-rose-900/80">
            {membersError}
          </p>
        ) : membersLoading ? (
          <p className="rounded-2xl border border-dashed border-sky-200/70 bg-sky-50/40 px-4 py-8 text-center text-sm text-slate-600">
            Loading community members…
          </p>
        ) : filteredMembers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-600">
            {members.length === 0
              ? "No student users found in the User table."
              : "No members match the current search."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-primary/15 bg-gradient-to-r from-primary/[0.07] via-sky-500/[0.06] to-transparent text-left text-slate-600">
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide">Member</th>
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide">Role</th>
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide">Community</th>
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide">Joined</th>
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide">Posts/Replies</th>
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide">Profile pts</th>
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide">Status</th>
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.03]"
                    key={member.userId}
                  >
                    <td className="px-2 py-3 align-top">
                      <p className="font-medium text-heading">{member.name}</p>
                      <p className="text-xs text-text/70">{member.email}</p>
                      <p className="text-xs text-text/60">{member.userId}</p>
                    </td>
                    <td className="px-2 py-3 align-top text-text/85">{member.role}</td>
                    <td className="px-2 py-3 align-top">
                      {member.hasCommunityProfile ? (
                        <Badge variant="success">Community member</Badge>
                      ) : (
                        <span className="text-text/55">Not in community</span>
                      )}
                    </td>
                    <td className="px-2 py-3 align-top text-text/85">{member.joinedAt}</td>
                    <td className="px-2 py-3 align-top text-text/85">{member.contributions}</td>
                    <td className="px-2 py-3 align-top text-text/85">
                      {member.hasCommunityProfile ? member.communityProfilePoints : "—"}
                    </td>
                    <td className="px-2 py-3 align-top">
                      <Badge variant={memberStatusVariant(member.status)}>{member.status}</Badge>
                    </td>
                    <td className="px-2 py-3 align-top text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        {!member.hasCommunityProfile ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs"
                            onClick={() => openAddModal(member)}
                          >
                            Add to community
                          </Button>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {member.adminBonus20Used ? (
                              <span
                                className="inline-flex items-center whitespace-nowrap rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-1.5 text-xs font-medium text-text/55"
                                title="This member already received the one-time +20 bonus."
                              >
                                +20 used
                              </span>
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs"
                                disabled={Boolean(memberRowsBusy[member.userId])}
                                onClick={() => void addTwentyCommunityPoints(member)}
                              >
                                {memberRowsBusy[member.userId] === "points"
                                  ? "Adding…"
                                  : "+20 points"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="secondary"
                              className="whitespace-nowrap rounded-xl border-rose-300/80 bg-rose-50/90 px-3 py-1.5 text-xs font-medium !text-rose-900 hover:!bg-rose-100"
                              disabled={Boolean(memberRowsBusy[member.userId])}
                              onClick={() => openDeleteModal(member)}
                            >
                              {memberRowsBusy[member.userId] === "delete"
                                ? "Removing…"
                                : "Delete"}
                            </Button>
                          </div>
                        )}
                        {memberRowFlash?.userId === member.userId ? (
                          <p className="max-w-[14rem] text-right text-xs font-medium text-emerald-700">
                            {memberRowFlash.message}
                          </p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => closeDeleteModal()}
          />
          <div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-2 border-rose-200/90 bg-gradient-to-b from-white via-white to-rose-50/50 p-0 text-slate-900 shadow-2xl ring-2 ring-slate-900/15"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-member-title"
          >
            <div className="border-b border-rose-200/80 bg-rose-50/90 px-6 py-4">
              <h2 id="delete-member-title" className="text-lg font-semibold text-slate-900">
                Remove community profile
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                This removes{" "}
                <span className="font-semibold text-slate-900">{deleteTarget.name}</span>
                {deleteTarget.email ? (
                  <span className="text-rose-900/90"> ({deleteTarget.email})</span>
                ) : null}{" "}
                from the community. Their user account stays; only the community profile is deleted.
              </p>
              <p className="mt-3 text-sm font-medium text-slate-800">
                Type{" "}
                <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-900">
                  {DELETE_CONFIRM_PHRASE}
                </span>{" "}
                below, then click OK.
              </p>
            </div>
            <div className="px-6 py-4">
              <label
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                htmlFor="delete-confirm-input"
              >
                Confirmation
              </label>
              <Input
                id="delete-confirm-input"
                ref={deleteConfirmInputRef}
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={DELETE_CONFIRM_PHRASE}
                autoComplete="off"
                className={addModalFieldClassName}
                disabled={memberRowsBusy[deleteTarget.userId] === "delete"}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-6 py-4">
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl !border-slate-300 !bg-white !text-slate-800 hover:!bg-slate-100"
                onClick={closeDeleteModal}
                disabled={memberRowsBusy[deleteTarget.userId] === "delete"}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl !bg-rose-700 !text-white hover:!bg-rose-800 hover:!shadow-md disabled:!opacity-50"
                disabled={
                  deleteConfirmInput !== DELETE_CONFIRM_PHRASE ||
                  memberRowsBusy[deleteTarget.userId] === "delete"
                }
                onClick={() => void confirmDeleteCommunityMember()}
              >
                {memberRowsBusy[deleteTarget.userId] === "delete" ? "Removing…" : "OK"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {addTarget ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => {
              if (!addSaving) closeAddModal();
            }}
          />
          <div
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border-2 border-sky-300/90 bg-gradient-to-b from-white via-white to-sky-50/80 p-0 text-slate-900 shadow-2xl ring-2 ring-slate-900/15"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-community-title"
          >
            <div className="border-b border-sky-200/90 bg-sky-100/80 px-6 py-4">
              <h2 id="add-community-title" className="text-lg font-semibold text-slate-900">
                Add to community
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                Create a community profile for{" "}
                <span className="font-semibold text-slate-900">{addTarget.name}</span>
                {addTarget.email ? (
                  <>
                    {" "}
                    <span className="text-sky-800">({addTarget.email})</span>
                  </>
                ) : null}
                . They will show as a community member in this directory.
              </p>
            </div>

            <div className="space-y-3 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="add-displayName">
                  Display name <span className="text-rose-600 normal-case">*</span>
                </label>
                <Input
                  id="add-displayName"
                  value={addForm.displayName}
                  onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
                  maxLength={30}
                  placeholder="Shown on posts and profile"
                  className={addModalFieldClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="add-username">
                  Username
                </label>
                <Input
                  id="add-username"
                  value={addForm.username}
                  onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                  maxLength={40}
                  placeholder="Optional handle"
                  className={addModalFieldClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="add-email">
                  Email
                </label>
                <Input
                  id="add-email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  maxLength={120}
                  className={addModalFieldClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="add-faculty">
                  Faculty
                </label>
                <Input
                  id="add-faculty"
                  value={addForm.faculty}
                  onChange={(e) => setAddForm((f) => ({ ...f, faculty: e.target.value }))}
                  maxLength={80}
                  className={addModalFieldClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="add-studyYear">
                  Study year
                </label>
                <Input
                  id="add-studyYear"
                  value={addForm.studyYear}
                  onChange={(e) => setAddForm((f) => ({ ...f, studyYear: e.target.value }))}
                  maxLength={40}
                  className={addModalFieldClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="add-bio">
                  Bio
                </label>
                <Textarea
                  id="add-bio"
                  value={addForm.bio}
                  onChange={(e) => setAddForm((f) => ({ ...f, bio: e.target.value }))}
                  maxLength={500}
                  rows={3}
                  placeholder="Short introduction"
                  className={addModalFieldClassName}
                />
              </div>
            </div>

            {addError ? (
              <p className="mx-6 mb-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800" role="alert">
                {addError}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-6 py-4">
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl !border-slate-300 !bg-white !text-slate-800 hover:!bg-slate-100"
                onClick={closeAddModal}
                disabled={addSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl !bg-sky-600 !text-white hover:!bg-sky-700 hover:!shadow-md"
                onClick={() => void submitAddToCommunity()}
                disabled={addSaving}
              >
                {addSaving ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
