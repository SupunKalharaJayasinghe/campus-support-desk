"use client";

import { Loader2, RefreshCcw, Save } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";

export type NotifyBeforeDays = 1 | 3 | 7;

export interface TermPoliciesView {
  autoJump: boolean;
  lockPastTerms: boolean;
  defaultWeeksPerTerm: number;
  defaultNotifyBeforeDays: NotifyBeforeDays;
  autoGenerateFutureTerms: boolean;
}

interface TermPolicyPanelProps {
  policies: TermPoliciesView;
  isDisabled: boolean;
  isSaving: boolean;
  isRecalculating: boolean;
  onPolicyChange: (next: TermPoliciesView) => void;
  onSave: () => void;
  onOpenRecalculate: () => void;
}

function ToggleField({
  checked,
  title,
  description,
  disabled,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-white p-3.5">
      <div className="flex items-start gap-3">
        <input
          checked={checked}
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <div>
          <p className="text-sm font-semibold text-heading">{title}</p>
          <p className="mt-1 text-xs leading-5 text-text/68">{description}</p>
        </div>
      </div>
    </label>
  );
}

export default function TermPolicyPanel({
  policies,
  isDisabled,
  isSaving,
  isRecalculating,
  onPolicyChange,
  onSave,
  onOpenRecalculate,
}: TermPolicyPanelProps) {
  return (
    <Card className="h-full" description="Configure term-level behavior for this intake." title="Policies">
      <div className="space-y-3">
        <ToggleField
          checked={policies.autoJump}
          description="Automatically move the intake to the next term when the current term end date passes."
          disabled={isDisabled}
          onChange={(value) => onPolicyChange({ ...policies, autoJump: value })}
          title="Auto Jump to next term when current ends"
        />

        <ToggleField
          checked={policies.lockPastTerms}
          description="When enabled, past term rows are read-only to keep audit-safe historical records."
          disabled={isDisabled}
          onChange={(value) => onPolicyChange({ ...policies, lockPastTerms: value })}
          title="Lock past terms (audit safe)"
        />

        <div className="rounded-2xl border border-border bg-white p-3.5">
          <p className="text-sm font-semibold text-heading">Default Weeks Per Term</p>
          <p className="mt-1 text-xs leading-5 text-text/68">
            Used when creating schedules and when only a term start date is provided.
          </p>
          <Select
            className="mt-3 h-10"
            disabled={isDisabled}
            onChange={(event) =>
              onPolicyChange({
                ...policies,
                defaultWeeksPerTerm: Number(event.target.value),
              })
            }
            value={policies.defaultWeeksPerTerm}
          >
            <option value={12}>12</option>
            <option value={14}>14</option>
            <option value={16}>16</option>
            <option value={18}>18</option>
          </Select>
        </div>

        <div className="rounded-2xl border border-border bg-white p-3.5">
          <p className="text-sm font-semibold text-heading">Default Notify Before Days</p>
          <p className="mt-1 text-xs leading-5 text-text/68">
            This value is used as the default for newly generated term rows.
          </p>
          <Select
            className="mt-3 h-10"
            disabled={isDisabled}
            onChange={(event) =>
              onPolicyChange({
                ...policies,
                defaultNotifyBeforeDays: Number(event.target.value) as NotifyBeforeDays,
              })
            }
            value={policies.defaultNotifyBeforeDays}
          >
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
          </Select>
        </div>

        <ToggleField
          checked={policies.autoGenerateFutureTerms}
          description="Use +6 month sequential generation for future terms based on Y1S1."
          disabled={isDisabled}
          onChange={(value) =>
            onPolicyChange({ ...policies, autoGenerateFutureTerms: value })
          }
          title="Auto-generate future terms (+6 months)"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-border pt-4">
        <Button
          className="h-10 gap-2 border-slate-300 bg-white px-4 text-heading hover:bg-slate-50"
          disabled={isDisabled || isRecalculating}
          onClick={onOpenRecalculate}
          variant="secondary"
        >
          {isRecalculating ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Recalculating...
            </>
          ) : (
            <>
              <RefreshCcw size={14} />
              Recalculate future terms
            </>
          )}
        </Button>
        <Button
          className="h-10 min-w-[120px] gap-2 bg-[#034aa6] px-4 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
          disabled={isDisabled || isSaving || isRecalculating}
          onClick={onSave}
        >
          {isSaving ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Saving...
            </>
          ) : (
            <>
              <Save size={14} />
              Save
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
