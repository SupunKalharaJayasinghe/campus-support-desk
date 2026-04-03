export type AppRole =
  | "SUPER_ADMIN"
  | "LECTURER"
  | "LOST_ITEM_STAFF"
  | "STUDENT"
  | "COMMUNITY_ADMIN";
export type AcademicStream = "WEEKDAY" | "WEEKEND";

export interface DemoUser {
  id: string;
  name: string;
  role: AppRole;
  userRole?: string;
  username?: string;
  email?: string;
  studentRef?: string;
  studentRegistrationNumber?: string;
  mustChangePassword?: boolean;
  facultyCodes?: string[];
  degreeProgramIds?: string[];
  semesterCode?: string;
  stream?: AcademicStream;
  subgroup?: string | null;
  intakeId?: string;
}

export const ROLE_STORAGE_KEY = "unihub_role";
export const USER_STORAGE_KEY = "unihub_user";

export const HOME_BY_ROLE: Record<AppRole, string> = {
  SUPER_ADMIN: "/admin",
  LECTURER: "/lecturer",
  LOST_ITEM_STAFF: "/lost-items",
  STUDENT: "/student",
  COMMUNITY_ADMIN: "/community-admin",
};

export const WORKSPACE_TITLE_BY_ROLE: Record<AppRole, string> = {
  SUPER_ADMIN: "Admin Console",
  LECTURER: "Lecturer Portal",
  LOST_ITEM_STAFF: "Lost & Found Staff",
  STUDENT: "Student Portal",
  COMMUNITY_ADMIN: "Community Admin",
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
    value === "STUDENT" ||
    value === "COMMUNITY_ADMIN"
  );
}

export function getExpectedRoleForPath(pathname: string): AppRole | AppRole[] | null {
  if (pathname === "/student" || pathname.startsWith("/student/")) {
    return "STUDENT";
  }
  if (pathname === "/lecturer" || pathname.startsWith("/lecturer/")) {
    return "LECTURER";
  }
  if (pathname === "/lost-items" || pathname.startsWith("/lost-items/")) {
    return "LOST_ITEM_STAFF";
  }
  if (pathname === "/admin/grades" || pathname.startsWith("/admin/grades/")) {
    return ["SUPER_ADMIN", "LECTURER"];
  }
  if (pathname === "/admin/quizzes" || pathname.startsWith("/admin/quizzes/")) {
    return ["SUPER_ADMIN", "LECTURER"];
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "SUPER_ADMIN";
  }
  if (pathname === "/community-admin" || pathname.startsWith("/community-admin/")) {
    return "COMMUNITY_ADMIN";
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
    const parsed = JSON.parse(rawUser) as Partial<DemoUser>;
    const parsedFacultyCodes = Array.isArray(parsed.facultyCodes)
      ? parsed.facultyCodes
          .map((value) => String(value ?? "").trim().toUpperCase())
          .filter(Boolean)
      : [];
    const parsedDegreeProgramIds = Array.isArray(parsed.degreeProgramIds)
      ? parsed.degreeProgramIds
          .map((value) => String(value ?? "").trim().toUpperCase())
          .filter(Boolean)
      : [];
    const parsedSemesterCode = String(parsed.semesterCode ?? "").trim().toUpperCase();
    const parsedStream = String(parsed.stream ?? "").trim().toUpperCase();
    const parsedSubgroup = String(parsed.subgroup ?? "").trim();
    const parsedIntakeId = String(parsed.intakeId ?? "").trim();
    const parsedUserRole = String(parsed.userRole ?? "").trim().toUpperCase();

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !isRole(String(parsed.role ?? "")) ||
      typeof parsed.id !== "string"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      name: typeof parsed.name === "string" ? parsed.name : "User",
      role: parsed.role as AppRole,
      userRole: parsedUserRole || undefined,
      username: typeof parsed.username === "string" ? parsed.username : undefined,
      email: typeof parsed.email === "string" ? parsed.email : undefined,
      studentRef:
        typeof parsed.studentRef === "string" ? parsed.studentRef : undefined,
      studentRegistrationNumber:
        typeof parsed.studentRegistrationNumber === "string"
          ? parsed.studentRegistrationNumber
          : undefined,
      mustChangePassword:
        typeof parsed.mustChangePassword === "boolean"
          ? parsed.mustChangePassword
          : false,
      facultyCodes: parsedFacultyCodes,
      degreeProgramIds: parsedDegreeProgramIds,
      semesterCode: parsedSemesterCode || undefined,
      stream:
        parsedStream === "WEEKDAY" || parsedStream === "WEEKEND"
          ? (parsedStream as AcademicStream)
          : undefined,
      subgroup: parsedSubgroup || undefined,
      intakeId: parsedIntakeId || undefined,
    };
  } catch {
    return null;
  }
}

export function persistDemoSession(user: DemoUser) {
  window.localStorage.setItem(ROLE_STORAGE_KEY, user.role);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function updateStoredUser(patch: Partial<DemoUser>) {
  if (typeof window === "undefined") {
    return;
  }

  const current = readStoredUser();
  if (!current) {
    return;
  }

  const next: DemoUser = {
    ...current,
    ...patch,
    role: isRole(String((patch.role ?? current.role) || ""))
      ? (patch.role ?? current.role)!
      : current.role,
  };

  persistDemoSession(next);
}

export function isPasswordChangeRequired() {
  const user = readStoredUser();
  return Boolean(user?.mustChangePassword);
}

export function authHeaders() {
  const user = readStoredUser();
  if (!user) {
    return {} as Record<string, string>;
  }

  return {
    "x-user-id": user.id,
    "x-user-role": user.userRole || user.role,
  } as Record<string, string>;
}

export function toAppRoleFromUserRole(value: unknown): AppRole {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ADMIN" || normalized === "SUPER_ADMIN") {
    return "SUPER_ADMIN";
  }
  if (normalized === "LOST_ITEM_ADMIN" || normalized === "LOST_ITEM_STAFF") {
    return "LOST_ITEM_STAFF";
  }
  if (normalized === "LECTURER") {
    return "LECTURER";
  }
  if (normalized === "LAB_ASSISTANT") {
    return "LECTURER";
  }
  if (normalized === "STUDENT") {
    return "STUDENT";
  }
  if (normalized === "COMMUNITY_ADMIN") {
    return "COMMUNITY_ADMIN";
  }
  return "LOST_ITEM_STAFF";
}

export function clearDemoSession() {
  window.localStorage.removeItem(ROLE_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}
