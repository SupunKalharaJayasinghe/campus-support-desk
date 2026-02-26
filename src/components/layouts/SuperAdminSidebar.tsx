"use client";

import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  Bell,
  Package,
  BarChart,
  Settings
} from "lucide-react";
import { Sidebar, NavItem } from "@/components/layouts/Sidebar";

export function SuperAdminSidebar() {
  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: "/super-admin",
      icon: <LayoutDashboard className="h-4 w-4" />
    },
    {
      label: "User Management",
      icon: <Users className="h-4 w-4" />,
      children: [
        { label: "All Users", href: "/super-admin/users" },
        { label: "Admins", href: "/super-admin/users/admins" },
        { label: "Lecturers", href: "/super-admin/users/lecturers" },
        { label: "Students", href: "/super-admin/users/students" },
        { label: "Lost Item Staff", href: "/super-admin/users/lost-item-staff" }
      ]
    },
    {
      label: "Degree Management",
      href: "/super-admin/degree-programs",
      icon: <GraduationCap className="h-4 w-4" />
    },
    {
      label: "Module Management",
      href: "/super-admin/modules",
      icon: <BookOpen className="h-4 w-4" />
    },
    {
      label: "Exam Management",
      href: "/super-admin/exam-schedule",
      icon: <Calendar className="h-4 w-4" />
    },
    {
      label: "Lost Item Management",
      href: "/super-admin/lost-items",
      icon: <Package className="h-4 w-4" />
    },
    {
      label: "Announcement Management",
      href: "/super-admin/notifications",
      icon: <Bell className="h-4 w-4" />
    },
    {
      label: "Instructor Management",
      href: "/super-admin/instructors",
      icon: <Users className="h-4 w-4" />
    },
    {
      label: "Reports Management",
      href: "/super-admin/reports",
      icon: <BarChart className="h-4 w-4" />
    },
    {
      label: "Settings",
      href: "/super-admin/settings",
      icon: <Settings className="h-4 w-4" />
    }
  ];

  return <Sidebar items={items} logo="Super Admin" />;
}
