"use client";

import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";

interface TablePaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function TablePagination({
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: TablePaginationProps) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  return (
    <div
      className={cn(
        "mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-text/68">
        <span>
          Showing <span className="font-semibold text-heading">{start}–{end}</span> of{" "}
          <span className="font-semibold text-heading">{totalItems}</span>
        </span>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
            Rows
          </span>
          <Select
            aria-label="Rows per page"
            className="h-10 w-[112px]"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          variant="secondary"
        >
          Previous
        </Button>
        <span className="px-1 text-sm text-text/70">
          Page <span className="font-semibold text-heading">{page}</span> of{" "}
          <span className="font-semibold text-heading">{pageCount}</span>
        </span>
        <Button
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          variant="secondary"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
