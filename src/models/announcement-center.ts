import { authHeaders } from "@/models/rbac";

interface AnnouncementActorInfo {
  userId: string;
  role: string;
  name: string;
  email: string;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  message: string;
  targetLabel: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt: string;
  author: AnnouncementActorInfo;
  lastUpdatedBy: AnnouncementActorInfo;
  deletedByInfo: AnnouncementActorInfo;
  canEdit: boolean;
  canDelete: boolean;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toIsoDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toActorInfo(value: unknown): AnnouncementActorInfo {
  const row = asObject(value);
  return {
    userId: collapseSpaces(row?.userId),
    role: collapseSpaces(row?.role),
    name: collapseSpaces(row?.name),
    email: collapseSpaces(row?.email).toLowerCase(),
  };
}

function toAnnouncementRecord(value: unknown): AnnouncementRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = collapseSpaces(row.id ?? row._id);
  const title = collapseSpaces(row.title).slice(0, 180);
  const message = collapseSpaces(row.message).slice(0, 3000);
  const targetLabel =
    collapseSpaces(row.targetLabel || "All users").slice(0, 140) || "All users";
  const createdBy = collapseSpaces(row.createdBy || "User").slice(0, 120) || "User";
  const createdAt = toIsoDate(row.createdAt);
  const updatedAt = toIsoDate(row.updatedAt);
  const isDeleted = row.isDeleted === true;
  const deletedAt = toIsoDate(row.deletedAt);
  const author = toActorInfo(row.author);
  const lastUpdatedBy = toActorInfo(row.lastUpdatedBy);
  const deletedByInfo = toActorInfo(row.deletedByInfo);
  const canEdit = row.canEdit === true;
  const canDelete = row.canDelete === true;

  if (!id || !title || !message || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    title,
    message,
    targetLabel,
    createdBy,
    createdAt,
    updatedAt,
    isDeleted,
    deletedAt,
    author,
    lastUpdatedBy,
    deletedByInfo,
    canEdit,
    canDelete,
  };
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
  return payload as T;
}

function requestHeaders() {
  return {
    "Content-Type": "application/json",
    ...authHeaders(),
  } as Record<string, string>;
}

export async function listAnnouncements(options?: {
  limit?: number;
  includeDeleted?: boolean;
}) {
  const params = new URLSearchParams();
  if (typeof options?.limit === "number" && Number.isFinite(options.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(options.limit))));
  }
  if (options?.includeDeleted === true) {
    params.set("includeDeleted", "true");
  }

  const query = params.toString();
  const endpoint = query ? `/api/announcements?${query}` : "/api/announcements";
  const payload = await readJson<{ items?: unknown[] }>(
    await fetch(endpoint, {
      cache: "no-store",
      headers: {
        ...authHeaders(),
      },
    })
  );

  const rows = Array.isArray(payload?.items) ? payload.items : [];
  return rows
    .map((item) => toAnnouncementRecord(item))
    .filter((item): item is AnnouncementRecord => Boolean(item));
}

export async function listLatestAnnouncements(limit = 3) {
  return listAnnouncements({ limit });
}

export async function createAnnouncement(input: {
  title: string;
  message: string;
  targetLabel?: string;
}) {
  const payload = await readJson<{ item?: unknown }>(
    await fetch("/api/announcements", {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({
        title: collapseSpaces(input.title),
        message: collapseSpaces(input.message),
        targetLabel: collapseSpaces(input.targetLabel || "All users"),
      }),
    })
  );

  const record = toAnnouncementRecord(payload?.item);
  if (!record) {
    throw new Error("Failed to map announcement");
  }
  return record;
}

export async function updateAnnouncement(
  announcementId: string,
  input: {
    title?: string;
    message?: string;
    targetLabel?: string;
  }
) {
  const id = encodeURIComponent(collapseSpaces(announcementId));
  if (!id) {
    throw new Error("Announcement id is required");
  }

  const payload = await readJson<{ item?: unknown }>(
    await fetch(`/api/announcements/${id}`, {
      method: "PUT",
      headers: requestHeaders(),
      body: JSON.stringify({
        title:
          input.title !== undefined ? collapseSpaces(input.title).slice(0, 180) : undefined,
        message:
          input.message !== undefined
            ? collapseSpaces(input.message).slice(0, 3000)
            : undefined,
        targetLabel:
          input.targetLabel !== undefined
            ? collapseSpaces(input.targetLabel).slice(0, 140)
            : undefined,
      }),
    })
  );

  const record = toAnnouncementRecord(payload?.item);
  if (!record) {
    throw new Error("Failed to map announcement");
  }
  return record;
}

export async function deleteAnnouncement(announcementId: string) {
  const id = encodeURIComponent(collapseSpaces(announcementId));
  if (!id) {
    throw new Error("Announcement id is required");
  }

  const payload = await readJson<{ item?: unknown; ok?: boolean }>(
    await fetch(`/api/announcements/${id}`, {
      method: "DELETE",
      headers: {
        ...authHeaders(),
      },
    })
  );

  if (payload.ok !== true) {
    throw new Error("Failed to delete announcement");
  }

  const record = toAnnouncementRecord(payload.item);
  if (!record) {
    throw new Error("Failed to map announcement");
  }
  return record;
}
