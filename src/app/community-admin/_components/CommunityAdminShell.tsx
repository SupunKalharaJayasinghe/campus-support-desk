"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { clearDemoSession, isDemoModeEnabled } from "@/lib/rbac";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const PRIMARY_NAV: Array<{
  id: string;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
}> = [
  {
    id: "dash-overview",
    label: "Overview",
    href: "/community-admin#overview",
    match: (p) => p === "/community-admin" || p === "/community-admin/",
  },
  {
    id: "members",
    label: "Community Members",
    href: "/community-admin/members",
    match: (p) => p.startsWith("/community-admin/members"),
  },
  {
    id: "reports",
    label: "Reported Posts",
    href: "/community-admin/reported-posts",
    match: (p) => p.startsWith("/community-admin/reported-posts"),
  },
];

const SUB_LINKS_MEMBERS = [
  { hash: "overview", label: "Page overview" },
  { hash: "filters", label: "Search" },
  { hash: "directory", label: "Member directory" },
];

const SUB_LINKS_REPORTS = [
  { hash: "filters", label: "Filters" },
  { hash: "reports", label: "Report queue" },
];

const SUB_LINKS_DASHBOARD = [
  { hash: "overview", label: "Overview" },
  { hash: "quick-links", label: "Quick links" },
];

const navLinkClass =
  "block rounded-xl border border-border bg-card px-3 py-2 text-sm whitespace-nowrap text-text/80 transition-colors hover:bg-tint hover:text-heading";

const navLinkActiveClass = "border-primary/35 bg-primary/10 text-heading";

export default function CommunityAdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "";

  const header = useMemo(() => {
    if (pathname.startsWith("/community-admin/members")) {
      return {
        title: "Community members",
        subtitle:
          "Browse everyone in the campus community from the User table (students). Search by name, email, or user ID.",
      };
    }
    if (pathname.startsWith("/community-admin/reported-posts")) {
      return {
        title: "Reported posts",
        subtitle: "Inspect the report queue, open a report, and apply moderation decisions.",
      };
    }
    return {
      title: "Community Admin",
      subtitle:
        "Monitor members, inspect reported posts, and manage moderation actions from one place.",
    };
  }, [pathname]);

  const subLinks = useMemo(() => {
    if (pathname.startsWith("/community-admin/members")) return SUB_LINKS_MEMBERS;
    if (pathname.startsWith("/community-admin/reported-posts")) return SUB_LINKS_REPORTS;
    return SUB_LINKS_DASHBOARD;
  }, [pathname]);

  const handleLogout = () => {
    clearDemoSession();
    router.replace(isDemoModeEnabled() ? "/" : "/login");
  };

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-bg">
      <header className="flex shrink-0 flex-col gap-4 border-b border-border bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
            {header.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text/72">{header.subtitle}</p>
        </div>
        <Button
          className="h-11 shrink-0 gap-2 !rounded-full border-heading/20 px-5 text-heading hover:border-heading/35 hover:bg-tint"
          type="button"
          variant="secondary"
        >
          <ShieldCheck size={16} className="text-heading/80" aria-hidden />
          Moderation Rules
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-3 pb-3 pt-3 md:flex-row md:gap-6 md:px-5 md:pb-4 md:pt-4">
        <aside
          aria-label="Community admin navigation"
          className="flex w-full shrink-0 flex-col border-b border-border pb-3 md:w-[260px] md:min-h-0 md:shrink-0 md:self-stretch md:border-b-0 md:border-r md:pb-0 md:pr-5"
        >
          <Card
            title="Sections"
            description="Move between dashboard areas."
            className="min-h-0 rounded-2xl p-4 md:flex-1 md:overflow-y-auto md:overscroll-contain"
          >
            <nav aria-label="Primary admin pages" className="space-y-1.5">
              {PRIMARY_NAV.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(navLinkClass, active && navLinkActiveClass)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-text/55">
              On this page
            </p>
            <nav aria-label="In-page sections" className="mt-2 space-y-1.5">
              {subLinks.map((item) => (
                <a
                  key={item.hash}
                  href={`#${item.hash}`}
                  className={cn(navLinkClass, "text-text/75")}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </Card>
          <div className="mt-3 shrink-0 border-t border-border pt-3 md:mt-auto">
            <Button
              className="h-10 w-full gap-2 focus-visible:ring-red-500"
              type="button"
              variant="danger"
              onClick={handleLogout}
            >
              <LogOut size={16} aria-hidden />
              Logout
            </Button>
          </div>
        </aside>

        <main
          id="community-admin-main"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
