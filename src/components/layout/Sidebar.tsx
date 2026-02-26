"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

function Icon({ icon }: { icon: NavIcon }) {
  if (icon === "home") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M4 10.5L12 4L20 10.5V20H14.5V14H9.5V20H4V10.5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  if (icon === "bell") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 4C9.2 4 7 6.2 7 9V12L5.5 14.5H18.5L17 12V9C17 6.2 14.8 4 12 4Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M10 17C10.2 18.1 11 19 12 19C13 19 13.8 18.1 14 17"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  if (icon === "calendar") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M7 3V6M17 3V6M4 9H20M6 5H18C19.1 5 20 5.9 20 7V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V7C4 5.9 4.9 5 6 5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  if (icon === "chat") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M4 5C4 3.9 4.9 3 6 3H18C19.1 3 20 3.9 20 5V14C20 15.1 19.1 16 18 16H10L6 20V16H6C4.9 16 4 15.1 4 14V5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  if (icon === "trophy") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M8 4H16V7C16 9.2 14.2 11 12 11C9.8 11 8 9.2 8 7V4Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M12 11V15M9 20H15M8 15H16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  if (icon === "clock") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8V12L14.5 13.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }
  if (icon === "clipboard") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M9 4H15V6H9V4ZM7 6H17C18.1 6 19 6.9 19 8V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V8C5 6.9 5.9 6 7 6Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  if (icon === "box") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M3 8L12 3L21 8V16L12 21L3 16V8Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path d="M3 8L12 13L21 8" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (icon === "users") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 19C4.4 16.8 6.3 15.2 8.6 15.2H9.4C11.7 15.2 13.6 16.8 14 19" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14.5 18.5C14.8 17 16 16 17.5 16H18C19.4 16 20.5 16.9 21 18.2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (icon === "book") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M4 5.5C4 4.7 4.7 4 5.5 4H18V19H5.5C4.7 19 4 19.7 4 20.5V5.5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path d="M18 4V19" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (icon === "megaphone") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M4 12V9.5C4 8.7 4.7 8 5.5 8H8L16 5V15L8 12H5.5C4.7 12 4 11.3 4 10.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path d="M8 12L9 18H11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }
  if (icon === "shield") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 3L19 6V11.5C19 16 15.9 20.2 12 21C8.1 20.2 5 16 5 11.5V6L12 3Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
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
          "fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm md:hidden",
          open ? "block" : "hidden"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white p-5 transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">UniHub</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Smart Support Portal</h2>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
                href={item.href}
                key={item.href}
                onClick={onClose}
              >
                <span className="flex items-center gap-2">
                  <Icon icon={item.icon} />
                  {item.label}
                </span>
                {item.badge ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-400">UniHub v0.1 Demo</p>
      </aside>
    </>
  );
}
