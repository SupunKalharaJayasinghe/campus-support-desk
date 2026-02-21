"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";

export type TableColumn<T> = {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (row: T) => React.ReactNode;
};

export type TablePagination = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  emptyMessage?: string;
  selectable?: boolean;
  getRowId?: (row: T, index: number) => string;
  onSelectionChange?: (selectedIds: string[]) => void;
  pagination?: TablePagination;
}

type SortState = {
  key: string | null;
  direction: "asc" | "desc";
};

export function Table<T>({
  data,
  columns,
  loading,
  emptyMessage = "No records found.",
  selectable,
  getRowId,
  onSelectionChange,
  pagination
}: TableProps<T>) {
  const [sortState, setSortState] = useState<SortState>({
    key: null,
    direction: "asc"
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const resolvedRowId = (row: T, index: number) =>
    getRowId?.(row, index) ?? `${index}`;

  const sortedData = useMemo(() => {
    if (!sortState.key) return data;
    const sorted = [...data].sort((a, b) => {
      const aValue = (a as Record<string, unknown>)[sortState.key as string];
      const bValue = (b as Record<string, unknown>)[sortState.key as string];
      if (aValue == null || bValue == null) return 0;
      if (aValue < bValue) return sortState.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortState.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, sortState]);

  const handleSort = (key: string) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedData.length) {
      setSelectedIds([]);
      onSelectionChange?.([]);
      return;
    }
    const nextIds = sortedData.map((row, index) => resolvedRowId(row, index));
    setSelectedIds(nextIds);
    onSelectionChange?.(nextIds);
  };

  const toggleSelectRow = (rowId: string) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(rowId);
      const next = exists ? prev.filter((id) => id !== rowId) : [...prev, rowId];
      onSelectionChange?.(next);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {selectable && (
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={
                      selectedIds.length > 0 &&
                      selectedIds.length === sortedData.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    "px-4 py-3 text-left font-medium",
                    column.sortable && "cursor-pointer select-none",
                    column.className
                  )}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.header}</span>
                    {column.sortable && sortState.key === column.key && (
                      <span className="text-xs text-slate-400">
                        {sortState.direction === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`loading-${idx}`}>
                  {selectable && (
                    <td className="px-4 py-3">
                      <Skeleton variant="circle" className="h-4 w-4" />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={String(column.key)} className="px-4 py-3">
                      <Skeleton variant="text" className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && sortedData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              sortedData.map((row, index) => {
                const rowId = resolvedRowId(row, index);
                return (
                  <tr key={rowId} className="hover:bg-slate-50">
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={selectedIds.includes(rowId)}
                          onChange={() => toggleSelectRow(rowId)}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={String(column.key)} className="px-4 py-3">
                        {column.render
                          ? column.render(row)
                          : String(
                              (row as Record<string, unknown>)[
                                column.key as string
                              ] ?? ""
                            )}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </div>
  );
}
