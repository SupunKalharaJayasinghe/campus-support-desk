"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

export type NavItem = {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: string;
  children?: NavItem[];
};

export function Sidebar({
  items,
  logo = "Campus Desk"
}: {
  items: NavItem[];
  logo?: string;
}) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const renderItem = (item: NavItem, depth = 0) => {
    const isActive = item.href ? pathname.startsWith(item.href) : false;
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={`${item.label}-${depth}`} className="space-y-1">
        {item.href ? (
          <Link
            href={item.href}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition",
              isActive
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <span className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </span>
            {item.badge && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {item.badge}
              </span>
            )}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => hasChildren && toggleSection(item.label)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <span className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </span>
            {hasChildren && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition",
                  openSections[item.label] && "rotate-180"
                )}
              />
            )}
          </button>
        )}
        {hasChildren && openSections[item.label] && (
          <div className="ml-3 space-y-1 border-l border-slate-200 pl-3">
            {item.children?.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white px-4 py-6">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <span className="h-9 w-9 rounded-lg bg-indigo-600 text-center text-sm font-bold leading-9 text-white">
          CD
        </span>
        {logo}
      </div>
      <nav className="flex-1 space-y-2">{items.map((item) => renderItem(item))}</nav>
      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-3">
          <Avatar name="Jordan Parker" size="sm" status="online" />
          <div className="text-sm">
            <p className="font-medium text-slate-700">Jordan Parker</p>
            <p className="text-xs text-slate-500">Active session</p>
          </div>
        </div>
        <button
          type="button"
          className="mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
