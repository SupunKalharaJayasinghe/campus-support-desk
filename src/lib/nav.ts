import type { AppRole } from "@/lib/rbac";

export type NavIcon =
  | "home"
  | "bell"
  | "calendar"
  | "chat"
  | "trophy"
  | "clock"
  | "clipboard"
  | "box"
  | "chart"
  | "users"
  | "book"
  | "megaphone"
  | "shield";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
  badge?: number;
}

export const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  STUDENT: [
    { label: "Dashboard", href: "/student", icon: "home" },
    { label: "Notifications", href: "/student/notifications", icon: "bell", badge: 3 },
    { label: "Booking", href: "/student/booking", icon: "calendar" },
    { label: "Posts", href: "/student/posts", icon: "chat" },
    { label: "Gamification", href: "/student/gamification", icon: "trophy" },
  ],
  LECTURER: [
    { label: "Dashboard", href: "/lecturer", icon: "home" },
    { label: "Availability", href: "/lecturer/availability", icon: "clock" },
    { label: "Bookings", href: "/lecturer/bookings", icon: "calendar", badge: 4 },
    { label: "Notifications", href: "/lecturer/notifications", icon: "bell", badge: 2 },
    { label: "Posts", href: "/lecturer/posts", icon: "chat" },
  ],
  LOST_ITEM_STAFF: [
    { label: "Dashboard", href: "/lost-items", icon: "home" },
    { label: "Queue", href: "/lost-items/queue", icon: "clipboard", badge: 6 },
    { label: "Found Register", href: "/lost-items/found", icon: "box" },
    { label: "Analytics", href: "/lost-items/analytics", icon: "chart" },
    { label: "Notifications", href: "/lost-items/notifications", icon: "bell", badge: 2 },
  ],
  SUPER_ADMIN: [
    { label: "Dashboard", href: "/admin", icon: "home" },
    { label: "Users", href: "/admin/users", icon: "users" },
    { label: "Modules", href: "/admin/modules", icon: "book" },
    { label: "Announcements", href: "/admin/announcements", icon: "megaphone" },
    { label: "Moderation", href: "/admin/moderation", icon: "shield", badge: 5 },
    { label: "Analytics", href: "/admin/analytics", icon: "chart" },
  ],
};
