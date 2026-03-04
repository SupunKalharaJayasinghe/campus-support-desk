"use client";

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
  const role = readStoredRole();
  const navItems: NavItem[] = role ? NAV_BY_ROLE[role] : [];

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
          "fixed inset-y-0 left-0 z-40 w-72 p-3 transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-shadow">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-text/68">UniHub</p>
            <h2 className="mt-2 text-xl font-semibold text-heading">Academic Support</h2>
          </div>

          <nav className="flex-1 space-y-1.5">
            {navItems.map((item) => {
              const Icon = getIcon(item.icon);
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={cn(
                    "group relative flex items-center justify-between rounded-2xl px-3 py-2.5 pl-5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-text hover:bg-primaryHover/8 hover:text-primaryHover"
                  )}
                  href={item.href}
                  key={item.href}
                  onClick={onClose}
                >
                  <span
                    className={cn(
                      "absolute bottom-2 left-2 top-2 w-1 rounded-full transition-colors",
                      isActive ? "bg-primary" : "bg-transparent group-hover:bg-primary/30"
                    )}
                  />
                  <span className="flex items-center gap-2">
                    <Icon size={20} strokeWidth={1.9} />
                    {item.label}
                  </span>
                  {item.badge ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-semibold",
                        isActive
                          ? "border-primary/20 bg-primary/12 text-primary"
                          : "border-border bg-tint text-text/72"
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <p className="mt-6 border-t border-border pt-4 text-xs tracking-[0.14em] text-text/65">UniHub v0.1 Demo</p>
        </div>
      </aside>
    </>
  );
}
