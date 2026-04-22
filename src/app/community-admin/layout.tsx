import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/ToastProvider";
import CommunityAdminShell from "./_components/CommunityAdminShell";

export default function CommunityAdminLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <CommunityAdminShell>{children}</CommunityAdminShell>
    </ToastProvider>
  );
}
