export interface AnnouncementRecord {
  id: string;
  title: string;
  message: string;
  targetLabel: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

function toAnnouncementRecord(value: unknown): AnnouncementRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = collapseSpaces(row.id ?? row._id);
  const title = collapseSpaces(row.title).slice(0, 180);
  const message = collapseSpaces(row.message).slice(0, 3000);
  const targetLabel = collapseSpaces(row.targetLabel || "All users").slice(0, 140) || "All users";
  const createdBy = collapseSpaces(row.createdBy || "Admin").slice(0, 120) || "Admin";
  const createdAt = toIsoDate(row.createdAt);
  const updatedAt = toIsoDate(row.updatedAt);

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

export async function listAnnouncements(options?: { limit?: number }) {
  const params = new URLSearchParams();
  if (typeof options?.limit === "number" && Number.isFinite(options.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(options.limit))));
  }

  const query = params.toString();
  const endpoint = query ? `/api/announcements?${query}` : "/api/announcements";
  const payload = await readJson<{ items?: unknown[] }>(
    await fetch(endpoint, { cache: "no-store" })
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
  createdBy?: string;
  targetLabel?: string;
}) {
  const payload = await readJson<{ item?: unknown }>(
    await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: collapseSpaces(input.title),
        message: collapseSpaces(input.message),
        createdBy: collapseSpaces(input.createdBy || "Admin"),
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
