"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Clock3,
  Home,
  Megaphone,
  MessageSquare,
  Package,
  ShieldAlert,
  Trophy,
  Users,
} from "lucide-react";
import { NAV_BY_ROLE } from "@/lib/nav";
import type { NavIcon, NavItem } from "@/lib/nav";
import { readStoredRole } from "@/lib/rbac";
import type { AppRole } from "@/lib/rbac";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function getIcon(icon: NavIcon) {
  if (icon === "home") return Home;
  if (icon === "bell") return Bell;
  if (icon === "calendar") return CalendarDays;
  if (icon === "chat") return MessageSquare;
  if (icon === "trophy") return Trophy;
  if (icon === "clock") return Clock3;
  if (icon === "clipboard") return ClipboardList;
  if (icon === "box") return Package;
  if (icon === "chart") return ChartColumn;
  if (icon === "users") return Users;
  if (icon === "book") return BookOpen;
  if (icon === "megaphone") return Megaphone;
  return ShieldAlert;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    setRole(readStoredRole());
  }, [pathname]);

  const navItems = useMemo<NavItem[]>(() => {
    if (!role) {
      return [];
    }
    return NAV_BY_ROLE[role];
  }, [role]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-text/30 backdrop-blur-sm md:hidden",
          open ? "block" : "hidden"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface p-5 transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-mutedText">UniHub</p>
          <h2 className="mt-2 text-xl font-semibold text-text">Academic Support</h2>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = getIcon(item.icon);
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={cn(
                  "group flex items-center justify-between rounded-xl border-l-4 px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-l-primary bg-primary/10 text-primary"
                    : "border-l-transparent text-text hover:bg-surface2"
                )}
                href={item.href}
                key={item.href}
                onClick={onClose}
              >
                <span className="flex items-center gap-2">
                  <Icon size={20} strokeWidth={1.9} />
                  {item.label}
                </span>
                {item.badge ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      isActive ? "bg-primary text-white" : "bg-surface2 text-mutedText"
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <p className="mt-6 border-t border-border pt-4 text-xs text-mutedText">UniHub v0.1 Demo</p>
      </aside>
    </>
  );
}
