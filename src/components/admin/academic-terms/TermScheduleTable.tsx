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
  manuallyEdited?: boolean;
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
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
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
    <Card className="overflow-hidden p-0 transition-all">
      <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-heading">Term Schedule</p>
          <p className="mt-1 text-sm text-text/68">
            Y1S1 to Y4S2 schedules with computed status, edit controls, and locked
            past-term protection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{totalItems.toLocaleString()} terms in calendar</Badge>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-6">
        <div className="overflow-hidden rounded-[28px] border border-border bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-[rgba(255,255,255,0.82)]">
                <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  <th className="px-5 py-4">Term</th>
                  <th className="px-5 py-4">Start Date</th>
                  <th className="px-5 py-4">End Date</th>
                  <th className="px-5 py-4">Weeks</th>
                  <th className="px-5 py-4">Notify Before</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {isLoading ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={7}>
                      Loading term schedules...
                    </td>
                  </tr>
                ) : null}

                {!isLoading && loadError ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-sm text-text/72" colSpan={7}>
                      <div className="flex flex-col items-center justify-center gap-3">
                        <span>Failed to load term schedules.</span>
                        <Button className="h-10 px-4" onClick={onRetry} variant="secondary">
                          Retry
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : null}

                {!isLoading && !loadError && rows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={7}>
                      No term schedules available.
                    </td>
                  </tr>
                ) : null}

                {!isLoading && !loadError
                  ? rows.map((row) => (
                      <tr
                        className="transition-colors duration-200 hover:bg-white/70"
                        key={row.termCode}
                      >
                        <td className="px-5 py-4 align-top">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-heading">{row.termCode}</p>
                              {row.manuallyEdited ? (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                  Custom
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-text/55">
                              {row.locked ? "Historical term is locked" : "Editable schedule row"}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-text/78">
                          {formatDate(row.startDate)}
                        </td>
                        <td className="px-5 py-4 align-top text-text/78">
                          {formatDate(row.endDate)}
                        </td>
                        <td className="px-5 py-4 align-top text-text/78">{row.weeks} weeks</td>
                        <td className="px-5 py-4 align-top text-text/78">
                          {notifyLabel(row.notifyBeforeDays)}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Badge variant={termStatusVariant(row.status)}>
                                {termStatusLabel(row.status)}
                              </Badge>
                              {row.locked ? (
                                <span className="text-xs font-semibold text-text/55">Locked</span>
                              ) : null}
                            </div>
                            <p className="text-xs text-text/55">
                              {row.status === "CURRENT"
                                ? "Active teaching window"
                                : row.status === "PAST"
                                  ? "Completed term schedule"
                                  : "Planned upcoming term"}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              aria-label={`Edit ${row.termCode}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-heading hover:shadow-shadow disabled:cursor-not-allowed disabled:opacity-55"
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
        </div>
      </div>

      <TablePagination
        className="mt-0 px-6 pb-6"
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
