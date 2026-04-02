"use client";

import { Loader2, Save, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

export type EnrollmentStatus = "ACTIVE" | "INACTIVE";
export type EnrollmentStream = "WEEKDAY" | "WEEKEND";

export interface EditEnrollmentFormState {
  facultyId: string;
  facultyName: string;
  degreeProgramId: string;
  degreeProgramName: string;
  intakeId: string;
  stream: EnrollmentStream;
  subgroup: string;
  status: EnrollmentStatus;
}

export interface EditIntakeOption {
  id: string;
  name: string;
  currentTerm: string;
}

export interface EditSubgroupOption {
  code: string;
  count: number;
}

interface EditEnrollmentModalProps {
  open: boolean;
  saving: boolean;
  loadingIntakes: boolean;
  loadingTerm: boolean;
  loadingSubgroups: boolean;
  formError: string;
  selectedIntakeTerm: string;
  form: EditEnrollmentFormState;
  intakeOptions: EditIntakeOption[];
  subgroupOptions: EditSubgroupOption[];
  onChange: (patch: Partial<EditEnrollmentFormState>) => void;
  onIntakeChange: (intakeId: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function EditEnrollmentModal({
  open,
  saving,
  loadingIntakes,
  loadingTerm,
  loadingSubgroups,
  formError,
  selectedIntakeTerm,
  form,
  intakeOptions,
  subgroupOptions,
  onChange,
  onIntakeChange,
  onClose,
  onSave,
}: EditEnrollmentModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]"
        role="dialog"
      >
        <div className="px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                Edit
              </p>
              <p className="mt-1 text-2xl font-semibold text-heading">
                Edit Enrollment
              </p>
            </div>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                Faculty
              </label>
              <Input
                className="h-12"
                disabled
                value={
                  form.facultyName
                    ? `${form.facultyId} - ${form.facultyName}`
                    : form.facultyId
                }
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                Degree
              </label>
              <Input
                className="h-12"
                disabled
                value={
                  form.degreeProgramName
                    ? `${form.degreeProgramId} - ${form.degreeProgramName}`
                    : form.degreeProgramId
                }
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                Intake
              </label>
              <Select
                className="h-12"
                disabled={saving || loadingIntakes}
                onChange={(event) => {
                  const intakeId = String(event.target.value ?? "").trim();
                  onChange({ intakeId });
                  onIntakeChange(intakeId);
                }}
                value={form.intakeId}
              >
                <option value="">
                  {loadingIntakes ? "Loading..." : "Select Intake"}
                </option>
                {intakeOptions.map((intake) => (
                  <option key={intake.id} value={intake.id}>
                    {intake.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                Current Semester
              </label>
              <Input
                className="h-12"
                disabled
                value={
                  !form.intakeId
                    ? "Select an intake"
                    : loadingTerm
                      ? "Loading..."
                      : selectedIntakeTerm || "-"
                }
              />
              <p className="mt-1 text-xs text-text/60">
                This is controlled by the Intake term schedule.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                Stream
              </label>
              <Select
                className="h-12"
                disabled={saving}
                onChange={(event) =>
                  onChange({
                    stream: event.target.value === "WEEKEND" ? "WEEKEND" : "WEEKDAY",
                  })
                }
                value={form.stream}
              >
                <option value="WEEKDAY">WEEKDAY</option>
                <option value="WEEKEND">WEEKEND</option>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                Subgroup
              </label>
              <Select
                className="h-12"
                disabled={saving || !form.intakeId}
                onChange={(event) =>
                  onChange({ subgroup: String(event.target.value ?? "").trim() })
                }
                value={String(form.subgroup ?? "").trim()}
              >
                <option value="">
                  {loadingSubgroups
                    ? "Loading..."
                    : subgroupOptions.length > 0
                      ? "No Subgroup"
                      : "No Subgroups Available"}
                </option>
                {subgroupOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} ({option.count})
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-text/60">
                {form.intakeId
                  ? subgroupOptions.length > 0
                    ? "Assign subgroup using this list only."
                    : "No subgroups found for selected intake + stream."
                  : "Select intake first to load subgroup options."}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                Status
              </label>
              <Select
                className="h-12"
                disabled={saving}
                onChange={(event) =>
                  onChange({
                    status: event.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE",
                  })
                }
                value={form.status}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </div>
          </div>

          {formError ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          ) : null}
        </div>

        <div className="border-t border-border bg-white px-6 py-4">
          <div className="flex justify-end gap-2.5">
            <Button
              className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
              disabled={saving}
              onClick={onClose}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="h-11 min-w-[132px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
              disabled={saving}
              onClick={onSave}
            >
              {saving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Save size={16} />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
