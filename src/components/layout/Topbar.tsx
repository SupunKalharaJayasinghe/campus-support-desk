"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
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
  if (role === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (role === "LOST_ITEM_STAFF") return "LOST_ITEM_STAFF";
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
    if (!role) return "Workspace";
    const match = NAV_BY_ROLE[role]
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return match?.label ?? "Workspace";
  }, [pathname, role]);

  const workspaceTitle = role ? WORKSPACE_TITLE_BY_ROLE[role] : "UniHub Workspace";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <Container className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            aria-label="Open sidebar"
            className="rounded-lg p-2 text-text hover:bg-surface2 md:hidden"
            onClick={onMenuClick}
            type="button"
          >
            <Menu size={20} />
          </button>
          <div>
            <p className="text-sm font-semibold text-text">{workspaceTitle}</p>
            <p className="text-xs text-mutedText">{pageTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="info">Demo Mode</Badge>
          {role ? <Badge variant="primary">{roleLabel(role)}</Badge> : null}
          {user ? <p className="hidden text-xs text-mutedText sm:block">{user.name}</p> : null}
          <Button
            onClick={() => {
              clearDemoSession();
              router.replace("/login");
            }}
            variant="secondary"
          >
            <LogOut size={16} />
            <span className="ml-1">Switch account</span>
          </Button>
        </div>
      </Container>
    </header>
  );
}
