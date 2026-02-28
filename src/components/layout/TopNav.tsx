"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { clearDemoSession } from "@/lib/rbac";

export interface TopNavLink {
  label: string;
  href: string;
}

interface TopNavProps {
  links: TopNavLink[];
  homeHref: string;
  currentPath?: string;
}

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/") return pathname === "/";
  return pathname.startsWith(`${href}/`);
}

export default function TopNav({
  links,
  homeHref,
  currentPath,
}: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const activePath = currentPath ?? pathname;

  useEffect(() => {
    setMenuOpen(false);
  }, [activePath]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[#BFBFBF]/45 bg-white/96 backdrop-blur">
      <Container
        className="grid h-16 grid-cols-[auto_1fr_auto] items-center gap-4 py-3"
        size="6xl"
      >
        <div className="flex items-center">
          <Link
            className="inline-flex items-center rounded-lg px-1 py-1 text-base font-semibold tracking-tight text-[#0A0A0A] transition-colors hover:text-[#0339A6]"
            href={homeHref}
          >
            UniHub
          </Link>
        </div>

        <nav className="hidden items-center justify-center gap-3 lg:flex">
          {links.map((item) => {
            const active = isActivePath(activePath, item.href);
            return (
              <Link
                className={[
                  "border-b-2 px-1 py-1 text-sm font-medium tracking-[0.01em] transition-colors duration-200",
                  active
                    ? "border-[#034AA6] text-[#034AA6]"
                    : "border-transparent text-[#26150F]/82 hover:text-[#0339A6]",
                ].join(" ")}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center justify-end lg:flex">
          <Button
            className="border-[#26150F]/28 bg-white text-[#26150F] hover:border-[#0339A6]/55 hover:bg-white hover:text-[#0339A6]"
            onClick={() => {
              clearDemoSession();
              router.replace("/login");
            }}
            variant="secondary"
          >
            <LogOut size={16} />
            <span className="ml-1">Sign out</span>
          </Button>
        </div>

        <button
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
          className="inline-flex h-9 w-9 items-center justify-center justify-self-end rounded-lg border border-[#26150F]/24 text-[#26150F] transition-colors duration-200 hover:border-[#0339A6]/50 hover:text-[#0339A6] lg:hidden"
          onClick={() => setMenuOpen((previous) => !previous)}
          type="button"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </Container>

      {menuOpen ? (
        <div className="border-t border-[#BFBFBF]/45 bg-white lg:hidden">
          <Container className="py-3" size="6xl">
            <div className="rounded-2xl border border-[#BFBFBF]/55 bg-white p-3 shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
              <nav className="space-y-1">
                {links.map((item) => {
                  const active = isActivePath(activePath, item.href);
                  return (
                    <Link
                      className={[
                        "block rounded-lg border px-3 py-2 text-sm transition-colors duration-200",
                        active
                          ? "border-[#034AA6]/35 bg-[#034AA6]/8 font-medium text-[#034AA6]"
                          : "border-transparent text-[#26150F]/82 hover:border-[#034AA6]/30 hover:text-[#0339A6]",
                      ].join(" ")}
                      href={item.href}
                      key={item.href}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <Button
                className="mt-3 w-full justify-center border-[#26150F]/28 bg-white text-[#26150F] hover:border-[#0339A6]/55 hover:bg-white hover:text-[#0339A6]"
                onClick={() => {
                  clearDemoSession();
                  router.replace("/login");
                }}
                variant="secondary"
              >
                <LogOut size={16} />
                <span className="ml-1">Sign out</span>
              </Button>
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
