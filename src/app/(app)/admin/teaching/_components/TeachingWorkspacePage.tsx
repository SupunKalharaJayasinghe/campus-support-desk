"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ListFilter,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type SummaryTone = "sky" | "teal" | "amber" | "green" | "rose" | "violet";
type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "primary" | "info";
type PageSize = 5 | 10 | 25;

export interface TeachingWorkspaceSummaryCard {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: SummaryTone;
}

export interface TeachingWorkspaceRow {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  coverage: string;
  coverageMeta: string;
  status: string;
  statusVariant: BadgeVariant;
  statusMeta: string;
  owner: string;
  ownerMeta: string;
  checkpoint: string;
  checkpointMeta: string;
  detailItems: string[];
  searchText?: string;
}

export interface TeachingWorkspaceFilterOption {
  label: string;
  value: string;
}

export interface TeachingWorkspaceConfig {
  sectionLabel: string;
  title: string;
  description: string;
  visibleDescription: string;
  actionLabel: string;
  actionIcon: LucideIcon;
  searchPlaceholder: string;
  filterLabel: string;
  filterOptions: TeachingWorkspaceFilterOption[];
  highlights: string[];
  summaryCards: TeachingWorkspaceSummaryCard[];
  rows: TeachingWorkspaceRow[];
  boardTitle: string;
  boardDescription: string;
  emptyMessage: string;
  plannerBadge: string;
  plannerTitle: string;
  plannerDescription: string;
  plannerChecklist: string[];
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: TeachingWorkspaceSummaryCard) {
  return (
    <Card accent className="admin-stat-card h-full p-5" data-tone={tone}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-heading">{value}</p>
        </div>
        <span className="admin-stat-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-current">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-4 text-xs text-text/60">{detail}</p>
    </Card>
  );
}

function DetailCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-white/76 p-4 shadow-[0_12px_28px_rgba(15,23,41,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">{label}</p>
      <p className="mt-2 text-base font-semibold text-heading">{value}</p>
      <p className="mt-1 text-sm leading-6 text-text/68">{meta}</p>
    </div>
  );
}

