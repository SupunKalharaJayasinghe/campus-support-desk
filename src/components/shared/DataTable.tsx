"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { useToast } from "@/hooks/useToast";

export interface DataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  searchPlaceholder?: string;
  rowActions?: (row: T) => DropdownItem[];
  exportable?: boolean;
  selectable?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  loading,
  searchPlaceholder = "Search",
  rowActions,
  exportable,
  selectable
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const toast = useToast();

  const filteredData = useMemo(() => {
    if (!query) return data;
    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some((value) =>
        String(value).toLowerCase().includes(query.toLowerCase())
      )
    );
  }, [data, query]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));

  const augmentedColumns: TableColumn<T>[] = rowActions
    ? [
        ...columns,
        {
          key: "actions",
          header: "Actions",
          render: (row) => (
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  Actions
                </Button>
              }
              items={rowActions(row)}
            />
          )
        }
      ]
    : columns;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
          className="w-full max-w-xs"
        />
        {exportable && (
          <Button
            variant="outline"
            iconLeft={<Download className="h-4 w-4" />}
            onClick={() => toast.success("Export generated.", "Export")}
          >
            Export
          </Button>
        )}
      </div>
      <div className="block md:hidden">
        {paginatedData.map((row, index) => (
          <div
            key={index}
            className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            {columns.map((column) => (
              <div key={String(column.key)} className="flex justify-between py-1">
                <span className="text-xs text-slate-500">{column.header}</span>
                <span className="text-sm text-slate-700">
                  {column.render
                    ? column.render(row)
                    : String(
                        (row as Record<string, unknown>)[
                          column.key as string
                        ] ?? ""
                      )}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <Table
          data={paginatedData}
          columns={augmentedColumns}
          loading={loading}
          selectable={selectable}
          pagination={{
            page,
            totalPages,
            pageSize,
            totalItems: filteredData.length,
            onPageChange: setPage,
            onPageSizeChange: setPageSize
          }}
        />
      </div>
    </div>
  );
}
