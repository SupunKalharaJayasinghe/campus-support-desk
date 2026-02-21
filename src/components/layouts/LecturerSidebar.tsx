"use client";

import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  PenSquare,
  Database,
  Folder,
  Clock,
  Bell,
  User
} from "lucide-react";
import { Sidebar, NavItem } from "@/components/layouts/Sidebar";

export function LecturerSidebar() {
  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: "/lecturer",
      icon: <LayoutDashboard className="h-4 w-4" />
    },
    {
      label: "My Modules",
      href: "/lecturer/modules",
      icon: <BookOpen className="h-4 w-4" />
    },
    {
      label: "Assessments",
      href: "/lecturer/modules/1/assessments",
      icon: <ClipboardList className="h-4 w-4" />
    },
    {
      label: "Quizzes",
      href: "/lecturer/modules/1/quizzes",
      icon: <PenSquare className="h-4 w-4" />
    },
    {
      label: "Question Banks",
      href: "/lecturer/modules/1/question-bank",
      icon: <Database className="h-4 w-4" />
    },
    {
      label: "Resources",
      href: "/lecturer/modules/1/resources",
      icon: <Folder className="h-4 w-4" />
    },
    {
      label: "Free Time Schedule",
      href: "/lecturer/free-time",
      icon: <Clock className="h-4 w-4" />
    },
    {
      label: "Notifications",
      href: "/lecturer/notifications",
      icon: <Bell className="h-4 w-4" />
    },
    {
      label: "Profile",
      href: "/lecturer/profile",
      icon: <User className="h-4 w-4" />
    }
  ];

  return <Sidebar items={items} logo="Lecturer" />;
}
