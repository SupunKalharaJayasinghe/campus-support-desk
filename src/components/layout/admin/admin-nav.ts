"use client";

import type { ComponentType } from "react";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  MessageSquareText,
  ShieldCheck,
  University,
  Users,
} from "lucide-react";
import type { AppRole } from "@/models/rbac";

export type AdminNavItem = {
  label: string;
  href: string;
  matchHrefs?: string[];
  roles?: AppRole[];
};

export type AdminNavSection = {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  items: AdminNavItem[];
  roles?: AppRole[];
};

export function roleAllows(itemRoles: AppRole[] | undefined, role: AppRole) {
  if (!itemRoles || itemRoles.length === 0) return true;
  return itemRoles.includes(role);
}

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "LECTURER"],
    items: [{ label: "Overview", href: "/admin" }],
  },
  {
    key: "academics",
    label: "Academics",
    icon: University,
    roles: ["SUPER_ADMIN"],
    items: [
      {
        label: "Faculties",
        href: "/admin/academics/faculties",
        matchHrefs: ["/admin/faculty"],
      },
      { label: "Degree Programs", href: "/admin/academics/degree-programs" },
      { label: "Intakes / Batches", href: "/admin/academics/intakes" },
      { label: "Academic Terms", href: "/admin/academics/academic-terms" },
      { label: "Streams", href: "/admin/academics/streams" },
      { label: "Subgroups", href: "/admin/academics/subgroups" },
      {
        label: "Modules",
        href: "/admin/academics/modules",
        matchHrefs: ["/admin/modules"],
      },
      { label: "Module Offerings", href: "/admin/academics/module-offerings" },
    ],
  },
  {
    key: "users",
    label: "Users",
    icon: Users,
    roles: ["SUPER_ADMIN"],
    items: [
      { label: "Students", href: "/admin/users/students" },
      { label: "Lecturers", href: "/admin/users/lecturers" },
      { label: "Lab Assistants", href: "/admin/users/lab-assistants" },
      { label: "Admins", href: "/admin/users/admins" },
      { label: "Roles & Permissions", href: "/admin/users/roles-permissions" },
      { label: "Bulk Import", href: "/admin/users/bulk-import" },
    ],
  },
  {
    key: "teaching",
    label: "Teaching",
    icon: GraduationCap,
    roles: ["SUPER_ADMIN", "LECTURER"],
    items: [
      { label: "Teaching Assignments", href: "/admin/teaching/teaching-assignments" },
      { label: "Timetable", href: "/admin/teaching/timetable" },
      { label: "Locations / Labs", href: "/admin/teaching/locations" },
      { label: "Subgroup Allocation", href: "/admin/teaching/subgroup-allocation" },
    ],
  },
  {
    key: "assessments",
    label: "Assessments",
    icon: ClipboardCheck,
    roles: ["SUPER_ADMIN", "LECTURER"],
    items: [
      { label: "Assignments", href: "/admin/assessments/assignments" },
      { label: "Subgroup Deadlines", href: "/admin/assessments/subgroup-deadlines" },
      { label: "Submissions", href: "/admin/assessments/submissions" },
      { label: "Grades", href: "/admin/assessments/grades" },
    ],
  },
  {
    key: "resources",
    label: "Resources",
    icon: BookOpen,
    roles: ["SUPER_ADMIN", "LECTURER"],
    items: [
      { label: "Module Content", href: "/admin/resources/module-content" },
      { label: "Upload Materials", href: "/admin/resources/upload-materials" },
      { label: "Content Visibility Settings", href: "/admin/resources/visibility-settings" },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    icon: MessageSquareText,
    roles: ["SUPER_ADMIN", "LECTURER"],
    items: [
      { label: "Notifications", href: "/notifications" },
      { label: "Announcements", href: "/admin/communication/announcements" },
      { label: "Targeted Notifications", href: "/admin/communication/targeted-notifications" },
      { label: "Messages", href: "/admin/communication/messages" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "LECTURER"],
    items: [
      { label: "Student Analytics", href: "/admin/reports/student-analytics" },
      { label: "Submission Reports", href: "/admin/reports/submission-reports" },
      { label: "Lecturer Workload", href: "/admin/reports/lecturer-workload" },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN"],
    items: [
      {
        label: "System Settings",
        href: "/admin/administration/system-settings",
        matchHrefs: ["/admin/settings"],
      },
      { label: "Audit Logs", href: "/admin/administration/audit-logs" },
      { label: "Security Settings", href: "/admin/administration/security-settings" },
      { label: "Backup Management", href: "/admin/administration/backup-management" },
    ],
  },
];

export function buildVisibleAdminSections(role: AppRole) {
  return ADMIN_NAV_SECTIONS.filter((section) => roleAllows(section.roles, role)).map((section) => ({
    ...section,
    items: section.items.filter((item) => roleAllows(item.roles ?? section.roles, role)),
  }));
}

export function itemMatchesPath(item: AdminNavItem, pathname: string) {
  const paths = [item.href, ...(item.matchHrefs ?? [])];
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function itemMatchesPathExactly(item: AdminNavItem, pathname: string) {
  const paths = [item.href, ...(item.matchHrefs ?? [])];
  return paths.some((path) => pathname === path);
}

export function resolveActiveAdminRoute(
  pathname: string,
  sections: AdminNavSection[]
) {
  const activeSection =
    sections.find((section) => section.items.some((item) => itemMatchesPath(item, pathname))) ??
    sections.find((section) => section.key === "dashboard") ??
    sections[0] ??
    null;

  const activeItem =
    activeSection?.items.find((item) => itemMatchesPath(item, pathname)) ??
    activeSection?.items[0] ??
    null;

  return {
    activeItem,
    activeSection,
  };
}

