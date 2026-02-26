"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { NAV_BY_ROLE } from "@/lib/nav";
import {
  WORKSPACE_TITLE_BY_ROLE,
  clearDemoSession,
  readStoredRole,
  readStoredUser,
} from "@/lib/rbac";
import type { AppRole, DemoUser } from "@/lib/rbac";

interface TopbarProps {
  onMenuClick: () => void;
}

function roleLabel(role: AppRole) {
  if (role === "SUPER_ADMIN") {
    return "SUPER ADMIN";
  }
  if (role === "LOST_ITEM_STAFF") {
    return "LOST ITEM STAFF";
  }
  return role;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<AppRole | null>(null);
  const [user, setUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    setRole(readStoredRole());
    setUser(readStoredUser());
  }, [pathname]);

  const pageTitle = useMemo(() => {
    if (!role) {
      return "Workspace";
    }
    const match = NAV_BY_ROLE[role]
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];

    return match?.label ?? "Workspace";
  }, [pathname, role]);

  const workspaceTitle = role ? WORKSPACE_TITLE_BY_ROLE[role] : "UniHub Workspace";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            aria-label="Open sidebar"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={onMenuClick}
            type="button"
          >
            <span className="block h-0.5 w-5 bg-current" />
            <span className="mt-1.5 block h-0.5 w-5 bg-current" />
            <span className="mt-1.5 block h-0.5 w-5 bg-current" />
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-900">{workspaceTitle}</p>
            <p className="text-xs text-slate-500">{pageTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {role ? <Badge variant="warning">{roleLabel(role)}</Badge> : null}
          {user ? <p className="hidden text-xs text-slate-500 sm:block">{user.name}</p> : null}
          <Button
            onClick={() => {
              clearDemoSession();
              router.replace("/login");
            }}
            variant="secondary"
          >
            Switch account
          </Button>
        </div>
      </div>
    </header>
  );
}
