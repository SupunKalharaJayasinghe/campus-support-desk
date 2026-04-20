"use client";

import { Loader2, Save, X } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

export type NotifyBeforeDays = 1 | 3 | 7;
export type TermScheduleStatus = "PAST" | "CURRENT" | "FUTURE";

export interface EditTermDraft {
  termCode: string;
  startDate: string;
  endDate: string;
  weeks: number;
  notifyBeforeDays: NotifyBeforeDays;
  status: TermScheduleStatus;
  locked: boolean;
}

interface EditTermModalProps {
  draft: EditTermDraft | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDraftChange: (next: EditTermDraft) => void;
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

export default function EditTermModal({
  draft,
  isSaving,
  onClose,
  onSave,
  onDraftChange,
}: EditTermModalProps) {
  if (!draft) {
    return null;
  }

  const disableInputs = isSaving || draft.locked;
  const weekOptions = [12, 14, 16, 18];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[30px] border border-border bg-[rgba(255,255,255,0.94)] shadow-[0_32px_80px_rgba(15,23,42,0.24)]"
        role="dialog"
      >
        <div className="overflow-y-auto px-6 py-6 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-lg">
              <Badge variant="neutral">Edit Term</Badge>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                Update {draft.termCode}
              </p>
              <p className="mt-2 text-sm leading-6 text-text/68">
                Adjust the term start date, default week count, and reminder timing for
                this calendar row.
              </p>
            </div>
            <button
              aria-label="Close modal"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/80 text-text/70 transition-colors hover:bg-white hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant={termStatusVariant(draft.status)}>
              {termStatusLabel(draft.status)}
            </Badge>
            {draft.locked ? (
              <span className="text-xs font-semibold text-text/60">Past terms are locked</span>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-heading"
                htmlFor="termStartDate"
              >
                Start Date
              </label>
              <Input
                className="h-11"
                disabled={disableInputs}
                id="termStartDate"
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    startDate: event.target.value,
                  })
                }
                type="date"
                value={draft.startDate}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="termWeeks">
                Weeks
              </label>
              <Select
                className="h-11"
                disabled={disableInputs}
                id="termWeeks"
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    weeks: Number(event.target.value),
                  })
                }
                value={draft.weeks}
              >
                {weekOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
                {!weekOptions.includes(draft.weeks) ? (
                  <option value={draft.weeks}>{draft.weeks}</option>
                ) : null}
              </Select>
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-heading"
                htmlFor="termEndDate"
              >
                End Date
              </label>
              <Input
                className="h-11 bg-white/80"
                disabled
                id="termEndDate"
                type="date"
                value={draft.endDate}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-heading"
                htmlFor="notifyBeforeDays"
              >
                Notify Before
              </label>
              <Select
                className="h-11"
                disabled={disableInputs}
                id="notifyBeforeDays"
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    notifyBeforeDays: Number(event.target.value) as NotifyBeforeDays,
                  })
                }
                value={draft.notifyBeforeDays}
              >
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
              </Select>
            </div>
          </div>

          {draft.locked ? (
            <p className="mt-4 rounded-2xl border border-border bg-white/76 px-4 py-3 text-sm text-text/72 shadow-[0_10px_24px_rgba(15,23,41,0.04)]">
              Past terms are locked and cannot be edited.
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-[rgba(255,255,255,0.9)] px-6 py-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Button
              className="h-11 min-w-[112px] px-5"
              disabled={isSaving}
              onClick={onClose}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="h-11 min-w-[148px] gap-2 px-5"
              disabled={isSaving || draft.locked}
              onClick={onSave}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Term
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
