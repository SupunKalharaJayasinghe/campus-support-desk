export const PORTAL_DATA_KEYS = {
  consultationBookings: "consultation-bookings",
  lecturerAvailability: "lecturer-availability",
  discussionPosts: "discussion-posts",
  studentGamification: "student-gamification",
  lostItemReports: "lost-item-reports",
  foundItems: "found-items",
  moderationReports: "moderation-reports",
  adminMetrics: "admin-metrics",
  platformKpis: "platform-kpis",
  notificationFeed: "notification-feed",
  adminSentAnnouncements: "admin-sent-announcements",
  adminInboxNotifications: "admin-inbox-notifications",
} as const;

interface PortalDataResponse<T> {
  key: string;
  value: T | null;
}

function buildPortalDataUrl(key: string) {
  return `/api/portal-data/${encodeURIComponent(key)}`;
}

export async function loadPortalData<T>(key: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(buildPortalDataUrl(key), {
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as PortalDataResponse<T>;
    if (payload.value === null || payload.value === undefined) {
      return fallback;
    }

    return payload.value;
  } catch {
    return fallback;
  }
}

export async function savePortalData<T>(key: string, value: T): Promise<T> {
  const response = await fetch(buildPortalDataUrl(key), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    throw new Error("Failed to save data");
  }

  const payload = (await response.json()) as PortalDataResponse<T>;
  if (payload.value === null || payload.value === undefined) {
    throw new Error("Saved data payload is empty");
  }

  return payload.value;
}

export async function deletePortalData(key: string) {
  await fetch(buildPortalDataUrl(key), {
    method: "DELETE",
  }).catch(() => null);
}