export default function TeachingWorkspacePage({
  config,
}: {
  config: TeachingWorkspaceConfig;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState(config.filterOptions[0]?.value ?? "");
  const [pageSize, setPageSize] = useState<PageSize>(5);
  const [page, setPage] = useState(1);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(searchQuery);
  const ActionIcon = config.actionIcon;
  const activeRow = useMemo(
    () => config.rows.find((row) => row.id === activeRowId) ?? null,
    [activeRowId, config.rows]
  );
  const isOverlayOpen = isPlannerOpen || Boolean(activeRow);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOverlayOpen]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setIsPlannerOpen(false);
      setActiveRowId(null);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOverlayOpen]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    return config.rows.filter((row) => {
      const matchesFilter = filterValue ? row.category === filterValue : true;
      const searchableText = [
        row.title,
        row.subtitle,
        row.coverage,
        row.coverageMeta,
        row.status,
        row.statusMeta,
        row.owner,
        row.ownerMeta,
        row.checkpoint,
        row.checkpointMeta,
        row.searchText ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = normalizedQuery ? searchableText.includes(normalizedQuery) : true;

      return matchesFilter && matchesSearch;
    });
  }, [config.rows, deferredSearch, filterValue]);

  const totalCount = visibleRows.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginatedRows = visibleRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const filtersApplied = Boolean(searchQuery.trim() || filterValue);
  const contentBlurClass = isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : "";
  const filterLabel =
    config.filterOptions.find((option) => option.value === filterValue)?.label ??
    config.filterOptions[0]?.label ??
    "All items";

  const resetFilters = () => {
    setSearchQuery("");
    setFilterValue(config.filterOptions[0]?.value ?? "");
    setPage(1);
  };

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <div className={cn("flex justify-end", contentBlurClass)}>
        <Button
          className="h-11 gap-2 px-5"
          onClick={() => {
            setActiveRowId(null);
            setIsPlannerOpen(true);
          }}
        >
          <ActionIcon size={16} />
          {config.actionLabel}
        </Button>
      </div>

      <section
        className={cn(
          "grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]",
          contentBlurClass
        )}
      >
        <Card accent className="p-6 lg:p-7">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="neutral">{config.sectionLabel}</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                  {config.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  {config.description}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[190px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Visible Results
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                    {totalCount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    {filtersApplied
                      ? "Matching the current search and filters"
                      : config.visibleDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-end">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Search
                </label>
                <div className="group flex h-14 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                  <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Search size={17} />
                  </span>
                  <input
                    aria-label={`Search ${config.title}`}
                    className="h-full w-full border-0 bg-transparent pr-2 text-[15px] text-heading outline-none placeholder:text-text/48"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder={config.searchPlaceholder}
                    value={searchQuery}
                  />
                  {searchQuery.trim() ? (
                    <button
                      aria-label="Clear search"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text/45 transition-colors hover:bg-primary/8 hover:text-primary"
                      onClick={() => {
                        setSearchQuery("");
                        setPage(1);
                      }}
                      type="button"
                    >
                      <X size={15} />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  {config.filterLabel}
                </label>
                <div className="group relative flex h-14 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                  <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ListFilter size={16} />
                  </span>
                  <select
                    aria-label={config.filterLabel}
                    className="h-full w-full appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                    onChange={(event) => {
                      setFilterValue(event.target.value);
                      setPage(1);
                    }}
                    value={filterValue}
                  >
                    {config.filterOptions.map((option) => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                    size={17}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {config.highlights.map((item) => (
                <div
                  className="rounded-[22px] border border-border bg-white/72 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,41,0.04)]"
                  key={item}
                >
                  <p className="text-sm font-medium text-heading">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {config.summaryCards.map((item) => (
            <SummaryCard
              detail={item.detail}
              icon={item.icon}
              key={item.label}
              label={item.label}
              tone={item.tone}
              value={item.value}
            />
          ))}
        </div>
      </section>

      <Card className={cn("overflow-hidden p-0 transition-all", contentBlurClass)}>
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-heading">{config.boardTitle}</p>
            <p className="mt-1 text-sm text-text/68">{config.boardDescription}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={filterValue ? "primary" : "neutral"}>{filterLabel}</Badge>
            {searchQuery.trim() ? (
              <Badge
                className="max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap"
                variant="primary"
              >
                Search: {searchQuery.trim()}
              </Badge>
            ) : null}
            {filtersApplied ? (
              <Button className="h-9 px-3 text-xs" onClick={resetFilters} variant="ghost">
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="overflow-hidden rounded-[28px] border border-border bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-[rgba(255,255,255,0.82)]">
                  <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    <th className="px-5 py-4">Workspace Item</th>
                    <th className="px-5 py-4">Coverage</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Resources</th>
                    <th className="px-5 py-4">Next Checkpoint</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {paginatedRows.map((row) => (
                    <tr
                      className="transition-colors duration-200 hover:bg-white/70"
                      key={row.id}
                    >
                      <td className="px-5 py-4 align-top">
                        <div>
                          <p className="font-semibold text-heading">{row.title}</p>
                          <p className="mt-1 text-xs leading-5 text-text/55">{row.subtitle}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-heading">{row.coverage}</p>
                        <p className="mt-1 text-xs leading-5 text-text/55">{row.coverageMeta}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-1.5">
                          <Badge variant={row.statusVariant}>{row.status}</Badge>
                          <p className="text-xs leading-5 text-text/55">{row.statusMeta}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-heading">{row.owner}</p>
                        <p className="mt-1 text-xs leading-5 text-text/55">{row.ownerMeta}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-heading">{row.checkpoint}</p>
                        <p className="mt-1 text-xs leading-5 text-text/55">
                          {row.checkpointMeta}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex justify-end">
                          <button
                            aria-label={`Review ${row.title}`}
                            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-white/75 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-heading hover:shadow-shadow"
                            onClick={() => {
                              setIsPlannerOpen(false);
                              setActiveRowId(row.id);
                            }}
                            type="button"
                          >
                            Review
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={6}>
                        {config.emptyMessage}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <TablePagination
          className="mt-0 px-6 pb-6"
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value as PageSize);
            setPage(1);
          }}
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 25]}
          totalItems={totalCount}
        />
      </Card>

      {isPlannerOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsPlannerOpen(false);
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] border border-border bg-[rgba(255,255,255,0.94)] shadow-[0_32px_80px_rgba(15,23,42,0.24)]"
            role="dialog"
          >
            <div className="overflow-y-auto px-6 py-6 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-xl">
                  <Badge variant="neutral">{config.plannerBadge}</Badge>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                    {config.plannerTitle}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text/68">
                    {config.plannerDescription}
                  </p>
                </div>

                <button
                  aria-label="Close planner"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/80 text-text/70 transition-all hover:bg-white hover:text-heading"
                  onClick={() => setIsPlannerOpen(false)}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {config.plannerChecklist.map((item) => (
                  <div
                    className="rounded-[22px] border border-border bg-white/76 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,41,0.04)]"
                    key={item}
                  >
                    <p className="text-sm font-medium text-heading">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border bg-white/90 px-6 py-4 sm:px-7">
              <div className="flex justify-end">
                <Button className="h-11 min-w-[112px] px-5" onClick={() => setIsPlannerOpen(false)} variant="secondary">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeRow ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveRowId(null);
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-border bg-[rgba(255,255,255,0.95)] shadow-[0_28px_72px_rgba(15,23,42,0.24)]"
            role="dialog"
          >
            <div className="overflow-y-auto px-6 py-6 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <Badge variant={activeRow.statusVariant}>{activeRow.status}</Badge>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                    {activeRow.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text/68">{activeRow.subtitle}</p>
                </div>

                <button
                  aria-label="Close details"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/80 text-text/70 transition-all hover:bg-white hover:text-heading"
                  onClick={() => setActiveRowId(null)}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <DetailCard
                  label="Coverage"
                  meta={activeRow.coverageMeta}
                  value={activeRow.coverage}
                />
                <DetailCard
                  label="Status"
                  meta={activeRow.statusMeta}
                  value={activeRow.status}
                />
                <DetailCard
                  label="Resources"
                  meta={activeRow.ownerMeta}
                  value={activeRow.owner}
                />
                <DetailCard
                  label="Next Checkpoint"
                  meta={activeRow.checkpointMeta}
                  value={activeRow.checkpoint}
                />
              </div>

              <div className="mt-6 rounded-[26px] border border-border bg-white/78 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-text/55">
                  Execution Notes
                </p>
                <div className="mt-4 space-y-3">
                  {activeRow.detailItems.map((item) => (
                    <div
                      className="rounded-[20px] border border-border bg-white/80 px-4 py-3"
                      key={item}
                    >
                      <p className="text-sm leading-6 text-heading">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-white/90 px-6 py-4 sm:px-7">
              <div className="flex justify-end">
                <Button className="h-11 min-w-[112px] px-5" onClick={() => setActiveRowId(null)} variant="secondary">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
