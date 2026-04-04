import { readStoredUser } from "@/lib/rbac";

export type ProfileVisibility = "public" | "private";

/** Max stored characters (data URLs / long https URLs) for community profile avatars. */
export const COMMUNITY_PROFILE_AVATAR_MAX_CHARS = 1_000_000;

export type CommunityProfileSettings = {
  displayName: string;
  username: string;
  email: string;
  bio: string;
  faculty: string;
  studyYear: string;
  visibility: ProfileVisibility;
  avatarUrl: string;
};

const LEGACY_SETTINGS_STORAGE_KEY = "community_profile_settings";

const DEFAULT_SETTINGS: CommunityProfileSettings = {
  displayName: "Current User",
  username: "",
  email: "",
  bio: "",
  faculty: "Computing",
  studyYear: "Year 2",
  visibility: "public",
  avatarUrl: "",
};

export function normalizeCommunityProfileSettings(
  input: Partial<CommunityProfileSettings> | null | undefined
): CommunityProfileSettings {
  const rawAvatar = String(input?.avatarUrl ?? "").trim();
  const avatarUrl =
    rawAvatar.length > COMMUNITY_PROFILE_AVATAR_MAX_CHARS ? "" : rawAvatar;

  return {
    ...DEFAULT_SETTINGS,
    ...input,
    displayName: String(input?.displayName ?? DEFAULT_SETTINGS.displayName).trim() || "Current User",
    username: String(input?.username ?? "").trim(),
    email: String(input?.email ?? "").trim(),
    bio: String(input?.bio ?? "").trim(),
    faculty: String(input?.faculty ?? DEFAULT_SETTINGS.faculty).trim() || DEFAULT_SETTINGS.faculty,
    studyYear:
      String(input?.studyYear ?? DEFAULT_SETTINGS.studyYear).trim() || DEFAULT_SETTINGS.studyYear,
    visibility: input?.visibility === "private" ? "private" : "public",
    avatarUrl,
  };
}

function readSettingsFromStorageKey(
  key: string
): Partial<CommunityProfileSettings> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<CommunityProfileSettings>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getCommunityProfileSettingsStorageKey(userId?: string | null) {
  const id = String(userId ?? "").trim();
  if (!id) {
    return LEGACY_SETTINGS_STORAGE_KEY;
  }
  return `${LEGACY_SETTINGS_STORAGE_KEY}:${id}`;
}

/**
 * Baseline for the first React paint so SSR and the browser match.
 * Skips localStorage and skips the signed-in user — both exist only on the client and would mismatch the server.
 * Real values are applied in `useEffect` via {@link readCommunityProfileSettings}.
 */
export function getCommunityProfileSettingsHydrationBaseline(): CommunityProfileSettings {
  return normalizeCommunityProfileSettings({
    displayName: DEFAULT_SETTINGS.displayName,
    username: "",
    email: "",
  });
}

export function readCommunityProfileSettings(): CommunityProfileSettings {
  const storedUser = readStoredUser();
  const base = normalizeCommunityProfileSettings({
    displayName: storedUser?.name ?? storedUser?.username ?? DEFAULT_SETTINGS.displayName,
    username: storedUser?.username ?? "",
    email: storedUser?.email ?? "",
  });

  if (typeof window === "undefined") {
    return base;
  }

  const perUserKey = getCommunityProfileSettingsStorageKey(storedUser?.id);
  const perUser = readSettingsFromStorageKey(perUserKey);
  if (perUser) {
    return normalizeCommunityProfileSettings({ ...base, ...perUser });
  }

  const legacy = readSettingsFromStorageKey(LEGACY_SETTINGS_STORAGE_KEY);
  if (legacy) {
    return normalizeCommunityProfileSettings({ ...base, ...legacy });
  }

  return base;
}

export function saveCommunityProfileSettings(
  settings: CommunityProfileSettings
): CommunityProfileSettings {
  const sanitized = normalizeCommunityProfileSettings(settings);
  if (typeof window === "undefined") {
    return sanitized;
  }

  const storedUser = readStoredUser();
  const key = getCommunityProfileSettingsStorageKey(storedUser?.id);
  window.localStorage.setItem(key, JSON.stringify(sanitized));
  return sanitized;
}

