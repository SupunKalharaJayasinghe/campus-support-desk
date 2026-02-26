"use client";

import { useEffect, useState } from "react";
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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const currentRole = readStoredRole();

    if (!currentRole) {
      router.replace("/login");
      return;
    }

    const expectedRole = getExpectedRoleForPath(pathname);

    if (allowedRole && currentRole !== allowedRole) {
      router.replace(HOME_BY_ROLE[currentRole]);
      return;
    }

    if (expectedRole && currentRole !== expectedRole) {
      router.replace(HOME_BY_ROLE[currentRole]);
      return;
    }

    setIsReady(true);
  }, [allowedRole, pathname, router]);

  if (!isReady) {
    return (
      <div className="p-6">
        <div className="h-6 w-32 animate-pulse rounded-lg bg-surface2" />
      </div>
    );
  }

  return <>{children}</>;
}
