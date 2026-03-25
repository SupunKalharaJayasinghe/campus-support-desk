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

export interface OfferingFormState {
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
  termCode: string;
  moduleId: string;
  syllabusVersion: SyllabusVersion;
  status: OfferingStatus;
  assignedLecturerIds: string[];
  assignedLabAssistantIds: string[];
}

export interface OfferingFacultyOption {
  code: string;
  name: string;
}

export interface OfferingDegreeOption {
  code: string;
  name: string;
}

export interface OfferingIntakeOption {
  id: string;
  name: string;
  currentTerm?: string;
}

export interface OfferingModuleOption {
  id: string;
  code: string;
  name: string;
  defaultSyllabusVersion: SyllabusVersion;
}

interface EditOfferingModalProps {
  mode: "add" | "edit";
  open: boolean;
  saving: boolean;
  loadingModules: boolean;
  loadingLecturers: boolean;
  loadingLabAssistants: boolean;
  offering: EditOfferingContext | null;
  form: OfferingFormState;
  facultyOptions: OfferingFacultyOption[];
  degreeOptions: OfferingDegreeOption[];
  intakeOptions: OfferingIntakeOption[];
  moduleOptions: OfferingModuleOption[];
  termOptions: string[];
  eligibleLecturers: OfferingStaffItem[];
  eligibleLabAssistants: OfferingStaffItem[];
  onFacultyChange: (value: string) => void;
  onDegreeChange: (value: string) => void;
  onIntakeChange: (value: string) => void;
  onTermChange: (value: string) => void;
  onModuleChange: (value: string) => void;
  onSyllabusVersionChange: (value: SyllabusVersion) => void;
  onStatusChange: (value: OfferingStatus) => void;
  onToggleLecturer: (lecturerId: string) => void;
  onToggleLabAssistant: (labAssistantId: string) => void;
  onClose: () => void;
  onSave: () => void;
}

interface StaffSectionProps {
  title: string;
  loading: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  assignedIds: string[];
  eligibleItems: OfferingStaffItem[];
  lookup: Map<string, OfferingStaffItem>;
  onToggle: (id: string) => void;
  saving: boolean;
  emptyMessage: string;
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

function StaffSection({
  title,
  loading,
  searchValue,
  onSearchChange,
  assignedIds,
  eligibleItems,
  lookup,
  onToggle,
  saving,
  emptyMessage,
}: StaffSectionProps) {
  const filteredItems = useMemo(() => {
    const query = normalizeSearch(searchValue);
    return eligibleItems.filter((item) => staffMatchesSearch(item, query));
  }, [eligibleItems, searchValue]);

  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-heading">{title}</p>
        <Badge variant="primary">{assignedIds.length}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {assignedIds.length === 0 ? (
          <p className="text-sm text-text/65">No {title.toLowerCase()} assigned.</p>
        ) : (
          assignedIds.map((id) => {
            const row = lookup.get(id);
            return (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-border bg-tint px-3 py-1 text-xs font-semibold text-heading hover:bg-slate-200"
                key={id}
                onClick={() => onToggle(id)}
                type="button"
              >
                {row?.fullName ?? id}
                <X size={12} />
              </button>
            );
          })
        )}
      </div>

      <div className="relative mt-3">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/55"
          size={14}
        />
        <Input
          className="h-10 pl-8"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={`Search ${title.toLowerCase()}`}
          value={searchValue}
        />
      </div>

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <p className="rounded-xl border border-border bg-tint px-3 py-2 text-sm text-text/68">
            Loading eligible {title.toLowerCase()}...
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="rounded-xl border border-border bg-tint px-3 py-2 text-sm text-text/68">
            {emptyMessage}
          </p>
        ) : (
          filteredItems.map((item) => (
            <label
              className="inline-flex w-full items-start gap-2 rounded-xl border border-border bg-tint px-2.5 py-2 text-sm text-heading"
              key={item.id}
            >
              <input
                checked={assignedIds.includes(item.id)}
                className="mt-0.5 h-4 w-4 rounded border-border"
                disabled={saving}
                onChange={() => onToggle(item.id)}
                type="checkbox"
              />
              <span>
                <span className="font-semibold">{item.fullName}</span>
                <span className="block text-xs text-text/60">{item.email}</span>
                <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-text/58">
                  {item.status || "ACTIVE"}
                </span>
              </span>
            </label>
          ))
        )}
      </div>
    </section>
  );
}

