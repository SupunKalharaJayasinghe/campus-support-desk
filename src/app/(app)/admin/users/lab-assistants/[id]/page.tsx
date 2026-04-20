"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Layers3,
} from "lucide-react";
import AdminSummaryCard from "@/components/admin/AdminSummaryCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";
import { useAdminContext } from "@/components/admin/AdminContext";

type LabAssistantStatus = "ACTIVE" | "INACTIVE";

interface LabAssistantRecord {
  id: string;
  fullName: string;
  email: string;
  optionalEmail: string;
  phone: string;
  nicStaffId: string;
  status: LabAssistantStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
  updatedAt: string;
}

interface OfferingRecord {
  id: string;
  facultyId: string;
  facultyName: string;
  degreeProgramId: string;
  degreeProgramName: string;
  intakeId: string;
  intakeName: string;
  termCode: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  syllabusVersion: string;
  status: string;
  updatedAt: string;
}

interface FacultyOption {
  code: string;
  name: string;
}

interface DegreeOption {
  code: string;
  name: string;
}

interface ModuleOption {
  id: string;
  code: string;
  name: string;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeOptionalEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .slice(0, 254);
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function sanitizeStatus(value: unknown): LabAssistantStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function sanitizeCodeList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((item) => normalizeAcademicCode(item)).filter(Boolean)));
}

function sanitizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toISOString().slice(0, 10);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "message" in payload && payload.message
        ? payload.message
        : "Request failed"
    );
  }

  return (payload ?? ({} as T)) as T;
}

function parseLabAssistant(payload: unknown): LabAssistantRecord | null {
  const row = asObject(payload);
  if (!row) {
    return null;
  }

  const id = String(row.id ?? row._id ?? "").trim();
  const fullName = collapseSpaces(row.fullName);
  const email = String(row.email ?? "").trim().toLowerCase();
  if (!id || !fullName || !email) {
    return null;
  }

  return {
    id,
    fullName,
    email,
    optionalEmail: sanitizeOptionalEmail(row.optionalEmail),
    phone: collapseSpaces(row.phone),
    nicStaffId: String(row.nicStaffId ?? "").trim(),
    status: sanitizeStatus(row.status),
    facultyIds: sanitizeCodeList(row.facultyIds),
    degreeProgramIds: sanitizeCodeList(row.degreeProgramIds),
    moduleIds: sanitizeIdList(row.moduleIds),
    updatedAt: String(row.updatedAt ?? ""),
  };
}

function parseOfferings(payload: unknown): OfferingRecord[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return rows
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const id = String(row.id ?? row._id ?? "").trim();
      if (!id) {
        return null;
      }

      return {
        id,
        facultyId: normalizeAcademicCode(row.facultyId),
        facultyName: collapseSpaces(row.facultyName),
        degreeProgramId: normalizeAcademicCode(row.degreeProgramId),
        degreeProgramName: collapseSpaces(row.degreeProgramName),
        intakeId: String(row.intakeId ?? "").trim(),
        intakeName: collapseSpaces(row.intakeName),
        termCode: String(row.termCode ?? "").trim().toUpperCase(),
        moduleId: String(row.moduleId ?? "").trim(),
        moduleCode: String(row.moduleCode ?? "").trim().toUpperCase(),
        moduleName: collapseSpaces(row.moduleName),
        syllabusVersion: String(row.syllabusVersion ?? "").trim().toUpperCase(),
        status: String(row.status ?? "").trim().toUpperCase(),
        updatedAt: String(row.updatedAt ?? ""),
      } satisfies OfferingRecord;
    })
    .filter((row): row is OfferingRecord => Boolean(row));
}

function parseFaculties(payload: unknown): FacultyOption[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      const row = asObject(item);
      if (!row) return null;
      const code = normalizeAcademicCode(row.code);
      if (!code) return null;
      return {
        code,
        name: collapseSpaces(row.name),
      } satisfies FacultyOption;
    })
    .filter((row): row is FacultyOption => Boolean(row));
}

function parseDegrees(payload: unknown): DegreeOption[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];
  return rows
    .map((item) => {
      const row = asObject(item);
      if (!row) return null;
      const code = normalizeAcademicCode(row.code);
      if (!code) return null;
      return {
        code,
        name: collapseSpaces(row.name),
      } satisfies DegreeOption;
    })
    .filter((row): row is DegreeOption => Boolean(row));
}

