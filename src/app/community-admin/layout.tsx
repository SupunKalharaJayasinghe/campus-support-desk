import type { ReactNode } from "react";
import CommunityAdminShell from "./_components/CommunityAdminShell";

export default function CommunityAdminLayout({ children }: { children: ReactNode }) {
  return <CommunityAdminShell>{children}</CommunityAdminShell>;
}
