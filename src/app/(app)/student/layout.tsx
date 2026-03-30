"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Medal,
  Megaphone,
  Menu,
  Search,
  Sparkles,
  Trophy,
  type LucideIcon,
  X,
} from "lucide-react";
import RoleGuard from "@/components/auth/RoleGuard";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { clearDemoSession, isDemoModeEnabled } from "@/lib/rbac";

interface StudentNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface StudentNavGroup {
  key: string;
  label: string;
  items: StudentNavItem[];
}

const DASHBOARD_LINK: StudentNavItem = {
  label: "Dashboard",
  href: "/student",
  icon: LayoutDashboard,
};

const ACADEMICS_GROUP: StudentNavGroup = {
  key: "academics",
  label: "Academics",
  items: [
    { label: "Quizzes", href: "/student/quizzes", icon: BookOpen },
    { label: "Performance", href: "/student/performance", icon: BarChart3 },
  ],
};

const GAMIFICATION_GROUP: StudentNavGroup = {
  key: "gamification",
  label: "Gamification",
  items: [
    { label: "My XP", href: "/student/gamification", icon: Sparkles },
    { label: "Trophies", href: "/student/trophies", icon: Trophy },
    { label: "Leaderboard", href: "/student/leaderboard", icon: Medal },
  ],
};

const CAMPUS_GROUP: StudentNavGroup = {
  key: "campus",
  label: "Campus",
  items: [
    { label: "Book Lecturer", href: "/student/booking", icon: CalendarDays },
    { label: "Announcements", href: "/student/announcements", icon: Megaphone },
    
  ],
};
  const SUPPORT_GROUP: StudentNavGroup = {
  key: "support",
  label: "Support",
  items: [
    
    { label: "Report ", href: "/report-problem", icon: Search },
    { label: "Community Help", href: "/community", icon: HelpCircle },
  ],
};

const NAV_GROUPS: StudentNavGroup[] = [
  ACADEMICS_GROUP,
  GAMIFICATION_GROUP,
  CAMPUS_GROUP,
  SUPPORT_GROUP,
];