function parseModules(payload: unknown): ModuleOption[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return rows
    .map((item) => {
      const row = asObject(item);
      if (!row) return null;
      const id = String(row.id ?? row._id ?? "").trim();
      const code = String(row.code ?? "").trim().toUpperCase();
      if (!id || !code) return null;
      return {
        id,
        code,
        name: collapseSpaces(row.name),
      } satisfies ModuleOption;
    })
    .filter((row): row is ModuleOption => Boolean(row));
}

export default function LabAssistantProfilePage() {
  const params = useParams<{ id: string }>();
  const labAssistantId = String(params?.id ?? "").trim();
  const { toast } = useToast();
  const { setActiveWindow } = useAdminContext();

  const [profile, setProfile] = useState<LabAssistantRecord | null>(null);
  const [offerings, setOfferings] = useState<OfferingRecord[]>([]);
  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
  const [error, setError] = useState("");
  const [offeringsError, setOfferingsError] = useState("");

  const loadProfile = useCallback(async () => {
    if (!labAssistantId) {
      setError("Lab assistant id is missing");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const payload = await readJson<unknown>(
        await fetch(`/api/lab-assistants/${encodeURIComponent(labAssistantId)}`, {
          cache: "no-store",
        })
      );
      const parsed = parseLabAssistant(payload);
      if (!parsed) {
        throw new Error("Failed to parse lab assistant profile");
      }

      setProfile(parsed);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load profile";
      setError(message);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [labAssistantId]);

  const loadOfferings = useCallback(async () => {
    if (!labAssistantId) {
      setOfferingsError("Failed to load assigned offerings");
      setIsLoadingOfferings(false);
      return;
    }

    setIsLoadingOfferings(true);
    setOfferingsError("");
    try {
      const payload = await readJson<unknown>(
        await fetch(`/api/lab-assistants/${encodeURIComponent(labAssistantId)}/offerings`, {
          cache: "no-store",
        })
      );
      setOfferings(parseOfferings(payload));
    } catch {
      setOfferings([]);
      setOfferingsError("Failed to load assigned offerings");
    } finally {
      setIsLoadingOfferings(false);
    }
  }, [labAssistantId]);

  const loadEligibilityLookups = useCallback(async (record: LabAssistantRecord) => {
    try {
      const [facultiesPayload, degreesPayload, modulesPayload] = await Promise.all([
        readJson<unknown>(await fetch("/api/faculties", { cache: "no-store" })),
        readJson<unknown>(
          await fetch(
            `/api/degrees?facultyIds=${encodeURIComponent(record.facultyIds.join(","))}`,
            { cache: "no-store" }
          )
        ),
        readJson<unknown>(
          await fetch(
            `/api/modules?facultyIds=${encodeURIComponent(
              record.facultyIds.join(",")
            )}&degreeIds=${encodeURIComponent(record.degreeProgramIds.join(","))}&page=1&pageSize=100&sort=az`,
            { cache: "no-store" }
          )
        ),
      ]);

      setFaculties(parseFaculties(facultiesPayload));
      setDegrees(parseDegrees(degreesPayload));
      setModules(parseModules(modulesPayload));
    } catch {
      setFaculties([]);
      setDegrees([]);
      setModules([]);
    }
  }, []);

  useEffect(() => {
    setActiveWindow("Profile");
    void loadProfile();
    void loadOfferings();

    return () => {
      setActiveWindow(null);
    };
  }, [loadOfferings, loadProfile, setActiveWindow]);

  useEffect(() => {
    if (!profile) {
      setFaculties([]);
      setDegrees([]);
      setModules([]);
      return;
    }

    void loadEligibilityLookups(profile);
  }, [loadEligibilityLookups, profile]);

  const facultyMap = useMemo(
    () => new Map(faculties.map((item) => [item.code, item.name])),
    [faculties]
  );
  const degreeMap = useMemo(
    () => new Map(degrees.map((item) => [item.code, item.name])),
    [degrees]
  );
  const moduleMap = useMemo(
    () => {
      const map = new Map<string, string>();
      modules.forEach((item) => {
        map.set(item.id, `${item.code} - ${item.name}`);
        map.set(item.code, `${item.code} - ${item.name}`);
      });
      return map;
    },
    [modules]
  );
  const activeOfferingCount = useMemo(
    () => offerings.filter((offering) => offering.status === "ACTIVE").length,
    [offerings]
  );
  const latestOfferingUpdate = useMemo(
    () =>
      offerings.reduce<string | null>((latest, offering) => {
        if (!offering.updatedAt) return latest;
        if (!latest || offering.updatedAt.localeCompare(latest) > 0) {
          return offering.updatedAt;
        }
        return latest;
      }, null),
    [offerings]
  );
  const latestVisibleUpdate =
    profile?.updatedAt && latestOfferingUpdate
      ? profile.updatedAt.localeCompare(latestOfferingUpdate) > 0
        ? profile.updatedAt
        : latestOfferingUpdate
      : profile?.updatedAt ?? latestOfferingUpdate ?? null;
  const assistantName = profile?.fullName ?? "Lab Assistant Profile";

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <div className="flex justify-end">
        <Link
          className="inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-medium text-heading transition-colors hover:bg-slate-50"
          href="/admin/users/lab-assistants"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <p className="py-10 text-center text-text/65">Loading profile...</p>
        </Card>
      ) : error ? (
        <Card>
          <p className="py-10 text-center text-red-700">{error}</p>
        </Card>
      ) : profile ? (
        <>
          <section className={cn("grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]")}>
            <Card accent className="p-6 lg:p-7">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <Badge variant="neutral">User Management</Badge>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                      {assistantName}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                      Lab assistant profile overview with identity, support eligibility coverage, and
                      assigned module offerings in the updated admin directory surface.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:items-end">
                    <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[190px]">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                        Staff ID
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                        {profile.nicStaffId || "-"}
                      </p>
                      <p className="mt-1 text-sm text-text/60">Lab assistant profile details loaded</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-[24px] border border-border bg-white/78 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                      Email
                    </p>
                    <p className="mt-2 text-sm text-text/78">{profile.email}</p>
                  </div>
                  <div className="rounded-[24px] border border-border bg-white/78 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                      Phone
                    </p>
                    <p className="mt-2 text-sm text-text/78">{profile.phone || "-"}</p>
                  </div>
                  <div className="rounded-[24px] border border-border bg-white/78 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                      Status
                    </p>
                    <div className="mt-2">
                      <Badge variant={profile.status === "ACTIVE" ? "success" : "neutral"}>
                        {profile.status}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-text/60">
                      Updated {formatDate(profile.updatedAt)}
                    </p>
                  </div>
                </div>

                {profile.optionalEmail ? (
                  <div className="rounded-[24px] border border-border bg-white/78 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                      Optional Email
                    </p>
                    <p className="mt-2 text-sm text-text/78">{profile.optionalEmail}</p>
                  </div>
                ) : null}
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminSummaryCard
                detail="Profile identity loaded for the selected lab assistant."
                icon={GraduationCap}
                label="Assistant Status"
                tone="sky"
                value={profile.status}
              />
              <AdminSummaryCard
                detail={`${activeOfferingCount.toLocaleString()} active assigned offerings currently visible`}
                icon={CheckCircle2}
                label="Active Offerings"
                tone="green"
                value={activeOfferingCount.toLocaleString()}
              />
              <AdminSummaryCard
                detail={`${profile.moduleIds.length.toLocaleString()} support modules configured for this assistant`}
                icon={BookOpen}
                label="Support Modules"
                tone="violet"
                value={profile.moduleIds.length.toLocaleString()}
              />
              <AdminSummaryCard
                detail={
                  latestVisibleUpdate
                    ? "Most recent visible profile or assignment change"
                    : "No recent lab assistant updates available"
                }
                icon={Clock3}
                label="Latest Update"
                tone="amber"
                value={formatShortDate(latestVisibleUpdate)}
              />
            </div>
          </section>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-heading">Support Eligibility</p>
                <p className="mt-1 text-sm text-text/68">
                  Faculties, degrees, and modules this assistant is eligible to support. This
                  remains separate from actual assignment data.
                </p>
              </div>
              <Badge variant="neutral">Eligibility Scope</Badge>
            </div>
            <div className="grid gap-4 px-6 py-6 lg:grid-cols-3">
              <div className="rounded-[24px] border border-border bg-white/78 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Faculties
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.facultyIds.length === 0 ? (
                    <p className="text-sm text-text/68">No faculties selected.</p>
                  ) : (
                    profile.facultyIds.map((code) => (
                      <span
                        className="rounded-full border border-border bg-tint px-3 py-1 text-xs text-heading"
                        key={code}
                      >
                        {code}
                        {facultyMap.get(code) ? ` - ${facultyMap.get(code)}` : ""}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-[24px] border border-border bg-white/78 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Degrees
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.degreeProgramIds.length === 0 ? (
                    <p className="text-sm text-text/68">No degrees selected.</p>
                  ) : (
                    profile.degreeProgramIds.map((code) => (
                      <span
                        className="rounded-full border border-border bg-tint px-3 py-1 text-xs text-heading"
                        key={code}
                      >
                        {code}
                        {degreeMap.get(code) ? ` - ${degreeMap.get(code)}` : ""}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-[24px] border border-border bg-white/78 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Eligible Modules
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.moduleIds.length === 0 ? (
                    <p className="text-sm text-text/68">No modules selected.</p>
                  ) : (
                    profile.moduleIds.map((id) => (
                      <span
                        className="rounded-full border border-border bg-tint px-3 py-1 text-xs text-heading"
                        key={id}
                      >
                        {moduleMap.get(id) ?? id}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-heading">Assigned Module Offerings</p>
                <p className="mt-1 text-sm text-text/68">
                  Actual support assignments derived from module offerings.
                </p>
              </div>
              <AdminSummaryCard
                detail="Visible support assignments loaded for this assistant."
                icon={Layers3}
                label="Loaded Offerings"
                tone="sky"
                value={offerings.length.toLocaleString()}
              />
            </div>

            <div className="px-4 py-4 sm:px-6 sm:py-6">
              <div className="overflow-hidden rounded-[28px] border border-border bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-[rgba(255,255,255,0.82)]">
                      <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                        <th className="px-5 py-4">Module</th>
                        <th className="px-5 py-4">Faculty</th>
                        <th className="px-5 py-4">Degree</th>
                        <th className="px-5 py-4">Intake</th>
                        <th className="px-5 py-4">Term</th>
                        <th className="px-5 py-4">Syllabus</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {isLoadingOfferings ? (
                        <tr>
                          <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={8}>
                            Loading assigned offerings...
                          </td>
                        </tr>
                      ) : offeringsError ? (
                        <tr>
                          <td className="px-5 py-8" colSpan={8}>
                            <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                              <p className="text-sm font-medium text-red-700">
                                Failed to load assigned offerings
                              </p>
                              <Button
                                className="h-10 min-w-[96px] border-red-300 bg-white px-4 text-red-700 hover:bg-red-100"
                                onClick={() => {
                                  void loadOfferings();
                                  toast({
                                    title: "Retrying",
                                    message: "Loading assigned offerings again",
                                    variant: "info",
                                  });
                                }}
                                variant="secondary"
                              >
                                Retry
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ) : offerings.length === 0 ? (
                        <tr>
                          <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={8}>
                            No offerings assigned yet.
                          </td>
                        </tr>
                      ) : (
                        offerings.map((offering) => (
                          <tr className="transition-colors duration-200 hover:bg-white/70" key={offering.id}>
                            <td className="px-5 py-4">
                              <p className="font-semibold text-heading">{offering.moduleCode}</p>
                              <p className="text-text/75">{offering.moduleName}</p>
                            </td>
                            <td className="px-5 py-4">{offering.facultyId}</td>
                            <td className="px-5 py-4">{offering.degreeProgramId}</td>
                            <td className="px-5 py-4">{offering.intakeName || offering.intakeId}</td>
                            <td className="px-5 py-4">{offering.termCode}</td>
                            <td className="px-5 py-4">{offering.syllabusVersion || "-"}</td>
                            <td className="px-5 py-4">
                              <Badge variant={offering.status === "ACTIVE" ? "success" : "neutral"}>
                                {offering.status || "-"}
                              </Badge>
                            </td>
                            <td className="px-5 py-4">{formatDate(offering.updatedAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
