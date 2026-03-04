"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Pencil, Plus, Search, Trash2, UserPlus2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";
import { useAdminContext } from "@/components/admin/AdminContext";

type StudentStatus = "Active" | "Inactive" | "Suspended";

interface StudentRecord {
  id: string;
  studentId: string;
  name: string;
  email: string;
  faculty: string;
  degree: string;
  intake: string;
  term: string;
  stream: string;
  subgroup: string;
  status: StudentStatus;
}

interface StudentFormState {
  studentId: string;
  name: string;
  email: string;
  status: StudentStatus;
}

const STUDENTS_SEED: StudentRecord[] = [
  {
    id: "st-0001",
    studentId: "IT23123456",
    name: "Maya Rodrigo",
    email: "maya.rodrigo@campus.edu",
    faculty: "FOC",
    degree: "SE",
    intake: "2026 June",
    term: "Y1S1",
    stream: "Weekday",
    subgroup: "1.1",
    status: "Active",
  },
  {
    id: "st-0002",
    studentId: "IT23123457",
    name: "Ava Martin",
    email: "ava.martin@campus.edu",
    faculty: "FOC",
    degree: "SE",
    intake: "2026 June",
    term: "Y1S1",
    stream: "Weekday",
    subgroup: "1.2",
    status: "Active",
  },
  {
    id: "st-0003",
    studentId: "IT23123458",
    name: "Noah Perera",
    email: "noah.perera@campus.edu",
    faculty: "FOC",
    degree: "SE",
    intake: "2026 June",
    term: "Y1S1",
    stream: "Weekday",
    subgroup: "1.3",
    status: "Suspended",
  },
  {
    id: "st-0004",
    studentId: "CS22110402",
    name: "Thilini Dias",
    email: "thilini.dias@campus.edu",
    faculty: "FOC",
    degree: "CS",
    intake: "2027 February",
    term: "Y1S2",
    stream: "Weekday",
    subgroup: "1.1",
    status: "Active",
  },
  {
    id: "st-0005",
    studentId: "EN20198112",
    name: "Kalum Perera",
    email: "kalum.perera@campus.edu",
    faculty: "FOE",
    degree: "CE",
    intake: "2026 June",
    term: "Y1S1",
    stream: "Weekday",
    subgroup: "1.1",
    status: "Inactive",
  },
  {
    id: "st-0006",
    studentId: "BU20261201",
    name: "Sachi Perera",
    email: "sachi.perera@campus.edu",
    faculty: "FOB",
    degree: "BIZ",
    intake: "2026 October",
    term: "Y1S1",
    stream: "Weekend",
    subgroup: "1.1",
    status: "Active",
  },
  {
    id: "st-0007",
    studentId: "BU20261202",
    name: "Chamath Silva",
    email: "chamath.silva@campus.edu",
    faculty: "FOB",
    degree: "FIN",
    intake: "2026 June",
    term: "Y1S1",
    stream: "Weekend",
    subgroup: "1.2",
    status: "Active",
  },
  {
    id: "st-0008",
    studentId: "IT23124010",
    name: "Ruvin Silva",
    email: "ruvin.silva@campus.edu",
    faculty: "FOC",
    degree: "IT",
    intake: "2026 October",
    term: "Y1S1",
    stream: "Weekend",
    subgroup: "1.1",
    status: "Active",
  },
  {
    id: "st-0009",
    studentId: "IT23124011",
    name: "Nina Peris",
    email: "nina.peris@campus.edu",
    faculty: "FOC",
    degree: "SE",
    intake: "2026 June",
    term: "Y1S1",
    stream: "Weekday",
    subgroup: "1.1",
    status: "Active",
  },
  {
    id: "st-0010",
    studentId: "IT23124012",
    name: "Kavindu Sen",
    email: "kavindu.sen@campus.edu",
    faculty: "FOC",
    degree: "SE",
    intake: "2026 June",
    term: "Y1S1",
    stream: "Weekday",
    subgroup: "1.2",
    status: "Active",
  },
];

type PageSize = 10 | 25 | 50 | 100;

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function statusVariant(status: StudentStatus) {
  if (status === "Active") return "success";
  if (status === "Suspended") return "warning";
  return "neutral";
}

function createEmptyForm(): StudentFormState {
  return { studentId: "", name: "", email: "", status: "Active" };
}

