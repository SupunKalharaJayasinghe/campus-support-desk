export type AdminActionType =
  | "General"
  | "Academic"
  | "Security"
  | "Notifications"
  | "Branding";

export type AdminAuditStatus = "Success" | "Warning";

export interface AdminGeneralSettings {
  campusName: string;
  timezone: string;
  academicYear: string;
  maintenanceMode: boolean;
}

export interface AdminAcademicSettings {
  semesterNaming: string;
  creditsMin: string;
  creditsMax: string;
  programCodeFormat: string;
  moduleCodePrefix: string;
}

export interface AdminSecuritySettings {
  uiDemoMode: boolean;
  passwordPolicy: string;
  sessionTimeout: string;
  allowCampusEmail: boolean;
  allowCampusId: boolean;
}

export interface AdminNotificationSettings {
  senderName: string;
  enableEmail: boolean;
  enableInApp: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface AdminBrandingSettings {
  logoFileName: string;
  primaryAccent: string;
  footerText: string;
}

export interface AdminAuditLog {
  id: string;
  date: string;
  timestamp: string;
  actor: string;
  action: string;
  actionType: AdminActionType;
  target: string;
  status: AdminAuditStatus;
}

export interface AdminSettingsRecord {
  general: AdminGeneralSettings;
  academic: AdminAcademicSettings;
  security: AdminSecuritySettings;
  notificationPrefs: AdminNotificationSettings;
  branding: AdminBrandingSettings;
  auditLogs: AdminAuditLog[];
}

export const ADMIN_SETTINGS_PORTAL_KEY = "admin-settings";

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function sanitizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeColor(value: unknown, fallback: string) {
  const normalized = String(value ?? "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized : fallback;
}

function sanitizeTime(value: unknown, fallback: string) {
  const normalized = String(value ?? "").trim();
  return /^\d{2}:\d{2}$/.test(normalized) ? normalized : fallback;
}

function sanitizeActionType(value: unknown): AdminActionType {
  const normalized = collapseSpaces(value);
  if (normalized === "Academic") return "Academic";
  if (normalized === "Security") return "Security";
  if (normalized === "Notifications") return "Notifications";
  if (normalized === "Branding") return "Branding";
  return "General";
}

function sanitizeAuditStatus(value: unknown): AdminAuditStatus {
  return collapseSpaces(value) === "Warning" ? "Warning" : "Success";
}

export function createDefaultAdminSettings(): AdminSettingsRecord {
  return {
    general: {
      campusName: "",
      timezone: "Asia/Colombo",
      academicYear: "",
      maintenanceMode: false,
    },
    academic: {
      semesterNaming: "semester",
      creditsMin: "",
      creditsMax: "",
      programCodeFormat: "",
      moduleCodePrefix: "",
    },
    security: {
      uiDemoMode: false,
      passwordPolicy: "Standard",
      sessionTimeout: "1h",
      allowCampusEmail: true,
      allowCampusId: true,
    },
    notificationPrefs: {
      senderName: "",
      enableEmail: true,
      enableInApp: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "06:00",
    },
    branding: {
      logoFileName: "",
      primaryAccent: "#034AA6",
      footerText: "",
    },
    auditLogs: [],
  };
}

export function normalizeAdminSettings(value: unknown): AdminSettingsRecord {
  const defaults = createDefaultAdminSettings();
  const root = asObject(value);
  const general = asObject(root?.general);
  const academic = asObject(root?.academic);
  const security = asObject(root?.security);
  const notificationPrefs = asObject(root?.notificationPrefs);
  const branding = asObject(root?.branding);
  const auditLogs = Array.isArray(root?.auditLogs) ? root?.auditLogs : [];

  return {
    general: {
      campusName: collapseSpaces(general?.campusName),
      timezone: collapseSpaces(general?.timezone) || defaults.general.timezone,
      academicYear: collapseSpaces(general?.academicYear),
      maintenanceMode: sanitizeBoolean(
        general?.maintenanceMode,
        defaults.general.maintenanceMode
      ),
    },
    academic: {
      semesterNaming:
        collapseSpaces(academic?.semesterNaming) || defaults.academic.semesterNaming,
      creditsMin: collapseSpaces(academic?.creditsMin),
      creditsMax: collapseSpaces(academic?.creditsMax),
      programCodeFormat: collapseSpaces(academic?.programCodeFormat),
      moduleCodePrefix: collapseSpaces(academic?.moduleCodePrefix).toUpperCase(),
    },
    security: {
      uiDemoMode: sanitizeBoolean(security?.uiDemoMode, defaults.security.uiDemoMode),
      passwordPolicy:
        collapseSpaces(security?.passwordPolicy) || defaults.security.passwordPolicy,
      sessionTimeout:
        collapseSpaces(security?.sessionTimeout) || defaults.security.sessionTimeout,
      allowCampusEmail: sanitizeBoolean(
        security?.allowCampusEmail,
        defaults.security.allowCampusEmail
      ),
      allowCampusId: sanitizeBoolean(
        security?.allowCampusId,
        defaults.security.allowCampusId
      ),
    },
    notificationPrefs: {
      senderName: collapseSpaces(notificationPrefs?.senderName),
      enableEmail: sanitizeBoolean(
        notificationPrefs?.enableEmail,
        defaults.notificationPrefs.enableEmail
      ),
      enableInApp: sanitizeBoolean(
        notificationPrefs?.enableInApp,
        defaults.notificationPrefs.enableInApp
      ),
      quietHoursStart: sanitizeTime(
        notificationPrefs?.quietHoursStart,
        defaults.notificationPrefs.quietHoursStart
      ),
      quietHoursEnd: sanitizeTime(
        notificationPrefs?.quietHoursEnd,
        defaults.notificationPrefs.quietHoursEnd
      ),
    },
    branding: {
      logoFileName: collapseSpaces(branding?.logoFileName),
      primaryAccent: sanitizeColor(
        branding?.primaryAccent,
        defaults.branding.primaryAccent
      ),
      footerText: collapseSpaces(branding?.footerText),
    },
    auditLogs: auditLogs
      .map((item) => {
        const row = asObject(item);
        if (!row) {
          return null;
        }

        const id = collapseSpaces(row.id);
        const date = collapseSpaces(row.date);
        const timestamp = collapseSpaces(row.timestamp);
        const actor = collapseSpaces(row.actor);
        const action = collapseSpaces(row.action);
        const target = collapseSpaces(row.target);

        if (!id || !date || !timestamp || !actor || !action || !target) {
          return null;
        }

        return {
          id,
          date,
          timestamp,
          actor,
          action,
          actionType: sanitizeActionType(row.actionType),
          target,
          status: sanitizeAuditStatus(row.status),
        } satisfies AdminAuditLog;
      })
      .filter((item): item is AdminAuditLog => Boolean(item))
      .slice(0, 250),
  };
}