function isActivePath(pathname: string, href: string) {
  if (href === "/student") {
    return pathname === href || pathname === `${href}/overview`;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavDropdownItem({
  item,
  active,
  onClick,
}: {
  item: StudentNavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      className={[
        "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all duration-150",
        active
          ? "border-[#034AA6]/30 bg-[#034AA6]/10 font-medium text-[#034AA6]"
          : "border-transparent text-[#26150F]/82 hover:border-[#034AA6]/16 hover:bg-[#034AA6]/6 hover:text-[#0339A6]",
      ].join(" ")}
      href={item.href}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

export default function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLDivElement | null>(null);
  const signOutRedirect = isDemoModeEnabled() ? "/" : "/login";

  const [navState, setNavState] = useState(() => ({
    path: pathname,
    openDropdown: null as string | null,
    mobileMenuOpen: false,
    openMobileSection: null as string | null,
  }));
  const isCurrentPathState = navState.path === pathname;
  const openDropdown = isCurrentPathState ? navState.openDropdown : null;
  const mobileMenuOpen = isCurrentPathState ? navState.mobileMenuOpen : false;
  const openMobileSection = isCurrentPathState ? navState.openMobileSection : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setNavState({
          path: pathname,
          openDropdown: null,
          mobileMenuOpen: false,
          openMobileSection: null,
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pathname]);

  const isGroupActive = (group: StudentNavGroup) =>
    group.items.some((item) => isActivePath(pathname, item.href));

  const closeMenus = () =>
    setNavState({
      path: pathname,
      openDropdown: null,
      mobileMenuOpen: false,
      openMobileSection: null,
    });

  const toggleDropdown = (groupKey: string) =>
    setNavState((current) => {
      const base =
        current.path === pathname
          ? current
          : {
              path: pathname,
              openDropdown: null,
              mobileMenuOpen: false,
              openMobileSection: null,
            };

      return {
        path: pathname,
        openDropdown: base.openDropdown === groupKey ? null : groupKey,
        mobileMenuOpen: false,
        openMobileSection: null,
      };
    });

  const toggleMobileMenu = () =>
    setNavState((current) => {
      const base =
        current.path === pathname
          ? current
          : {
              path: pathname,
              openDropdown: null,
              mobileMenuOpen: false,
              openMobileSection: null,
            };

      return {
        path: pathname,
        openDropdown: null,
        mobileMenuOpen: !base.mobileMenuOpen,
        openMobileSection: base.mobileMenuOpen ? null : base.openMobileSection,
      };
    });

  const toggleMobileSection = (groupKey: string) =>
    setNavState((current) => ({
      path: pathname,
      openDropdown: null,
      mobileMenuOpen: true,
      openMobileSection:
        current.path === pathname && current.openMobileSection === groupKey
          ? null
          : groupKey,
    }));

  const handleSignOut = () => {
    closeMenus();
    clearDemoSession();
    router.replace(signOutRedirect);
  };

  return (
    <RoleGuard allowedRole="STUDENT">
      <div className="min-h-screen bg-bg">
        <header
          className="fixed inset-x-0 top-0 z-40 border-b border-[#BFBFBF]/45 bg-white/96 shadow-[0_6px_24px_rgba(38,21,15,0.05)] backdrop-blur"
          ref={navRef}
        >
          <Container
            className="flex h-16 items-center gap-3 py-3"
            size="6xl"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Link
                className="inline-flex items-center rounded-lg px-1 py-1 text-base font-semibold tracking-tight text-[#0A0A0A] transition-colors hover:text-[#0339A6]"
                href="/student"
              >
                UniHub
              </Link>
            </div>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-2 md:flex">
              <Link
                className={[
                  "inline-flex items-center rounded-full border px-3 py-2 text-sm font-medium transition-all duration-150",
                  isActivePath(pathname, DASHBOARD_LINK.href)
                    ? "border-[#034AA6]/30 bg-[#034AA6]/10 text-[#034AA6]"
                    : "border-transparent text-[#26150F]/82 hover:border-[#034AA6]/18 hover:bg-[#034AA6]/6 hover:text-[#0339A6]",
                ].join(" ")}
                href={DASHBOARD_LINK.href}
              >
                {DASHBOARD_LINK.label}
              </Link>

              {NAV_GROUPS.map((group) => {
                const active = isGroupActive(group);
                const open = openDropdown === group.key;

                return (
                  <div className="relative" key={group.key}>
                    <button
                      aria-expanded={open}
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-150",
                        active || open
                          ? "border-[#034AA6]/30 bg-[#034AA6]/10 text-[#034AA6]"
                          : "border-transparent text-[#26150F]/82 hover:border-[#034AA6]/18 hover:bg-[#034AA6]/6 hover:text-[#0339A6]",
                      ].join(" ")}
                      onClick={() => toggleDropdown(group.key)}
                      type="button"
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={[
                          "h-4 w-4 transition-transform duration-200",
                          open ? "rotate-180" : "rotate-0",
                        ].join(" ")}
                      />
                    </button>

                    <div
                      aria-hidden={!open}
                      className={[
                        "absolute left-0 top-[calc(100%+0.6rem)] w-56 rounded-2xl border border-[#BFBFBF]/55 bg-white p-2 shadow-[0_18px_40px_rgba(38,21,15,0.12)] transition-all duration-150",
                        open
                          ? "visible translate-y-0 opacity-100"
                          : "pointer-events-none invisible translate-y-2 opacity-0",
                      ].join(" ")}
                    >
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <NavDropdownItem
                            active={isActivePath(pathname, item.href)}
                            item={item}
                            key={item.href}
                            onClick={closeMenus}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </nav>

            <div className="ml-auto hidden items-center justify-end md:flex">
              <Button
                className="border-[#26150F]/28 bg-white text-[#26150F] hover:border-[#0339A6]/55 hover:bg-white hover:text-[#0339A6]"
                onClick={handleSignOut}
                variant="secondary"
              >
                <LogOut size={16} />
                <span className="ml-1">Sign out</span>
              </Button>
            </div>

            <button
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle student navigation menu"
              className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#26150F]/24 text-[#26150F] transition-colors duration-150 hover:border-[#0339A6]/45 hover:text-[#0339A6] md:hidden"
              onClick={toggleMobileMenu}
              type="button"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </Container>

          <div
            className={[
              "overflow-hidden border-t border-[#BFBFBF]/45 bg-white transition-all duration-200 md:hidden",
              mobileMenuOpen ? "max-h-[85vh] opacity-100" : "max-h-0 opacity-0",
            ].join(" ")}
          >
            <Container className="py-3" size="6xl">
              <div className="rounded-2xl border border-[#BFBFBF]/55 bg-white p-3 shadow-[0_10px_32px_rgba(38,21,15,0.08)]">
                <div className="space-y-2">
                  <Link
                    className={[
                      "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-all duration-150",
                      isActivePath(pathname, DASHBOARD_LINK.href)
                        ? "border-[#034AA6]/30 bg-[#034AA6]/10 font-medium text-[#034AA6]"
                        : "border-transparent text-[#26150F]/82 hover:border-[#034AA6]/18 hover:bg-[#034AA6]/6 hover:text-[#0339A6]",
                    ].join(" ")}
                    href={DASHBOARD_LINK.href}
                    onClick={closeMenus}
                  >
                    <DASHBOARD_LINK.icon className="h-4 w-4 shrink-0" />
                    <span>{DASHBOARD_LINK.label}</span>
                  </Link>

                  {NAV_GROUPS.map((group) => {
                    const active = isGroupActive(group);
                    const open = openMobileSection === group.key;

                    return (
                      <div
                        className="rounded-2xl border border-[#BFBFBF]/45 bg-[#FBFAF8]"
                        key={group.key}
                      >
                        <button
                          aria-expanded={open}
                          className={[
                            "flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm font-medium transition-colors duration-150",
                            active || open
                              ? "text-[#034AA6]"
                              : "text-[#26150F]/88 hover:text-[#0339A6]",
                          ].join(" ")}
                          onClick={() => toggleMobileSection(group.key)}
                          type="button"
                        >
                          <span>{group.label}</span>
                          <ChevronDown
                            className={[
                              "h-4 w-4 transition-transform duration-200",
                              open ? "rotate-180" : "rotate-0",
                            ].join(" ")}
                          />
                        </button>

                        <div
                          className={[
                            "overflow-hidden transition-all duration-200",
                            open ? "max-h-80 px-3 pb-3 opacity-100" : "max-h-0 opacity-0",
                          ].join(" ")}
                        >
                          <div className="space-y-1 border-t border-[#BFBFBF]/45 pt-3">
                            {group.items.map((item) => (
                              <NavDropdownItem
                                active={isActivePath(pathname, item.href)}
                                item={item}
                                key={item.href}
                                onClick={closeMenus}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  className="mt-3 w-full justify-center border-[#26150F]/28 bg-white text-[#26150F] hover:border-[#0339A6]/55 hover:bg-white hover:text-[#0339A6]"
                  onClick={handleSignOut}
                  variant="secondary"
                >
                  <LogOut size={16} />
                  <span className="ml-1">Sign out</span>
                </Button>
              </div>
            </Container>
          </div>
        </header>

        <main className="px-0 pb-8 pt-20">
          <Container size="6xl">{children}</Container>
        </main>
      </div>
    </RoleGuard>
  );
}
