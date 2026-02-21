"use client";

import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  PenSquare,
  Folder,
  GraduationCap,
  Calendar,
  Package,
  Bell,
  User
} from "lucide-react";
import { Sidebar, NavItem } from "@/components/layouts/Sidebar";

export function StudentSidebar() {
  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: "/student",
      icon: <LayoutDashboard className="h-4 w-4" />
    },
    {
      label: "My Modules",
      href: "/student/modules",
      icon: <BookOpen className="h-4 w-4" />
    },
    {
      label: "Assessments",
      href: "/student/modules/1/assessments",
      icon: <ClipboardList className="h-4 w-4" />
    },
    {
      label: "Quizzes",
      href: "/student/modules/1/quizzes",
      icon: <PenSquare className="h-4 w-4" />
    },
    {
      label: "Resources",
      href: "/student/modules/1/resources",
      icon: <Folder className="h-4 w-4" />
    },
    {
      label: "Results & GPA",
      href: "/student/results",
      icon: <GraduationCap className="h-4 w-4" />
    },
    {
      label: "Instructor Schedule",
      href: "/student/instructors",
      icon: <Calendar className="h-4 w-4" />
    },
    {
      label: "Lost & Found",
      href: "/student/lost-items",
      icon: <Package className="h-4 w-4" />
    },
    {
      label: "Notifications",
      href: "/student/notifications",
      icon: <Bell className="h-4 w-4" />
    },
    {
      label: "Profile",
      href: "/student/profile",
      icon: <User className="h-4 w-4" />
    }
  ];

  return <Sidebar items={items} logo="Student" />;
}