export default function EditOfferingModal({
  mode,
  open,
  saving,
  loadingModules,
  loadingLecturers,
  loadingLabAssistants,
  offering,
  form,
  facultyOptions,
  degreeOptions,
  intakeOptions,
  moduleOptions,
  termOptions,
  eligibleLecturers,
  eligibleLabAssistants,
  onFacultyChange,
  onDegreeChange,
  onIntakeChange,
  onTermChange,
  onModuleChange,
  onSyllabusVersionChange,
  onStatusChange,
  onToggleLecturer,
  onToggleLabAssistant,
  onClose,
  onSave,
}: EditOfferingModalProps) {
  const [lecturerSearch, setLecturerSearch] = useState("");
  const [labAssistantSearch, setLabAssistantSearch] = useState("");

  const lecturerLookup = useMemo(
    () => buildStaffLookup([...(offering?.lecturers ?? []), ...eligibleLecturers]),
    [eligibleLecturers, offering]
  );
  const labAssistantLookup = useMemo(
    () => buildStaffLookup([...(offering?.labAssistants ?? []), ...eligibleLabAssistants]),
    [eligibleLabAssistants, offering]
  );

  const selectedFaculty = facultyOptions.find((item) => item.code === form.facultyId) ?? null;
  const selectedDegree = degreeOptions.find((item) => item.code === form.degreeProgramId) ?? null;
  const selectedIntake = intakeOptions.find((item) => item.id === form.intakeId) ?? null;
  const selectedModule = moduleOptions.find((item) => item.id === form.moduleId) ?? null;

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
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]"
        role="dialog"
      >
        <div className="overflow-y-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                {mode === "add" ? "CREATE" : "EDIT"}
              </p>
              <p className="mt-1 text-2xl font-semibold text-heading">
                {mode === "add" ? "Add Module Offering" : "Edit Module Offering"}
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

          <section className="mt-6 rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-heading">Offering Context</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Faculty
                </label>
                <Select
                  className="h-11"
                  disabled={saving}
                  onChange={(event) => onFacultyChange(event.target.value)}
                  value={form.facultyId}
                >
                  <option value="">Select faculty</option>
                  {facultyOptions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Degree
                </label>
                <Select
                  className="h-11"
                  disabled={saving || !form.facultyId}
                  onChange={(event) => onDegreeChange(event.target.value)}
                  value={form.degreeProgramId}
                >
                  <option value="">Select degree</option>
                  {degreeOptions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Intake
                </label>
                <Select
                  className="h-11"
                  disabled={saving || !form.degreeProgramId}
                  onChange={(event) => onIntakeChange(event.target.value)}
                  value={form.intakeId}
                >
                  <option value="">Select intake</option>
                  {intakeOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Semester / Term
                </label>
                <Select
                  className="h-11"
                  disabled={saving}
                  onChange={(event) => onTermChange(event.target.value)}
                  value={form.termCode}
                >
                  {termOptions.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Module
                </label>
                <Select
                  className="h-11"
                  disabled={saving || !form.facultyId || !form.degreeProgramId || !form.termCode}
                  onChange={(event) => onModuleChange(event.target.value)}
                  value={form.moduleId}
                >
                  <option value="">Select module</option>
                  {moduleOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </Select>
                {loadingModules ? (
                  <p className="mt-1 text-xs text-text/60">Loading valid modules...</p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-tint/60 p-3 text-sm text-heading">
              <p>
                Intake: <span className="font-semibold">{selectedIntake?.name || "—"}</span>
              </p>
              <p className="mt-1">
                Semester: <span className="font-semibold">{form.termCode || "—"}</span>
              </p>
              <p className="mt-1">
                Faculty: <span className="font-semibold">{selectedFaculty?.code || form.facultyId || "—"}</span>
              </p>
              <p className="mt-1">
                Degree: <span className="font-semibold">{selectedDegree?.code || form.degreeProgramId || "—"}</span>
              </p>
              <p className="mt-1">
                Module: <span className="font-semibold">{selectedModule ? `${selectedModule.code} - ${selectedModule.name}` : "—"}</span>
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-heading">Offering Settings</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Syllabus Version
                </label>
                <Select
                  className="h-11"
                  disabled={saving}
                  onChange={(event) =>
                    onSyllabusVersionChange(event.target.value === "OLD" ? "OLD" : "NEW")
                  }
                  value={form.syllabusVersion}
                >
                  <option value="OLD">OLD</option>
                  <option value="NEW">NEW</option>
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Status
                </label>
                <Select
                  className="h-11"
                  disabled={saving}
                  onChange={(event) =>
                    onStatusChange(event.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE")
                  }
                  value={form.status}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </Select>
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <StaffSection
              assignedIds={form.assignedLecturerIds}
              eligibleItems={eligibleLecturers}
              emptyMessage="No eligible lecturers found for this module"
              loading={loadingLecturers}
              lookup={lecturerLookup}
              onSearchChange={setLecturerSearch}
              onToggle={onToggleLecturer}
              saving={saving}
              searchValue={lecturerSearch}
              title="Lecturers"
            />

            <StaffSection
              assignedIds={form.assignedLabAssistantIds}
              eligibleItems={eligibleLabAssistants}
              emptyMessage="No eligible lab assistants found for this module"
              loading={loadingLabAssistants}
              lookup={labAssistantLookup}
              onSearchChange={setLabAssistantSearch}
              onToggle={onToggleLabAssistant}
              saving={saving}
              searchValue={labAssistantSearch}
              title="Lab Assistants"
            />
          </div>
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
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
