"use client";

import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Users,
  Layers,
  Calendar,
  Bell,
  BarChart
} from "lucide-react";
import { Sidebar, NavItem } from "@/components/layouts/Sidebar";

export function DeptAdminSidebar() {
  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: "/department-admin",
      icon: <LayoutDashboard className="h-4 w-4" />
    },
    {
      label: "My Degree Programs",
      href: "/department-admin/degree-programs",
      icon: <GraduationCap className="h-4 w-4" />
    },
    {
      label: "Modules",
      href: "/department-admin/modules",
      icon: <BookOpen className="h-4 w-4" />
    },
    {
      label: "Users",
      icon: <Users className="h-4 w-4" />,
      children: [
        { label: "Lecturers", href: "/department-admin/users/lecturers" },
        { label: "Students", href: "/department-admin/users/students" }
      ]
    },
    {
      label: "Groups & Batches",
      href: "/department-admin/groups",
      icon: <Layers className="h-4 w-4" />
    },
    {
      label: "Exam Schedule",
      href: "/department-admin/exam-schedule",
      icon: <Calendar className="h-4 w-4" />
    },
    {
      label: "Notifications",
      href: "/department-admin/notifications",
      icon: <Bell className="h-4 w-4" />
    },
    {
      label: "Reports",
      href: "/department-admin/reports",
      icon: <BarChart className="h-4 w-4" />
    }
  ];

  return <Sidebar items={items} logo="Dept Admin" />;
}
