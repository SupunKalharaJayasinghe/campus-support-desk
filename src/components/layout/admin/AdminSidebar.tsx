"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  Wrench,
} from "lucide-react";
import {
  type AdminNavSection,
  buildVisibleAdminSections,
  itemMatchesPath,
  resolveActiveAdminRoute,
} from "@/components/layout/admin/admin-nav";
import { readStoredRole } from "@/models/rbac";

interface FlyoutMetrics {
  maxHeight: number;
  left: number;
  top: number;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const FLYOUT_CLOSE_DELAY_MS = 180;
const FLYOUT_HEIGHT_PADDING = 12;
const FLYOUT_ITEM_HEIGHT = 44;
const FLYOUT_HEADER_HEIGHT = 52;

export interface AdminSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export default function AdminSidebar({
  collapsed,
  onCollapsedChange,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const hoveredButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const role = readStoredRole() ?? "SUPER_ADMIN";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [hoveredSectionKey, setHoveredSectionKey] = useState<string | null>(null);
  const [flyoutMetrics, setFlyoutMetrics] = useState<FlyoutMetrics>({
    maxHeight: 320,
    left: 96,
    top: 12,
  });

  const visibleSections = useMemo(() => {
    return buildVisibleAdminSections(role);
  }, [role]);

  const { activeSection } = useMemo(
    () => resolveActiveAdminRoute(pathname, visibleSections),
    [pathname, visibleSections]
  );
  const activeSectionKey = activeSection?.key ?? "dashboard";

  const hoveredSection = useMemo(() => {
    if (!hoveredSectionKey) return null;
    return visibleSections.find((section) => section.key === hoveredSectionKey) ?? null;
  }, [hoveredSectionKey, visibleSections]);

  const showFlyout = collapsed && Boolean(hoveredSection);
  const flyoutListMaxHeight = Math.max(96, flyoutMetrics.maxHeight - FLYOUT_HEADER_HEIGHT);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const closeFlyout = () => {
    clearCloseTimeout();
    hoveredButtonRef.current = null;
    setHoveredSectionKey(null);
  };

  const scheduleFlyoutClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      hoveredButtonRef.current = null;
      setHoveredSectionKey(null);
    }, FLYOUT_CLOSE_DELAY_MS);
  };

  const positionFlyout = (section: AdminNavSection, buttonElement: HTMLElement) => {
    const buttonRect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const popupWidth = 256;
    const maxHeight = Math.max(160, viewportHeight - FLYOUT_HEIGHT_PADDING * 2);
    const estimatedHeight =
      FLYOUT_HEADER_HEIGHT + section.items.length * FLYOUT_ITEM_HEIGHT + 24;
    const visibleHeight = Math.min(estimatedHeight, maxHeight);
    const anchorCenter = buttonRect.top + buttonRect.height / 2;
    const minTop = FLYOUT_HEIGHT_PADDING;
    const maxTop = Math.max(minTop, viewportHeight - visibleHeight - FLYOUT_HEIGHT_PADDING);
    const top = Math.min(Math.max(anchorCenter - visibleHeight / 2, minTop), maxTop);
    const preferredLeft = buttonRect.right + 12;
    const maxLeft = Math.max(FLYOUT_HEIGHT_PADDING, viewportWidth - popupWidth - FLYOUT_HEIGHT_PADDING);
    const left = Math.min(preferredLeft, maxLeft);

    setFlyoutMetrics({
      maxHeight,
      left,
      top,
    });
  };

  const openFlyout = (section: AdminNavSection, buttonElement: HTMLButtonElement) => {
    clearCloseTimeout();
    hoveredButtonRef.current = buttonElement;
    setHoveredSectionKey(section.key);
    positionFlyout(section, buttonElement);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!collapsed || !hoveredSection || !hoveredButtonRef.current) return;

    const reposition = () => {
      if (!hoveredButtonRef.current) return;
      positionFlyout(hoveredSection, hoveredButtonRef.current);
    };

    reposition();
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("resize", reposition);
    };
  }, [collapsed, hoveredSection]);

  return (
    <aside
      className={cn(
        "admin-sidebar sticky top-0 z-40 flex h-dvh shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[272px]"
      )}
      onMouseEnter={clearCloseTimeout}
      onMouseLeave={collapsed ? scheduleFlyoutClose : undefined}
    >
      <div className="border-b border-border px-3 py-4">
        <div className={cn("flex", collapsed ? "justify-center" : "justify-start")}>
          <button
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="admin-sidebar-toggle inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-tint text-text/80"
            onClick={() => {
              const nextCollapsed = !collapsed;
              if (!nextCollapsed) {
                closeFlyout();
              } else {
                clearCloseTimeout();
              }
              onCollapsedChange(nextCollapsed);
            }}
            type="button"
          >
            {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <Link
          className={cn(
            "admin-sidebar-brand mt-3 flex min-w-0 items-center gap-3 rounded-2xl p-2",
            collapsed ? "justify-center" : ""
          )}
          href="/admin"
        >
          <span className="admin-sidebar-brand-mark inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Wrench size={18} />
          </span>
          {collapsed ? null : (
            <span className="min-w-0">
              <p className="admin-sidebar-brand-title truncate text-sm font-semibold text-heading">
                UniHub LMS
              </p>
              <p className="admin-sidebar-brand-copy text-xs text-text/60">Admin Console</p>
            </span>
          )}
        </Link>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className="h-full overflow-y-auto px-2 py-4"
          onScroll={() => {
            if (!collapsed || !hoveredSection || !hoveredButtonRef.current) return;
            positionFlyout(hoveredSection, hoveredButtonRef.current);
          }}
        >
          {collapsed ? (
            <nav className="space-y-2">
              {visibleSections.map((section) => {
                const Icon = section.icon;
                const isSectionActive = section.key === activeSectionKey;

                return (
                  <button
                    aria-label={section.label}
                    aria-pressed={isSectionActive}
                    className={cn(
                      "admin-sidebar-icon-button flex h-11 w-full items-center justify-center rounded-2xl border transition-colors",
                      isSectionActive
                        ? "border-primary/25 bg-primary/10 text-primary"
                        : "border-transparent text-text/75 hover:border-border hover:bg-tint hover:text-heading"
                    )}
                    data-active={isSectionActive ? "true" : "false"}
                    key={section.key}
                    onBlur={scheduleFlyoutClose}
                    onFocus={(event) => openFlyout(section, event.currentTarget)}
                    onMouseEnter={(event) => openFlyout(section, event.currentTarget)}
                    onMouseLeave={scheduleFlyoutClose}
                    title={section.label}
                    type="button"
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </nav>
          ) : (
            <nav className="space-y-2">
              {visibleSections.map((section) => {
                const Icon = section.icon;
                const isSectionActive = section.key === activeSectionKey;
                const isOpen = openSections[section.key] ?? isSectionActive;

                return (
                  <div key={section.key}>
                    <button
                      aria-expanded={isOpen}
                      className={cn(
                        "admin-sidebar-section-trigger flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                        isSectionActive
                          ? "bg-primary/10 text-primary"
                          : "text-text/82 hover:bg-tint hover:text-heading"
                      )}
                      data-active={isSectionActive ? "true" : "false"}
                      onClick={() =>
                        setOpenSections((previous) => ({
                          ...previous,
                          [section.key]: !isOpen,
                        }))
                      }
                      type="button"
                    >
                      <span className="flex items-center gap-2">
                        <span className="admin-sidebar-section-icon inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-text/80">
                          <Icon size={18} />
                        </span>
                        <span className="text-sm font-semibold">{section.label}</span>
                      </span>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {isOpen ? (
                      <div className="mt-2 space-y-1 pl-4">
                        {section.items.map((item) => {
                          const active = itemMatchesPath(item, pathname);

                          return (
                            <Link
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "admin-sidebar-link block rounded-2xl px-3 py-2 text-sm transition-colors",
                                active
                                  ? "bg-primary/10 font-semibold text-primary"
                                  : "text-text/75 hover:bg-tint hover:text-heading"
                              )}
                              data-active={active ? "true" : "false"}
                              href={item.href}
                              key={item.href}
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          )}
        </div>

        <div
          className={cn(
            "admin-sidebar-flyout fixed z-[80] w-[256px] overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_18px_38px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/70 transition-all duration-200 ease-out",
            showFlyout
              ? "pointer-events-auto translate-x-0 opacity-100"
              : "pointer-events-none translate-x-1 opacity-0"
          )}
          onMouseEnter={clearCloseTimeout}
          onMouseLeave={scheduleFlyoutClose}
          style={{
            left: flyoutMetrics.left,
            maxHeight: flyoutMetrics.maxHeight,
            top: flyoutMetrics.top,
          }}
        >
          {hoveredSection ? (
            <>
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                  {hoveredSection.label}
                </p>
              </div>
              <div
                className="sidebar-flyout-scroll overflow-y-auto px-3 py-3"
                style={{
                  maxHeight: flyoutListMaxHeight,
                  scrollbarWidth: "thin",
                }}
              >
                <div className="space-y-1">
                  {hoveredSection.items.map((item) => {
                    const active = itemMatchesPath(item, pathname);

                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "admin-sidebar-flyout-link flex h-10 items-center rounded-2xl px-3 text-sm transition-colors",
                          active
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-text/75 hover:bg-tint hover:text-heading"
                        )}
                        data-active={active ? "true" : "false"}
                        href={item.href}
                        key={item.href}
                        onClick={closeFlyout}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

