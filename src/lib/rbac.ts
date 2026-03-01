export type AppRole = "SUPER_ADMIN" | "LECTURER" | "LOST_ITEM_STAFF" | "STUDENT";

export interface DemoUser {
  id: string;
  name: string;
  role: AppRole;
}

export const ROLE_STORAGE_KEY = "unihub_role";
export const USER_STORAGE_KEY = "unihub_user";

export const HOME_BY_ROLE: Record<AppRole, string> = {
  SUPER_ADMIN: "/admin",
  LECTURER: "/lecturer",
  LOST_ITEM_STAFF: "/lost-items",
  STUDENT: "/student",
};

export const WORKSPACE_TITLE_BY_ROLE: Record<AppRole, string> = {
  SUPER_ADMIN: "Admin Console",
  LECTURER: "Lecturer Portal",
  LOST_ITEM_STAFF: "Lost & Found Staff",
  STUDENT: "Student Portal",
};

export function isDemoModeEnabled() {
  const raw = process.env.NEXT_PUBLIC_DEMO_MODE;
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export function roleLabel(role: AppRole) {
  if (role === "SUPER_ADMIN") {
    return "SUPER_ADMIN";
  }
  if (role === "LOST_ITEM_STAFF") {
    return "LOST_ITEM_STAFF";
  }
  return role;
}

export function isRole(value: string): value is AppRole {
  return (
    value === "SUPER_ADMIN" ||
    value === "LECTURER" ||
    value === "LOST_ITEM_STAFF" ||
    value === "STUDENT"
  );
}

export function getExpectedRoleForPath(pathname: string): AppRole | null {
  if (pathname === "/student" || pathname.startsWith("/student/")) {
    return "STUDENT";
  }
  if (pathname === "/lecturer" || pathname.startsWith("/lecturer/")) {
    return "LECTURER";
  }
  if (pathname === "/lost-items" || pathname.startsWith("/lost-items/")) {
    return "LOST_ITEM_STAFF";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "SUPER_ADMIN";
  }
  return null;
}

export function readStoredRole(): AppRole | null {
  if (typeof window === "undefined") {
    return null;
  }
  const rawRole = window.localStorage.getItem(ROLE_STORAGE_KEY);
  if (!rawRole || !isRole(rawRole)) {
    return null;
  }
  return rawRole;
}

export function readStoredUser(): DemoUser | null {
  if (typeof window === "undefined") {
    return null;
  }
  const rawUser = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser) as DemoUser;
    if (!parsed || typeof parsed !== "object" || !isRole(parsed.role)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function persistDemoSession(user: DemoUser) {
  window.localStorage.setItem(ROLE_STORAGE_KEY, user.role);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearDemoSession() {
  window.localStorage.removeItem(ROLE_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}
