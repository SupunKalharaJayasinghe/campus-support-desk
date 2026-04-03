"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ClipboardList,
  Download,
  Palette,
  RefreshCw,
  Settings2,
  ShieldCheck,
  University,
} from "lucide-react";
import TablePagination from "@/components/admin/TablePagination";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createDefaultAdminSettings,
  normalizeAdminSettings,
  type AdminSettingsRecord,
} from "@/lib/admin-settings";
import { authHeaders, readStoredUser } from "@/models/rbac";

const SETTINGS_SECTIONS = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "academic", label: "Academic Defaults", icon: University },
  { id: "security", label: "Security & Access", icon: ShieldCheck },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "audit", label: "Audit & Logs", icon: ClipboardList },
] as const;

type SettingSection = (typeof SETTINGS_SECTIONS)[number]["id"];
type PageSize = 10 | 25 | 50 | 100;

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

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-[#D9D9D9]/20 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
      {description ? (
        <p className="mt-1 text-xs text-[#26150F]/68">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  helper,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  helper?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#26150F]">{label}</p>
        {helper ? <p className="mt-1 text-xs text-[#26150F]/68">{helper}</p> : null}
      </div>
      <button
        aria-pressed={checked}
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full border transition-colors duration-200",
          checked
            ? "border-[#034AA6]/45 bg-[#034AA6]/20"
            : "border-black/15 bg-white"
        )}
        onClick={() => onChange(!checked)}
        type="button"
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const defaults = useMemo(() => createDefaultAdminSettings(), []);
  const [activeSection, setActiveSection] = useState<SettingSection>("general");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [general, setGeneral] = useState(defaults.general);
  const [academic, setAcademic] = useState(defaults.academic);
  const [security, setSecurity] = useState(defaults.security);
  const [notificationPrefs, setNotificationPrefs] = useState(defaults.notificationPrefs);
  const [branding, setBranding] = useState(defaults.branding);
  const [auditLogs, setAuditLogs] = useState(defaults.auditLogs);

  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionType, setAuditActionType] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [auditPageSize, setAuditPageSize] = useState<PageSize>(10);
  const [auditPage, setAuditPage] = useState(1);

  const activeSectionMeta = SETTINGS_SECTIONS.find(
    (section) => section.id === activeSection
  );

  const applySettings = (settings: AdminSettingsRecord) => {
    setGeneral(settings.general);
    setAcademic(settings.academic);
    setSecurity(settings.security);
    setNotificationPrefs(settings.notificationPrefs);
    setBranding(settings.branding);
    setAuditLogs(settings.auditLogs);
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      try {
        const payload = await readJson<{ value?: unknown }>(
          await fetch("/api/admin/settings", {
            cache: "no-store",
            headers: {
              ...authHeaders(),
            },
          })
        );
        if (cancelled) {
          return;
        }
        applySettings(normalizeAdminSettings(payload.value));
        setLoadError("");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadError(
          error instanceof Error ? error.message : "Failed to load settings from the database."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAuditPage(1);
  }, [auditSearch, auditActionType, auditDateFrom, auditDateTo]);

  const filteredAuditLogs = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const lookup = `${log.actor} ${log.action} ${log.target}`.toLowerCase();
      if (query && !lookup.includes(query)) return false;
      if (auditActionType && log.actionType !== auditActionType) return false;
      if (auditDateFrom && log.date < auditDateFrom) return false;
      if (auditDateTo && log.date > auditDateTo) return false;
      return true;
    });
  }, [auditActionType, auditDateFrom, auditDateTo, auditLogs, auditSearch]);

  const handleReset = async () => {
    if (activeSection === "audit") {
      setAuditSearch("");
      setAuditActionType("");
      setAuditDateFrom("");
      setAuditDateTo("");
      toast({
        title: "Filters cleared",
        message: "Audit filters were cleared.",
        variant: "info",
      });
      return;
    }

    setIsSaving(true);
    try {
      const currentUser = readStoredUser();
      const payload = await readJson<{ value?: unknown }>(
        await fetch(`/api/admin/settings?section=${encodeURIComponent(activeSection)}`, {
          method: "DELETE",
          headers: {
            ...authHeaders(),
            "x-user-name": currentUser?.name ?? "",
          },
        })
      );
      applySettings(normalizeAdminSettings(payload.value));
      setLoadError("");
      toast({
        title: "Reset complete",
        message: `${activeSectionMeta?.label ?? "Section"} was restored from the database defaults.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to reset settings.",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const currentUser = readStoredUser();
      const payload = await readJson<{ value?: unknown }>(
        await fetch("/api/admin/settings", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
            "x-user-name": currentUser?.name ?? "",
          },
          body: JSON.stringify({
            general,
            academic,
            security,
            notificationPrefs,
            branding,
            section: activeSection,
            actorName: currentUser?.name ?? "",
          }),
        })
      );

      applySettings(normalizeAdminSettings(payload.value));
      setLoadError("");
      toast({
        title: "Saved",
        message: "Settings updated successfully.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to save settings.",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCsv = () => {
    if (filteredAuditLogs.length === 0) {
      toast({
        title: "Nothing to export",
        message: "There are no audit rows for the selected filters.",
        variant: "info",
      });
      return;
    }

    const lines = [
      ["Timestamp", "Actor", "Action", "Action Type", "Target", "Status"].join(","),
      ...filteredAuditLogs.map((log) =>
        [
          `"${log.timestamp.replace(/"/g, '""')}"`,
          `"${log.actor.replace(/"/g, '""')}"`,
          `"${log.action.replace(/"/g, '""')}"`,
          `"${log.actionType.replace(/"/g, '""')}"`,
          `"${log.target.replace(/"/g, '""')}"`,
          `"${log.status.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-audit-logs.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const sectionDescription: Record<SettingSection, string> = {
    general: "Update core campus platform settings and operational defaults.",
    academic: "Set baseline academic formatting and code conventions.",
    security: "Manage access rules, session policy, and testing controls.",
    notifications: "Configure communication channels and quiet hour behavior.",
    branding: "Customize platform identity and footer presentation.",
    audit: "Review recent admin actions and export monitoring logs.",
  };

  const renderSectionContent = () => {
    const auditPageCount = Math.max(1, Math.ceil(filteredAuditLogs.length / auditPageSize));
    const safeAuditPage = Math.min(auditPage, auditPageCount);
    const visibleAuditLogs = filteredAuditLogs.slice(
      (safeAuditPage - 1) * auditPageSize,
      safeAuditPage * auditPageSize
    );

    if (isLoading) {
      return (
        <div className="rounded-2xl border border-black/10 bg-[#D9D9D9]/20 px-4 py-6 text-sm text-[#26150F]/70">
          Loading settings from the database...
        </div>
      );
    }

    if (activeSection === "general") {
      return (
        <div className="space-y-4">
          <SectionBlock title="Campus Profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="campus-name">
                  Campus Name
                </label>
                <Input
                  className="mt-1 h-11 rounded-xl"
                  id="campus-name"
                  onChange={(event) =>
                    setGeneral((prev) => ({ ...prev, campusName: event.target.value }))
                  }
                  value={general.campusName}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="general-timezone">
                  Timezone
                </label>
                <Select
                  className="mt-1 h-11 rounded-xl"
                  id="general-timezone"
                  onChange={(event) =>
                    setGeneral((prev) => ({ ...prev, timezone: event.target.value }))
                  }
                  value={general.timezone}
                >
                  <option value="Asia/Colombo">Asia/Colombo</option>
                  <option value="Asia/Singapore">Asia/Singapore</option>
                  <option value="UTC">UTC</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="academic-year">
                  Academic Year
                </label>
                <Select
                  className="mt-1 h-11 rounded-xl"
                  id="academic-year"
                  onChange={(event) =>
                    setGeneral((prev) => ({ ...prev, academicYear: event.target.value }))
                  }
                  value={general.academicYear}
                >
                  <option value="">Not set</option>
                  <option value="2024/2025">2024/2025</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                </Select>
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="System Availability">
            <Toggle
              checked={general.maintenanceMode}
              helper={
                general.maintenanceMode
                  ? "Students and staff will see a maintenance message."
                  : "Platform remains available for all roles."
              }
              label="Maintenance Mode"
              onChange={(next) =>
                setGeneral((prev) => ({ ...prev, maintenanceMode: next }))
              }
            />
          </SectionBlock>
        </div>
      );
    }

    if (activeSection === "academic") {
      return (
        <div className="space-y-4">
          <SectionBlock title="Semester Configuration">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[#26150F]">
                <input
                  checked={academic.semesterNaming === "semester"}
                  className="h-4 w-4 rounded border-black/20 text-[#034AA6] focus:ring-[#034AA6]/30"
                  onChange={() =>
                    setAcademic((prev) => ({ ...prev, semesterNaming: "semester" }))
                  }
                  type="radio"
                />
                Semester 1 / Semester 2
              </label>
              <label className="flex items-center gap-2 text-sm text-[#26150F]">
                <input
                  checked={academic.semesterNaming === "fall_spring"}
                  className="h-4 w-4 rounded border-black/20 text-[#034AA6] focus:ring-[#034AA6]/30"
                  onChange={() =>
                    setAcademic((prev) => ({ ...prev, semesterNaming: "fall_spring" }))
                  }
                  type="radio"
                />
                Fall / Spring
              </label>
            </div>
          </SectionBlock>

          <SectionBlock title="Credit and Code Defaults">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="credits-min">
                  Default Credits (Min)
                </label>
                <Input
                  className="mt-1 h-11 rounded-xl"
                  id="credits-min"
                  min="0"
                  onChange={(event) =>
                    setAcademic((prev) => ({ ...prev, creditsMin: event.target.value }))
                  }
                  type="number"
                  value={academic.creditsMin}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="credits-max">
                  Default Credits (Max)
                </label>
                <Input
                  className="mt-1 h-11 rounded-xl"
                  id="credits-max"
                  min="0"
                  onChange={(event) =>
                    setAcademic((prev) => ({ ...prev, creditsMax: event.target.value }))
                  }
                  type="number"
                  value={academic.creditsMax}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="program-format">
                  Program Code Format
                </label>
                <Input
                  className="mt-1 h-11 rounded-xl"
                  id="program-format"
                  onChange={(event) =>
                    setAcademic((prev) => ({
                      ...prev,
                      programCodeFormat: event.target.value,
                    }))
                  }
                  value={academic.programCodeFormat}
                />
                <p className="mt-1 text-xs text-[#26150F]/66">
                  Example preview: {academic.programCodeFormat}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="module-prefix">
                  Module Code Prefix
                </label>
                <Input
                  className="mt-1 h-11 rounded-xl"
                  id="module-prefix"
                  onChange={(event) =>
                    setAcademic((prev) => ({
                      ...prev,
                      moduleCodePrefix: event.target.value.toUpperCase(),
                    }))
                  }
                  value={academic.moduleCodePrefix}
                />
                <p className="mt-1 text-xs text-[#26150F]/66">
                  Example: {academic.moduleCodePrefix || "CS"}-10320
                </p>
              </div>
            </div>
          </SectionBlock>
        </div>
      );
    }

    if (activeSection === "security") {
      return (
        <div className="space-y-4">
          <SectionBlock title="Access Control">
            <div className="space-y-4">
              <Toggle
                checked={security.uiDemoMode}
                helper="Bypass role guard redirects for UI testing."
                label="UI Demo Mode"
                onChange={(next) =>
                  setSecurity((prev) => ({ ...prev, uiDemoMode: next }))
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="password-policy">
                    Password Policy
                  </label>
                  <Select
                    className="mt-1 h-11 rounded-xl"
                    id="password-policy"
                    onChange={(event) =>
                      setSecurity((prev) => ({
                        ...prev,
                        passwordPolicy: event.target.value,
                      }))
                    }
                    value={security.passwordPolicy}
                  >
                    <option value="Simple">Simple</option>
                    <option value="Standard">Standard</option>
                    <option value="Strong">Strong</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="session-timeout">
                    Session Timeout
                  </label>
                  <Select
                    className="mt-1 h-11 rounded-xl"
                    id="session-timeout"
                    onChange={(event) =>
                      setSecurity((prev) => ({
                        ...prev,
                        sessionTimeout: event.target.value,
                      }))
                    }
                    value={security.sessionTimeout}
                  >
                    <option value="15m">15m</option>
                    <option value="30m">30m</option>
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                  </Select>
                </div>
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="Allowed Login Identifier">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[#26150F]">
                <input
                  checked={security.allowCampusEmail}
                  className="h-4 w-4 rounded border-black/20 text-[#034AA6] focus:ring-[#034AA6]/30"
                  onChange={(event) =>
                    setSecurity((prev) => ({
                      ...prev,
                      allowCampusEmail: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Campus Email
              </label>
              <label className="flex items-center gap-2 text-sm text-[#26150F]">
                <input
                  checked={security.allowCampusId}
                  className="h-4 w-4 rounded border-black/20 text-[#034AA6] focus:ring-[#034AA6]/30"
                  onChange={(event) =>
                    setSecurity((prev) => ({
                      ...prev,
                      allowCampusId: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Campus ID
              </label>
            </div>
          </SectionBlock>
        </div>
      );
    }

    if (activeSection === "notifications") {
      return (
        <div className="space-y-4">
          <SectionBlock title="Delivery Defaults">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-[#26150F]" htmlFor="sender-name">
                  Default Sender Name
                </label>
                <Input
                  className="mt-1 h-11 rounded-xl"
                  id="sender-name"
                  onChange={(event) =>
                    setNotificationPrefs((prev) => ({
                      ...prev,
                      senderName: event.target.value,
                    }))
                  }
                  value={notificationPrefs.senderName}
                />
              </div>
              <div className="sm:col-span-2 space-y-4">
                <Toggle
                  checked={notificationPrefs.enableEmail}
                  label="Enable Email Notifications"
                  onChange={(next) =>
                    setNotificationPrefs((prev) => ({ ...prev, enableEmail: next }))
                  }
                />
                <Toggle
                  checked={notificationPrefs.enableInApp}
                  label="Enable In-App Notifications"
                  onChange={(next) =>
                    setNotificationPrefs((prev) => ({ ...prev, enableInApp: next }))
                  }
                />
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="Quiet Hours">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="quiet-start">
                  Start Time
                </label>
                <Input
                  className="mt-1 h-11 rounded-xl"
                  id="quiet-start"
                  onChange={(event) =>
                    setNotificationPrefs((prev) => ({
                      ...prev,
                      quietHoursStart: event.target.value,
                    }))
                  }
                  type="time"
                  value={notificationPrefs.quietHoursStart}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="quiet-end">
                  End Time
                </label>
                <Input
                  className="mt-1 h-11 rounded-xl"
                  id="quiet-end"
                  onChange={(event) =>
                    setNotificationPrefs((prev) => ({
                      ...prev,
                      quietHoursEnd: event.target.value,
                    }))
                  }
                  type="time"
                  value={notificationPrefs.quietHoursEnd}
                />
              </div>
            </div>
          </SectionBlock>
        </div>
      );
    }

    if (activeSection === "branding") {
      return (
        <div className="space-y-4">
          <SectionBlock title="University Identity">
            <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-black/20 bg-white text-sm text-[#26150F]/65">
                {branding.logoFileName ? branding.logoFileName : "Logo Preview"}
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-[#26150F]" htmlFor="logo-upload">
                  University Logo
                </label>
                <input
                  className="hidden"
                  id="logo-upload"
                  onChange={(event) => {
                    const fileName = event.target.files?.[0]?.name ?? "";
                    setBranding((prev) => ({ ...prev, logoFileName: fileName }));
                  }}
                  type="file"
                />
                <label
                  className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-black/20 bg-white px-4 text-sm text-[#26150F] transition-colors hover:border-[#0339A6]/55 hover:text-[#0339A6]"
                  htmlFor="logo-upload"
                >
                  Select File
                </label>
                <p className="text-xs text-[#26150F]/64">
                  The selected logo filename is saved to the database. Binary asset upload is not handled on this screen.
                </p>
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="Theme and Footer">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="accent-color">
                  Primary Accent Color
                </label>
                <div className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-black/15 bg-white px-3">
                  <input
                    className="h-7 w-10 rounded border border-black/10 bg-transparent"
                    id="accent-color"
                    onChange={(event) =>
                      setBranding((prev) => ({
                        ...prev,
                        primaryAccent: event.target.value,
                      }))
                    }
                    type="color"
                    value={branding.primaryAccent}
                  />
                  <span className="text-sm text-[#26150F]/78">{branding.primaryAccent}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="footer-text">
                  Footer Text
                </label>
                <Input
                  className="mt-1 h-11 rounded-xl"
                  id="footer-text"
                  onChange={(event) =>
                    setBranding((prev) => ({ ...prev, footerText: event.target.value }))
                  }
                  value={branding.footerText}
                />
              </div>
            </div>
          </SectionBlock>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <SectionBlock title="Audit Filters">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="w-full lg:flex-1">
              <Input
                className="h-11 rounded-xl"
                onChange={(event) => setAuditSearch(event.target.value)}
                placeholder="Search actor, action, or target..."
                value={auditSearch}
              />
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <Select
                className="h-11 rounded-xl sm:w-44"
                onChange={(event) => setAuditActionType(event.target.value)}
                value={auditActionType}
              >
                <option value="">All Action Types</option>
                <option value="General">General</option>
                <option value="Academic">Academic</option>
                <option value="Security">Security</option>
                <option value="Notifications">Notifications</option>
                <option value="Branding">Branding</option>
              </Select>
              <Input
                className="h-11 rounded-xl sm:w-40"
                onChange={(event) => setAuditDateFrom(event.target.value)}
                type="date"
                value={auditDateFrom}
              />
              <Input
                className="h-11 rounded-xl sm:w-40"
                onChange={(event) => setAuditDateTo(event.target.value)}
                type="date"
                value={auditDateTo}
              />
              <Button
                className="h-11 rounded-xl border-black/20 bg-white text-[#26150F] hover:border-[#0339A6]/55 hover:bg-[#034AA6]/5 hover:text-[#0339A6]"
                onClick={handleExportCsv}
                type="button"
                variant="secondary"
              >
                <Download size={15} />
                <span className="ml-1">Export CSV</span>
              </Button>
            </div>
          </div>
        </SectionBlock>

        <div className="overflow-hidden rounded-2xl border border-black/12 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-black/10 bg-[#034AA6]/6">
                <tr className="text-left text-xs uppercase tracking-[0.08em] text-[#26150F]/72">
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleAuditLogs.map((log) => (
                  <tr
                    className="border-b border-black/8 text-sm text-[#26150F] transition-colors hover:bg-[#034AA6]/4"
                    key={log.id}
                  >
                    <td className="px-4 py-3 text-[#26150F]/78">{log.timestamp}</td>
                    <td className="px-4 py-3 font-medium text-[#0A0A0A]">{log.actor}</td>
                    <td className="px-4 py-3">{log.action}</td>
                    <td className="px-4 py-3 text-[#26150F]/78">{log.target}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                          log.status === "Success"
                            ? "border-[#034AA6]/25 bg-[#034AA6]/10 text-[#034AA6]"
                            : "border-black/15 bg-black/5 text-[#26150F]/78"
                        )}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {visibleAuditLogs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-[#26150F]/70" colSpan={5}>
                      No logs match the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <TablePagination
          onPageChange={setAuditPage}
          onPageSizeChange={(value) => {
            setAuditPageSize(value as PageSize);
            setAuditPage(1);
          }}
          page={safeAuditPage}
          pageCount={auditPageCount}
          pageSize={auditPageSize}
          totalItems={filteredAuditLogs.length}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-[#0A0A0A]">Settings</h1>
        <p className="mt-1 text-sm text-[#26150F]/75">
          Manage system preferences, security, and platform defaults.
        </p>
      </section>

      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <section className="rounded-3xl border border-black/15 bg-white shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
        <div className="p-4 md:hidden">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#26150F]/58">
            Section
          </label>
          <Select
            className="mt-2 h-11 rounded-xl"
            onChange={(event) => setActiveSection(event.target.value as SettingSection)}
            value={activeSection}
          >
            {SETTINGS_SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden border-r border-black/10 p-4 md:block">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#26150F]/55">
              Settings
            </p>
            <nav className="space-y-1.5">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = activeSection === section.id;
                return (
                  <button
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200",
                      active
                        ? "border-[#034AA6]/35 bg-[#034AA6]/10 text-[#034AA6]"
                        : "border-transparent text-[#26150F]/80 hover:border-black/12 hover:bg-[#034AA6]/4 hover:text-[#0339A6]"
                    )}
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    type="button"
                  >
                    {active ? (
                      <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-[#034AA6]" />
                    ) : null}
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/5">
                      <Icon size={15} />
                    </span>
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="space-y-6 border-t border-black/10 p-4 sm:p-5 md:border-t-0 md:p-6">
            <div>
              <h2 className="text-xl font-semibold text-[#0A0A0A]">
                {activeSectionMeta?.label}
              </h2>
              <p className="mt-1 text-sm text-[#26150F]/68">
                {sectionDescription[activeSection]}
              </p>
            </div>

            {renderSectionContent()}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-5">
              <Button
                className="rounded-xl border-black/20 bg-white text-[#26150F] hover:border-[#0339A6]/55 hover:bg-[#034AA6]/5 hover:text-[#0339A6]"
                disabled={isLoading || isSaving}
                onClick={handleReset}
                type="button"
                variant="secondary"
              >
                <RefreshCw size={15} />
                <span className="ml-1">Reset</span>
              </Button>
              <Button
                className="rounded-xl bg-[#034AA6] text-[#D9D9D9] hover:bg-[#0339A6]"
                disabled={isLoading || isSaving}
                onClick={handleSave}
                type="button"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
