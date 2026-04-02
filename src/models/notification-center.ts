import { PORTAL_DATA_KEYS, loadPortalData } from "@/models/portal-data";
import type { AppRole, DemoUser } from "@/models/rbac";

export type NotificationFeedType = "Announcement" | "System";
export type SemesterCode =
  | "Y1S1"
  | "Y1S2"
  | "Y2S1"
  | "Y2S2"
  | "Y3S1"
  | "Y3S2"
  | "Y4S1"
  | "Y4S2";
export type StreamCode = "WEEKDAY" | "WEEKEND";

export interface NotificationAudience {
  roles: AppRole[];
  facultyCodes?: string[];
  degreeCodes?: string[];
  semesterCodes?: SemesterCode[];
  streamCodes?: StreamCode[];
  intakeIds?: string[];
  subgroupCodes?: string[];
}

export interface NotificationFeedItem {
  id: string;
  type: NotificationFeedType;
  title: string;
  message: string;
  time: string;
  publishedAt: string;
  unread: boolean;
  targetLabel: string;
  audience: NotificationAudience;
}

export interface NotificationViewer {
  role: AppRole;
  facultyCodes?: string[];
  degreeProgramIds?: string[];
  semesterCode?: string;
  stream?: string;
  intakeId?: string;
  subgroup?: string | null;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function asRoleArray(value: unknown) {
  const values = asStringArray(value)
    .map((item) => item.toUpperCase())
    .filter(
      (item): item is AppRole =>
        item === "SUPER_ADMIN" ||
        item === "LECTURER" ||
        item === "LOST_ITEM_STAFF" ||
        item === "STUDENT"
    );

  return values;
}

function normalizeAudience(input: unknown): NotificationAudience {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { roles: [] };
  }

  const row = input as Record<string, unknown>;

  return {
    roles: asRoleArray(row.roles),
    facultyCodes: asStringArray(row.facultyCodes).map((item) => item.toUpperCase()),
    degreeCodes: asStringArray(row.degreeCodes).map((item) => item.toUpperCase()),
    semesterCodes: asStringArray(row.semesterCodes).map(
      (item) => item.toUpperCase() as SemesterCode
    ),
    streamCodes: asStringArray(row.streamCodes).map(
      (item) => item.toUpperCase() as StreamCode
    ),
    intakeIds: asStringArray(row.intakeIds),
    subgroupCodes: asStringArray(row.subgroupCodes),
  };
}

function toRelativeTime(publishedAt: string) {
  const parsed = new Date(publishedAt);
  if (Number.isNaN(parsed.getTime())) {
    return "Just now";
  }

  const diffMs = Date.now() - parsed.getTime();
  if (diffMs <= 0) {
    return "Just now";
  }

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function normalizeFeedItem(value: unknown, index: number): NotificationFeedItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = String(row.id ?? "").trim() || `notification-${index + 1}`;
  const title = String(row.title ?? "").trim();
  const message = String(row.message ?? "").trim();

  if (!title || !message) {
    return null;
  }

  const typeRaw = String(row.type ?? "Announcement").trim();
  const type: NotificationFeedType =
    typeRaw === "System" ? "System" : "Announcement";

  const publishedAtRaw = String(row.publishedAt ?? "").trim();
  const publishedAt = publishedAtRaw || new Date().toISOString();
  const audience = normalizeAudience(row.audience);
  if (audience.roles.length === 0) {
    audience.roles = ["SUPER_ADMIN", "LECTURER", "LOST_ITEM_STAFF", "STUDENT"];
  }

  return {
    id,
    type,
    title,
    message,
    publishedAt,
    time: String(row.time ?? "").trim() || toRelativeTime(publishedAt),
    unread: row.unread !== false,
    targetLabel: String(row.targetLabel ?? "All Users").trim() || "All Users",
    audience,
  };
}

function matchCodeList(left: string[], right: string[]) {
  const rightSet = new Set(right.map((value) => normalizeCode(value)));
  return left.some((value) => rightSet.has(normalizeCode(value)));
}

function matchesAudience(item: NotificationFeedItem, viewer: NotificationViewer) {
  if (!item.audience.roles.includes(viewer.role)) {
    return false;
  }

  if (item.audience.facultyCodes?.length) {
    if (!viewer.facultyCodes?.length) {
      return false;
    }
    if (!matchCodeList(viewer.facultyCodes, item.audience.facultyCodes)) {
      return false;
    }
  }

  if (item.audience.degreeCodes?.length) {
    if (!viewer.degreeProgramIds?.length) {
      return false;
    }
    if (!matchCodeList(viewer.degreeProgramIds, item.audience.degreeCodes)) {
      return false;
    }
  }

  if (item.audience.semesterCodes?.length) {
    const viewerSemester = String(viewer.semesterCode ?? "")
      .trim()
      .toUpperCase();
    if (!viewerSemester) {
      return false;
    }
    if (!item.audience.semesterCodes.includes(viewerSemester as SemesterCode)) {
      return false;
    }
  }

  if (item.audience.streamCodes?.length) {
    const viewerStream = String(viewer.stream ?? "")
      .trim()
      .toUpperCase();
    if (!viewerStream) {
      return false;
    }
    if (!item.audience.streamCodes.includes(viewerStream as StreamCode)) {
      return false;
    }
  }

  if (item.audience.intakeIds?.length) {
    const intakeId = String(viewer.intakeId ?? "").trim();
    if (!intakeId) {
      return false;
    }
    if (!item.audience.intakeIds.includes(intakeId)) {
      return false;
    }
  }

  if (item.audience.subgroupCodes?.length) {
    const viewerSubgroup = String(viewer.subgroup ?? "").trim();
    if (!viewerSubgroup) {
      return false;
    }
    if (!item.audience.subgroupCodes.includes(viewerSubgroup)) {
      return false;
    }
  }

  return true;
}

function toViewerFromUser(user: DemoUser, fallbackRole?: AppRole): NotificationViewer {
  return {
    role: user.role || fallbackRole || "STUDENT",
    facultyCodes: user.facultyCodes ?? [],
    degreeProgramIds: user.degreeProgramIds ?? [],
    semesterCode: user.semesterCode,
    stream: user.stream,
    intakeId: user.intakeId,
    subgroup: user.subgroup,
  };
}

async function listNotificationFeed() {
  const rows = await loadPortalData<unknown[]>(PORTAL_DATA_KEYS.notificationFeed, []);
  return rows
    .map((row, index) => normalizeFeedItem(row, index))
    .filter((row): row is NotificationFeedItem => Boolean(row));
}

export function resolveNotificationsForViewer(
  feed: NotificationFeedItem[],
  viewer: NotificationViewer
) {
  return feed
    .filter((item) => matchesAudience(item, viewer))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .map((item) => ({
      ...item,
      time: item.time || toRelativeTime(item.publishedAt),
    }));
}

export async function listNotificationsForViewer(viewer: NotificationViewer) {
  const feed = await listNotificationFeed();
  return resolveNotificationsForViewer(feed, viewer);
}

export async function listNotificationsForUser(
  user: DemoUser | null,
  fallbackRole: AppRole
) {
  const viewer = user
    ? toViewerFromUser(user, fallbackRole)
    : ({ role: fallbackRole } as NotificationViewer);

  return listNotificationsForViewer(viewer);
}

export async function listNotificationsForRole(role: AppRole) {
  return listNotificationsForViewer({ role });
}
