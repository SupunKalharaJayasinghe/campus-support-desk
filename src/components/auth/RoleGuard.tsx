"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  HOME_BY_ROLE,
  getExpectedRoleForPath,
  isDemoModeEnabled,
  readStoredRole,
  readStoredUser,
} from "@/models/rbac";
import type { AppRole } from "@/models/rbac";

const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function RoleGuard({
  allowedRole,
  children,
}: {
  allowedRole?: AppRole | AppRole[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isHydrated = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot
  );
  const isDemoMode = isDemoModeEnabled();

  const currentRole = !isHydrated || isDemoMode ? null : readStoredRole();
  const currentUser = !isHydrated || isDemoMode ? null : readStoredUser();
  const expectedRole =
    !isHydrated || isDemoMode ? null : getExpectedRoleForPath(pathname);

  const roleAllowed = (allowed: AppRole | AppRole[] | null | undefined) => {
    if (!allowed || !currentRole) {
      return true;
    }

    return Array.isArray(allowed) ? allowed.includes(currentRole) : currentRole === allowed;
  };

  let redirectTarget: string | null = null;

  if (isHydrated && !isDemoMode) {
    if (!currentRole || !currentUser) {
      redirectTarget = "/login";
    } else if (currentUser.mustChangePassword) {
      redirectTarget = "/change-password";
    } else if (!roleAllowed(allowedRole)) {
      redirectTarget = HOME_BY_ROLE[currentRole];
    } else if (!roleAllowed(expectedRole)) {
      redirectTarget = HOME_BY_ROLE[currentRole];
    }
  }

  useEffect(() => {
    if (!redirectTarget) return;
    router.replace(redirectTarget);
  }, [redirectTarget, router]);

  const isReady = isHydrated && (isDemoMode || !redirectTarget);

  if (!isReady) {
    return (
      <div className="p-6">
        <div className="h-6 w-32 rounded-xl border border-border bg-tint" />
      </div>
    );
  }

  return <>{children}</>;
}