function toCsv(rows: StudentRecord[]) {
  const header = [
    "Student ID",
    "Name",
    "Email",
    "Faculty",
    "Degree",
    "Intake",
    "Term",
    "Stream",
    "Subgroup",
    "Status",
  ];
  const values = rows.map((row) => [
    row.studentId,
    row.name,
    row.email,
    row.faculty,
    row.degree,
    row.intake,
    row.term,
    row.stream,
    row.subgroup,
    row.status,
  ]);
  const lines = [header, ...values]
    .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  return lines;
}

export default function StudentsAdminPage() {
  const { toast } = useToast();
  const { scope } = useAdminContext();
  const idCounter = useRef(STUDENTS_SEED.length);

  const [students, setStudents] = useState<StudentRecord[]>(STUDENTS_SEED);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StudentStatus>("");
  const [scopeEnabled, setScopeEnabled] = useState(true);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<null | { mode: "add" | "edit"; id?: string }>(null);
  const [form, setForm] = useState<StudentFormState>(createEmptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof StudentFormState, string>>>({});

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return students
      .filter((row) => (scopeEnabled ? row.faculty === scope.faculty : true))
      .filter((row) => (scopeEnabled ? row.degree === scope.degree : true))
      .filter((row) => (scopeEnabled ? row.intake === scope.intake : true))
      .filter((row) => (scopeEnabled ? row.term === scope.term : true))
      .filter((row) => (scopeEnabled ? row.stream === scope.stream : true))
      .filter((row) => (scopeEnabled ? row.subgroup === scope.subgroup : true))
      .filter((row) => (statusFilter ? row.status === statusFilter : true))
      .filter((row) => {
        if (!query) return true;
        const target = `${row.studentId} ${row.name} ${row.email}`.toLowerCase();
        return target.includes(query);
      });
  }, [students, scope, scopeEnabled, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visible = filtered.slice(startIndex, startIndex + pageSize);

  const openAdd = () => {
    setModal({ mode: "add" });
    setForm(createEmptyForm());
    setErrors({});
  };

  const openEdit = (student: StudentRecord) => {
    setModal({ mode: "edit", id: student.id });
    setForm({
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      status: student.status,
    });
    setErrors({});
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof StudentFormState, string>> = {};
    if (!form.studentId.trim()) nextErrors.studentId = "Required";
    if (!form.name.trim()) nextErrors.name = "Required";
    if (!form.email.trim()) nextErrors.email = "Required";
    setErrors(nextErrors);
    const isValid = Object.keys(nextErrors).length === 0;

    if (!isValid) {
      toast({
        title: "Failed",
        message: "Please complete all required student fields before saving.",
        variant: "error",
      });
    }

    return isValid;
  };

  const save = () => {
    if (!validate() || !modal) return;

    if (modal.mode === "add") {
      idCounter.current += 1;
      const next: StudentRecord = {
        id: `st-${String(idCounter.current).padStart(4, "0")}`,
        studentId: form.studentId.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        faculty: scope.faculty,
        degree: scope.degree,
        intake: scope.intake,
        term: scope.term,
        stream: scope.stream,
        subgroup: scope.subgroup,
        status: form.status,
      };
      setStudents((previous) => [next, ...previous]);
      toast({
        title: "Saved",
        message: "Student added successfully.",
        variant: "success",
      });
    } else {
      setStudents((previous) =>
        previous.map((row) =>
          row.id === modal.id
            ? {
                ...row,
                studentId: form.studentId.trim(),
                name: form.name.trim(),
                email: form.email.trim(),
                status: form.status,
              }
            : row
        )
      );
      toast({
        title: "Saved",
        message: "Student updated successfully.",
        variant: "success",
      });
    }

    setModal(null);
    setForm(createEmptyForm());
    setErrors({});
  };

  const remove = (student: StudentRecord) => {
    if (!window.confirm(`Delete ${student.name}? This cannot be undone.`)) {
      return;
    }
    setStudents((previous) => previous.filter((row) => row.id !== student.id));
    toast({
      title: "Deleted",
      message: `${student.name} was removed from the directory.`,
      variant: "success",
    });
  };

  const exportCsv = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `students_${scope.faculty}_${scope.degree}_${scope.intake}_${scope.term}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <>
            <Button className="gap-2" onClick={exportCsv} variant="secondary">
              <Download size={16} />
              Export
            </Button>
            <Button className="gap-2" onClick={openAdd}>
              <Plus size={16} />
              Add Student
            </Button>
          </>
        }
        description="Enterprise student directory with scoped filters, actions, and audit-ready UX."
        title="Students"
      />

      <div className="rounded-3xl border border-border bg-card p-4 shadow-shadow sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text/55" size={16} />
            <Input
              className="pl-9"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search by ID, name, or email…"
              value={searchQuery}
            />
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-[220px_220px_auto]">
            <Select
              aria-label="Status filter"
              onChange={(event) => {
                setStatusFilter(event.target.value as "" | StudentStatus);
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All statuses</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Inactive">Inactive</option>
            </Select>

            <div className="flex items-center justify-between rounded-2xl border border-border bg-tint px-3.5 py-2.5">
              <span className="text-sm text-text/75">Scope to context</span>
              <label className="inline-flex items-center gap-2 text-sm text-text/75">
                <input
                  checked={scopeEnabled}
                  className="h-4 w-4 accent-primary"
                  onChange={(event) => {
                    setScopeEnabled(event.target.checked);
                    setPage(1);
                  }}
                  type="checkbox"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-border bg-white px-3.5 py-2.5 text-sm text-text/75">
              <span className="font-semibold text-heading">{filtered.length}</span> results
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full border-collapse">
              <thead className="bg-tint text-left text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Intake</th>
                  <th className="px-4 py-3">Term</th>
                  <th className="px-4 py-3">Stream</th>
                  <th className="px-4 py-3">Subgroup</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((row) => (
                  <tr className="hover:bg-tint/60" key={row.id}>
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-heading">{row.name}</p>
                      <p className="mt-1 text-sm text-text/72">{row.studentId}</p>
                      <p className="mt-1 text-xs text-text/60">{row.email}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-text/75">
                      <span className="font-semibold text-heading">{row.faculty}</span> /{" "}
                      <span className="font-semibold text-heading">{row.degree}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-text/75">{row.intake}</td>
                    <td className="px-4 py-4 text-sm text-text/75">{row.term}</td>
                    <td className="px-4 py-4 text-sm text-text/75">{row.stream}</td>
                    <td className="px-4 py-4 text-sm text-text/75">{row.subgroup}</td>
                    <td className="px-4 py-4">
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          aria-label={`Edit ${row.name}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border text-text/75 transition-colors hover:bg-tint"
                          onClick={() => openEdit(row)}
                          type="button"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          aria-label={`Delete ${row.name}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border text-red-700 transition-colors hover:bg-red-50"
                          onClick={() => remove(row)}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-text/70" colSpan={8}>
                      No students match the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <TablePagination
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value as PageSize);
            setPage(1);
          }}
          page={safePage}
          pageCount={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
        />
      </div>

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModal(null);
              setErrors({});
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-xl rounded-3xl border border-border bg-white p-6 shadow-[0_12px_28px_rgba(38,21,15,0.18)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                  {modal.mode === "add" ? "Create" : "Edit"}
                </p>
                <p className="mt-1 text-xl font-semibold text-heading">
                  {modal.mode === "add" ? "Add Student" : "Update Student"}
                </p>
                <p className="mt-1 text-sm text-text/70">
                  Scope: {scope.faculty} / {scope.degree} / {scope.intake} / {scope.term} / {scope.stream} / {scope.subgroup}
                </p>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UserPlus2 size={18} />
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="text-sm font-medium text-heading" htmlFor="studentId">
                  Student ID
                </label>
                <Input
                  className={cn(
                    errors.studentId
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                      : ""
                  )}
                  id="studentId"
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, studentId: event.target.value }))
                  }
                  placeholder="e.g., IT23123456"
                  value={form.studentId}
                />
                {errors.studentId ? (
                  <p className="mt-1 text-xs text-red-700">{errors.studentId}</p>
                ) : null}
              </div>

              <div className="sm:col-span-1">
                <label className="text-sm font-medium text-heading" htmlFor="status">
                  Status
                </label>
                <Select
                  id="status"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      status: event.target.value as StudentStatus,
                    }))
                  }
                  value={form.status}
                >
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-heading" htmlFor="name">
                  Full name
                </label>
                <Input
                  className={cn(
                    errors.name ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200" : ""
                  )}
                  id="name"
                  onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="e.g., Maya Rodrigo"
                  value={form.name}
                />
                {errors.name ? <p className="mt-1 text-xs text-red-700">{errors.name}</p> : null}
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-heading" htmlFor="email">
                  Email
                </label>
                <Input
                  className={cn(
                    errors.email ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200" : ""
                  )}
                  id="email"
                  onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                  placeholder="name@campus.edu"
                  value={form.email}
                />
                {errors.email ? <p className="mt-1 text-xs text-red-700">{errors.email}</p> : null}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                onClick={() => {
                  setModal(null);
                  setErrors({});
                }}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button onClick={save}>{modal.mode === "add" ? "Create" : "Save changes"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
