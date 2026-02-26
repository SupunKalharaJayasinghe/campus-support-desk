"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  HOME_BY_ROLE,
  getExpectedRoleForPath,
  readStoredRole,
} from "@/lib/rbac";
import type { AppRole } from "@/lib/rbac";

export default function RoleGuard({
  allowedRole,
  children,
}: {
  allowedRole?: AppRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const currentRole = isDemoMode ? null : readStoredRole();
  const expectedRole = isDemoMode ? null : getExpectedRoleForPath(pathname);

  let redirectTarget: string | null = null;

  if (!isDemoMode) {
    if (!currentRole) {
      redirectTarget = "/login";
    } else if (allowedRole && currentRole !== allowedRole) {
      redirectTarget = HOME_BY_ROLE[currentRole];
    } else if (expectedRole && currentRole !== expectedRole) {
      redirectTarget = HOME_BY_ROLE[currentRole];
    }
  }

  useEffect(() => {
    if (!redirectTarget) return;
    router.replace(redirectTarget);
  }, [redirectTarget, router]);

  const isReady = isDemoMode || !redirectTarget;

  if (!isReady) {
    return (
      <div className="p-6">
        <div className="h-6 w-32 rounded-xl border border-border bg-tint" />
      </div>
    );
  }

  return <>{children}</>;
}
