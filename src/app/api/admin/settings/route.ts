import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import "@/models/PortalData";
import {
  ADMIN_SETTINGS_PORTAL_KEY,
  createDefaultAdminSettings,
  normalizeAdminSettings,
  type AdminActionType,
  type AdminAuditLog,
  type AdminSettingsRecord,
} from "@/lib/admin-settings";
import { connectMongoose } from "@/models/mongoose";
import { PortalDataModel } from "@/models/PortalData";

type SettingSection =
  | "general"
  | "academic"
  | "security"
  | "notifications"
  | "branding"
  | "audit";

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeSection(value: unknown): SettingSection {
  const normalized = collapseSpaces(value).toLowerCase();
  if (normalized === "academic") return "academic";
  if (normalized === "security") return "security";
  if (normalized === "notifications") return "notifications";
  if (normalized === "branding") return "branding";
  if (normalized === "audit") return "audit";
  return "general";
}

function sectionMeta(section: SettingSection): {
  label: string;
  actionType: AdminActionType;
} {
  if (section === "academic") {
    return { label: "Academic Defaults", actionType: "Academic" };
  }
  if (section === "security") {
    return { label: "Security Settings", actionType: "Security" };
  }
  if (section === "notifications") {
    return { label: "Notification Settings", actionType: "Notifications" };
  }
  if (section === "branding") {
    return { label: "Branding Settings", actionType: "Branding" };
  }
  return { label: "General Settings", actionType: "General" };
}

function createAuditLog(input: {
  actor: string;
  action: string;
  actionType: AdminActionType;
  target: string;
}): AdminAuditLog {
  const timestamp = new Date();
  return {
    id: randomUUID(),
    date: timestamp.toISOString().slice(0, 10),
    timestamp: timestamp.toLocaleString(),
    actor: collapseSpaces(input.actor) || "Admin",
    action: collapseSpaces(input.action),
    actionType: input.actionType,
    target: collapseSpaces(input.target),
    status: "Success",
  };
}

async function readStoredSettings() {
  const row = await PortalDataModel.findOne({ key: ADMIN_SETTINGS_PORTAL_KEY })
    .lean()
    .exec()
    .catch(() => null);

  if (!row) {
    const defaults = createDefaultAdminSettings();
    await PortalDataModel.findOneAndUpdate(
      { key: ADMIN_SETTINGS_PORTAL_KEY },
      {
        $set: {
          key: ADMIN_SETTINGS_PORTAL_KEY,
          value: defaults,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    )
      .lean()
      .exec()
      .catch(() => null);
    return defaults;
  }

  return normalizeAdminSettings((row as { value?: unknown }).value);
}

function mergeResetSection(
  current: AdminSettingsRecord,
  section: SettingSection
): AdminSettingsRecord {
  const defaults = createDefaultAdminSettings();
  if (section === "academic") {
    return { ...current, academic: defaults.academic };
  }
  if (section === "security") {
    return { ...current, security: defaults.security };
  }
  if (section === "notifications") {
    return { ...current, notificationPrefs: defaults.notificationPrefs };
  }
  if (section === "branding") {
    return { ...current, branding: defaults.branding };
  }
  if (section === "audit") {
    return current;
  }
  return { ...current, general: defaults.general };
}

function actorNameFromRequest(request: Request, body: Record<string, unknown> | null) {
  return (
    collapseSpaces(body?.actorName) ||
    collapseSpaces(request.headers.get("x-user-name")) ||
    collapseSpaces(request.headers.get("x-user-id")) ||
    "Admin"
  );
}

export async function GET() {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const value = await readStoredSettings();
  return NextResponse.json({ value });
}

export async function PUT(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const existing = await readStoredSettings();
  const normalized = normalizeAdminSettings(body);
  const section = sanitizeSection(body?.section);
  const meta = sectionMeta(section);
  const actor = actorNameFromRequest(request, body);

  const value: AdminSettingsRecord = {
    ...normalized,
    auditLogs: [
      createAuditLog({
        actor,
        action: `Updated ${meta.label}`,
        actionType: meta.actionType,
        target: meta.label,
      }),
      ...existing.auditLogs,
    ].slice(0, 250),
  };

  const row = await PortalDataModel.findOneAndUpdate(
    { key: ADMIN_SETTINGS_PORTAL_KEY },
    {
      $set: {
        key: ADMIN_SETTINGS_PORTAL_KEY,
        value,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
    .lean()
    .exec()
    .catch(() => null);

  if (!row) {
    return NextResponse.json({ message: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({
    value: normalizeAdminSettings((row as { value?: unknown }).value),
  });
}

export async function DELETE(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const section = sanitizeSection(url.searchParams.get("section"));
  const meta = sectionMeta(section);
  const existing = await readStoredSettings();
  const value = mergeResetSection(existing, section);
  const actor = actorNameFromRequest(request, null);

  const nextValue: AdminSettingsRecord = {
    ...value,
    auditLogs:
      section === "audit"
        ? existing.auditLogs
        : [
            createAuditLog({
              actor,
              action: `Reset ${meta.label}`,
              actionType: meta.actionType,
              target: meta.label,
            }),
            ...existing.auditLogs,
          ].slice(0, 250),
  };

  const row = await PortalDataModel.findOneAndUpdate(
    { key: ADMIN_SETTINGS_PORTAL_KEY },
    {
      $set: {
        key: ADMIN_SETTINGS_PORTAL_KEY,
        value: nextValue,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
    .lean()
    .exec()
    .catch(() => null);

  if (!row) {
    return NextResponse.json({ message: "Failed to reset settings" }, { status: 500 });
  }

  return NextResponse.json({
    value: normalizeAdminSettings((row as { value?: unknown }).value),
  });
}
