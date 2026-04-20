"use client";

import { Loader2, RefreshCcw, Save } from "lucide-react";
import Badge from "@/components/ui/Badge";
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
    <label className="block rounded-[24px] border border-border bg-white/76 p-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)]">
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
    <Card accent className="h-full p-6 lg:p-7" data-tone="sky">
      <Badge variant="neutral">Policy Controls</Badge>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-heading">
        Term policies
      </p>
      <p className="mt-2 text-sm leading-6 text-text/68">
        Configure term-level automation, locking, default duration, and reminder
        timing for the selected intake.
      </p>

      <div className="mt-6 space-y-3">
        <ToggleField
          checked={policies.autoJump}
          description="Automatically move the intake to the next term when the current term end date passes."
          disabled={isDisabled}
          onChange={(value) => onPolicyChange({ ...policies, autoJump: value })}
          title="Auto jump to the next term"
        />

        <ToggleField
          checked={policies.lockPastTerms}
          description="Keep historical term rows read-only so previously completed terms stay audit-safe."
          disabled={isDisabled}
          onChange={(value) => onPolicyChange({ ...policies, lockPastTerms: value })}
          title="Lock past terms"
        />

        <div className="rounded-[24px] border border-border bg-white/76 p-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)]">
          <p className="text-sm font-semibold text-heading">Default Weeks Per Term</p>
          <p className="mt-1 text-xs leading-5 text-text/68">
            Used when generating schedules and when only a start date is provided.
          </p>
          <Select
            className="mt-3 h-11"
            disabled={isDisabled}
            onChange={(event) =>
              onPolicyChange({
                ...policies,
                defaultWeeksPerTerm: Number(event.target.value),
              })
            }
            value={policies.defaultWeeksPerTerm}
          >
            <option value={12}>12 weeks</option>
            <option value={14}>14 weeks</option>
            <option value={16}>16 weeks</option>
            <option value={18}>18 weeks</option>
          </Select>
        </div>

        <div className="rounded-[24px] border border-border bg-white/76 p-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)]">
          <p className="text-sm font-semibold text-heading">Default Notify Before Days</p>
          <p className="mt-1 text-xs leading-5 text-text/68">
            This value is used as the default reminder window for generated term rows.
          </p>
          <Select
            className="mt-3 h-11"
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
          description="Generate future terms in sequence using the Y1S1 baseline and the +6 month pattern."
          disabled={isDisabled}
          onChange={(value) =>
            onPolicyChange({ ...policies, autoGenerateFutureTerms: value })
          }
          title="Auto-generate future terms"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-border pt-5">
        <Button
          className="h-10 gap-2 px-4"
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
              Recalculate Terms
            </>
          )}
        </Button>
        <Button
          className="h-10 min-w-[132px] gap-2 px-4"
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
              Save Policies
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
