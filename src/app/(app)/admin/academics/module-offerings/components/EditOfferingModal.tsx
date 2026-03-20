"use client";

import { useMemo, useState } from "react";
import { Loader2, Save, Search, X } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

export type OfferingStatus = "ACTIVE" | "INACTIVE";
export type SyllabusVersion = "OLD" | "NEW";

export interface OfferingStaffItem {
  id: string;
  fullName: string;
  email: string;
  status: string;
}

export interface EditOfferingContext {
  id: string;
  facultyId: string;
  facultyName: string;
  degreeProgramId: string;
  degreeProgramName: string;
  intakeId: string;
  intakeName: string;
  termCode: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  syllabusVersion: SyllabusVersion;
  status: OfferingStatus;
  lecturers: OfferingStaffItem[];
  labAssistants: OfferingStaffItem[];
}

interface EditOfferingModalProps {
  open: boolean;
  saving: boolean;
  loadingLecturers: boolean;
  loadingLabAssistants: boolean;
  offering: EditOfferingContext | null;
  syllabusVersion: SyllabusVersion;
  assignedLecturerIds: string[];
  assignedLabAssistantIds: string[];
  eligibleLecturers: OfferingStaffItem[];
  eligibleLabAssistants: OfferingStaffItem[];
  onSyllabusVersionChange: (value: SyllabusVersion) => void;
  onToggleLecturer: (lecturerId: string) => void;
  onToggleLabAssistant: (labAssistantId: string) => void;
  onClose: () => void;
  onSave: () => void;
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function buildStaffLookup(input: OfferingStaffItem[]) {
  return new Map(input.map((item) => [item.id, item]));
}

function staffMatchesSearch(staff: OfferingStaffItem, query: string) {
  if (!query) {
    return true;
  }

  return `${staff.fullName} ${staff.email}`.toLowerCase().includes(query);
}

export default function EditOfferingModal({
  open,
  saving,
  loadingLecturers,
  loadingLabAssistants,
  offering,
  syllabusVersion,
  assignedLecturerIds,
  assignedLabAssistantIds,
  eligibleLecturers,
  eligibleLabAssistants,
  onSyllabusVersionChange,
  onToggleLecturer,
  onToggleLabAssistant,
  onClose,
  onSave,
}: EditOfferingModalProps) {
  const [lecturerSearch, setLecturerSearch] = useState("");
  const [labAssistantSearch, setLabAssistantSearch] = useState("");

  const lecturerLookup = useMemo(
    () =>
      buildStaffLookup([
        ...(offering?.lecturers ?? []),
        ...eligibleLecturers,
      ]),
    [eligibleLecturers, offering]
  );

  const labAssistantLookup = useMemo(
    () =>
      buildStaffLookup([
        ...(offering?.labAssistants ?? []),
        ...eligibleLabAssistants,
      ]),
    [eligibleLabAssistants, offering]
  );

  const filteredLecturers = useMemo(() => {
    const query = normalizeSearch(lecturerSearch);
    return eligibleLecturers.filter((item) => staffMatchesSearch(item, query));
  }, [eligibleLecturers, lecturerSearch]);

  const filteredLabAssistants = useMemo(() => {
    const query = normalizeSearch(labAssistantSearch);
    return eligibleLabAssistants.filter((item) => staffMatchesSearch(item, query));
  }, [eligibleLabAssistants, labAssistantSearch]);

  if (!open || !offering) {
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
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]"
        role="dialog"
      >
        <div className="overflow-y-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                Edit
              </p>
              <p className="mt-1 text-2xl font-semibold text-heading">
                Edit Module Offering
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

          <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-tint/60 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">Faculty</p>
              <p className="mt-1 text-sm font-semibold text-heading">
                {offering.facultyId}
                {offering.facultyName ? ` - ${offering.facultyName}` : ""}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">Degree</p>
              <p className="mt-1 text-sm font-semibold text-heading">
                {offering.degreeProgramId}
                {offering.degreeProgramName ? ` - ${offering.degreeProgramName}` : ""}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">Intake</p>
              <p className="mt-1 text-sm font-semibold text-heading">
                {offering.intakeName || offering.intakeId}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">Term</p>
              <p className="mt-1 text-sm font-semibold text-heading">{offering.termCode}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">Module</p>
              <p className="mt-1 text-sm font-semibold text-heading">
                {offering.moduleCode} - {offering.moduleName}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">Syllabus</p>
              <p className="mt-1 text-sm font-semibold text-heading">{syllabusVersion}</p>
            </div>
          </div>

          <div className="mt-6 max-w-xs">
            <label className="mb-1.5 block text-sm font-medium text-heading">
              Syllabus Version
            </label>
            <Select
              className="h-12"
              disabled={saving}
              onChange={(event) =>
                onSyllabusVersionChange(
                  event.target.value === "OLD" ? "OLD" : "NEW"
                )
              }
              value={syllabusVersion}
            >
              <option value="NEW">NEW</option>
              <option value="OLD">OLD</option>
            </Select>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-heading">Lecturers</p>
                <Badge variant="primary">{assignedLecturerIds.length}</Badge>
              </div>
              <p className="mt-1 text-xs text-text/62">
                Eligibility based on selected Faculty, Degree, and Module mappings.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {assignedLecturerIds.length === 0 ? (
                  <p className="text-sm text-text/65">No lecturers assigned.</p>
                ) : (
                  assignedLecturerIds.map((lecturerId) => {
                    const row = lecturerLookup.get(lecturerId);
                    return (
                      <button
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-tint px-3 py-1 text-xs font-semibold text-heading hover:bg-slate-200"
                        key={lecturerId}
                        onClick={() => onToggleLecturer(lecturerId)}
                        type="button"
                      >
                        {row?.fullName ?? lecturerId}
                        <X size={12} />
                      </button>
                    );
                  })
                )}
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/55" size={14} />
                <Input
                  className="h-10 pl-8"
                  onChange={(event) => setLecturerSearch(event.target.value)}
                  placeholder="Search lecturers"
                  value={lecturerSearch}
                />
              </div>

              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {loadingLecturers ? (
                  <p className="rounded-xl border border-border bg-tint px-3 py-2 text-sm text-text/68">
                    Loading eligible lecturers...
                  </p>
                ) : filteredLecturers.length === 0 ? (
                  <p className="rounded-xl border border-border bg-tint px-3 py-2 text-sm text-text/68">
                    No eligible lecturers found for this module.
                  </p>
                ) : (
                  filteredLecturers.map((lecturer) => (
                    <label
                      className="inline-flex w-full items-start gap-2 rounded-xl border border-border bg-tint px-2.5 py-2 text-sm text-heading"
                      key={lecturer.id}
                    >
                      <input
                        checked={assignedLecturerIds.includes(lecturer.id)}
                        className="mt-0.5 h-4 w-4 rounded border-border"
                        disabled={saving}
                        onChange={() => onToggleLecturer(lecturer.id)}
                        type="checkbox"
                      />
                      <span>
                        <span className="font-semibold">{lecturer.fullName}</span>
                        <span className="block text-xs text-text/60">{lecturer.email}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-heading">Lab Assistants</p>
                <Badge variant="primary">{assignedLabAssistantIds.length}</Badge>
              </div>
              <p className="mt-1 text-xs text-text/62">
                Eligibility based on selected Faculty, Degree, and Module mappings.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {assignedLabAssistantIds.length === 0 ? (
                  <p className="text-sm text-text/65">No lab assistants assigned.</p>
                ) : (
                  assignedLabAssistantIds.map((labAssistantId) => {
                    const row = labAssistantLookup.get(labAssistantId);
                    return (
                      <button
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-tint px-3 py-1 text-xs font-semibold text-heading hover:bg-slate-200"
                        key={labAssistantId}
                        onClick={() => onToggleLabAssistant(labAssistantId)}
                        type="button"
                      >
                        {row?.fullName ?? labAssistantId}
                        <X size={12} />
                      </button>
                    );
                  })
                )}
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/55" size={14} />
                <Input
                  className="h-10 pl-8"
                  onChange={(event) => setLabAssistantSearch(event.target.value)}
                  placeholder="Search lab assistants"
                  value={labAssistantSearch}
                />
              </div>

              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {loadingLabAssistants ? (
                  <p className="rounded-xl border border-border bg-tint px-3 py-2 text-sm text-text/68">
                    Loading eligible lab assistants...
                  </p>
                ) : filteredLabAssistants.length === 0 ? (
                  <p className="rounded-xl border border-border bg-tint px-3 py-2 text-sm text-text/68">
                    No eligible lab assistants found for this module.
                  </p>
                ) : (
                  filteredLabAssistants.map((labAssistant) => (
                    <label
                      className="inline-flex w-full items-start gap-2 rounded-xl border border-border bg-tint px-2.5 py-2 text-sm text-heading"
                      key={labAssistant.id}
                    >
                      <input
                        checked={assignedLabAssistantIds.includes(labAssistant.id)}
                        className="mt-0.5 h-4 w-4 rounded border-border"
                        disabled={saving}
                        onChange={() => onToggleLabAssistant(labAssistant.id)}
                        type="checkbox"
                      />
                      <span>
                        <span className="font-semibold">{labAssistant.fullName}</span>
                        <span className="block text-xs text-text/60">{labAssistant.email}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-heading">Current Assignment Summary</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Assigned Lecturers
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {assignedLecturerIds.length === 0 ? (
                    <p className="text-sm text-text/65">No lecturers assigned.</p>
                  ) : (
                    assignedLecturerIds.map((lecturerId) => {
                      const row = lecturerLookup.get(lecturerId);
                      return (
                        <span
                          className="inline-flex items-center rounded-full border border-border bg-tint px-3 py-1 text-xs font-semibold text-heading"
                          key={lecturerId}
                        >
                          {row?.fullName ?? lecturerId}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Assigned Lab Assistants
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {assignedLabAssistantIds.length === 0 ? (
                    <p className="text-sm text-text/65">No lab assistants assigned.</p>
                  ) : (
                    assignedLabAssistantIds.map((labAssistantId) => {
                      const row = labAssistantLookup.get(labAssistantId);
                      return (
                        <span
                          className="inline-flex items-center rounded-full border border-border bg-tint px-3 py-1 text-xs font-semibold text-heading"
                          key={labAssistantId}
                        >
                          {row?.fullName ?? labAssistantId}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
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
