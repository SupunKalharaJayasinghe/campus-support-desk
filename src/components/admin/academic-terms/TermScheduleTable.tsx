"use client";

import { Pencil } from "lucide-react";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export type TermScheduleStatus = "PAST" | "CURRENT" | "FUTURE";
export type NotifyBeforeDays = 1 | 3 | 7;

export interface TermScheduleRowView {
  termCode: string;
  startDate: string;
  endDate: string;
  weeks: number;
  notifyBeforeDays: NotifyBeforeDays;
  status: TermScheduleStatus;
  locked: boolean;
}

interface TermScheduleTableProps {
  rows: TermScheduleRowView[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalItems: number;
  isLoading: boolean;
  loadError: string | null;
  isSaving: boolean;
  onRetry: () => void;
  onEditRow: (row: TermScheduleRowView) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

function termStatusVariant(status: TermScheduleStatus) {
  if (status === "CURRENT") return "success";
  if (status === "PAST") return "neutral";
  return "primary";
}

function termStatusLabel(status: TermScheduleStatus) {
  if (status === "CURRENT") return "Current";
  if (status === "PAST") return "Past";
  return "Future";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toISOString().slice(0, 10);
}

function notifyLabel(value: NotifyBeforeDays) {
  return value === 1 ? "1 day" : `${value} days`;
}

export default function TermScheduleTable({
  rows,
  page,
  pageSize,
  pageCount,
  totalItems,
  isLoading,
  loadError,
  isSaving,
  onRetry,
  onEditRow,
  onPageChange,
  onPageSizeChange,
}: TermScheduleTableProps) {
  return (
    <Card
      className="h-full"
      description="Y1S1 to Y4S2 schedules with computed status and locked past terms."
      title="Term Schedule"
    >
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-border bg-tint">
            <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              <th className="px-4 py-3">Term</th>
              <th className="px-4 py-3">Start Date</th>
              <th className="px-4 py-3">End Date</th>
              <th className="px-4 py-3">Weeks</th>
              <th className="px-4 py-3">Notify Before</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={7}>
                  Loading term schedules...
                </td>
              </tr>
            ) : null}

            {!isLoading && loadError ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-text/72" colSpan={7}>
                  <div className="flex flex-col items-center justify-center gap-3">
                    <span>Failed to load</span>
                    <Button
                      className="h-10 min-w-[108px] border-slate-300 bg-white px-4 text-heading hover:bg-slate-50"
                      onClick={onRetry}
                      variant="secondary"
                    >
                      Retry
                    </Button>
                  </div>
                </td>
              </tr>
            ) : null}

            {!isLoading && !loadError && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={7}>
                  No term schedules available.
                </td>
              </tr>
            ) : null}

            {!isLoading && !loadError
              ? rows.map((row) => (
                  <tr
                    className="border-b border-border/70 transition-colors hover:bg-tint"
                    key={row.termCode}
                  >
                    <td className="px-4 py-4 font-semibold text-heading">{row.termCode}</td>
                    <td className="px-4 py-4 text-text/78">{formatDate(row.startDate)}</td>
                    <td className="px-4 py-4 text-text/78">{formatDate(row.endDate)}</td>
                    <td className="px-4 py-4 text-text/78">{row.weeks}</td>
                    <td className="px-4 py-4 text-text/78">{notifyLabel(row.notifyBeforeDays)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={termStatusVariant(row.status)}>
                          {termStatusLabel(row.status)}
                        </Badge>
                        {row.locked ? (
                          <span className="text-xs font-semibold text-text/55">Locked</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          aria-label={`Edit ${row.termCode}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading disabled:cursor-not-allowed disabled:opacity-55"
                          disabled={isSaving || row.locked}
                          onClick={() => onEditRow(row)}
                          type="button"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <TablePagination
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        totalItems={totalItems}
      />
    </Card>
  );
}
