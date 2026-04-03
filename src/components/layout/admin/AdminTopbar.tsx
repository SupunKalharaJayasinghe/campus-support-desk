"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import {
  buildVisibleAdminSections,
  itemMatchesPathExactly,
  resolveActiveAdminRoute,
} from "@/components/layout/admin/admin-nav";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  clearDemoSession,
  isDemoModeEnabled,
  readStoredRole,
  readStoredUser,
} from "@/models/rbac";
import type { AppRole } from "@/models/rbac";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Dashboard",
  academics: "Academics",
  "degree-programs": "Degree Programs",
  faculties: "Faculties",
  intakes: "Intakes / Batches",
  "academic-terms": "Academic Terms",
  streams: "Streams",
  subgroups: "Subgroups",
  modules: "Modules",
  "module-offerings": "Module Offerings",
  users: "Users",
  students: "Students",
  lecturers: "Lecturers",
  "lab-assistants": "Lab Assistants",
  admins: "Admins",
  "roles-permissions": "Roles & Permissions",
  "bulk-import": "Bulk Import",
  teaching: "Teaching",
  "teaching-assignments": "Teaching Assignments",
  timetable: "Timetable",
  locations: "Locations / Labs",
  "subgroup-allocation": "Subgroup Allocation",
  assessments: "Assessments",
  assignments: "Assignments",
  "subgroup-deadlines": "Subgroup Deadlines",
  submissions: "Submissions",
  grades: "Grades",
  resources: "Resources",
  "module-content": "Module Content",
  "upload-materials": "Upload Materials",
  "visibility-settings": "Content Visibility Settings",
  communication: "Communication",
  announcements: "Announcements",
  "targeted-notifications": "Targeted Notifications",
  messages: "Messages",
  reports: "Reports",
  "student-analytics": "Student Analytics",
  "submission-reports": "Submission Reports",
  "lecturer-workload": "Lecturer Workload",
  administration: "Administration",
  "system-settings": "System Settings",
  "audit-logs": "Audit Logs",
  "security-settings": "Security Settings",
  "backup-management": "Backup Management",
  list: "List",
  details: "Details",
  edit: "Edit",
  create: "Create",
};

function roleLabel(role: AppRole) {
  if (role === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (role === "LOST_ITEM_STAFF") return "LOST_ITEM_STAFF";
  return role;
}

function labelForSegment(segment: string) {
  if (SEGMENT_LABELS[segment]) {
    return SEGMENT_LABELS[segment];
  }

  return segment
    .split("-")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export default function AdminTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeWindow } = useAdminContext();
  const role = readStoredRole() ?? "SUPER_ADMIN";
  const user = readStoredUser();
  const logoutRedirect = isDemoModeEnabled() ? "/" : "/login";

  const visibleSections = useMemo(() => buildVisibleAdminSections(role), [role]);
  const { activeItem, activeSection } = useMemo(
    () => resolveActiveAdminRoute(pathname, visibleSections),
    [pathname, visibleSections]
  );

  const fallbackWindowLabel = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    if (!lastSegment || lastSegment === "admin") {
      return "Overview";
    }

    return labelForSegment(lastSegment);
  }, [pathname]);

  const currentWindowLabel = useMemo(() => {
    if (activeWindow) {
      return activeWindow;
    }

    if (pathname === "/admin") {
      return "Overview";
    }

    if (activeItem && itemMatchesPathExactly(activeItem, pathname)) {
      return "List";
    }

    return fallbackWindowLabel;
  }, [activeItem, activeWindow, fallbackWindowLabel, pathname]);

  const sectionLabel = activeSection?.label ?? "Dashboard";
  const sectionHref = activeSection?.items[0]?.href ?? "/admin";
  const submenuLabel = activeItem?.label ?? fallbackWindowLabel;
  const submenuHref = activeItem?.href ?? pathname;
  const showSubmenu = Boolean(activeItem && activeSection?.key !== "dashboard");
  const breadcrumbTitle = showSubmenu
    ? `${sectionLabel} > ${submenuLabel} | ${currentWindowLabel}`
    : `${sectionLabel} | ${currentWindowLabel}`;
  const userLabel = user?.name ?? "Lakvidu Upasara";

  return (
    <header className="z-20 h-[60px] shrink-0 border-b border-border bg-card">
      <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-2 text-sm"
          title={breadcrumbTitle}
        >
          <div className="flex min-w-0 items-center gap-1.5 truncate">
            <Link
              className="truncate font-medium text-heading transition-colors hover:text-primary"
              href={sectionHref}
            >
              {sectionLabel}
            </Link>

            {showSubmenu ? (
              <>
                <span className="shrink-0 text-text/40">&gt;</span>
                <Link
                  className="truncate font-medium text-heading transition-colors hover:text-primary"
                  href={submenuHref}
                >
                  {submenuLabel}
                </Link>
              </>
            ) : null}
          </div>

          <span className="shrink-0 text-text/35">|</span>
          <span className="truncate font-medium text-heading">{currentWindowLabel}</span>
        </nav>

        <div className="flex min-w-0 items-center gap-3">
          <Badge className="shrink-0" variant="neutral">
            {roleLabel(role)}
          </Badge>
          <p className="truncate text-sm font-medium text-heading" title={userLabel}>
            {userLabel}
          </p>
          <Button
            className="shrink-0 px-3 py-1.5"
            onClick={() => {
              clearDemoSession();
              router.replace(logoutRedirect);
            }}
            variant="secondary"
          >
            <LogOut size={16} />
            <span className="ml-1">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

