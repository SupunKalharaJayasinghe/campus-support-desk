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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.28)]"
        role="dialog"
      >
        <div className="overflow-y-auto px-6 py-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                Edit Term
              </p>
              <p className="mt-1 text-2xl font-semibold text-heading">
                Edit Term ({draft.termCode})
              </p>
            </div>
            <button
              aria-label="Close modal"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge variant={termStatusVariant(draft.status)}>
              {termStatusLabel(draft.status)}
            </Badge>
            {draft.locked ? (
              <span className="text-xs font-semibold text-text/60">Past terms are locked</span>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="termStartDate">
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
              <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="termEndDate">
                End Date
              </label>
              <Input
                className="h-11"
                disabled
                id="termEndDate"
                type="date"
                value={draft.endDate}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="notifyBeforeDays">
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
            <p className="mt-4 rounded-2xl border border-border bg-tint px-3 py-2 text-sm text-text/72">
              Past terms are locked.
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Button
              className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
              disabled={isSaving}
              onClick={onClose}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="h-11 min-w-[132px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
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
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
