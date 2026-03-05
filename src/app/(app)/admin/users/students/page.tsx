"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import PageHeader from "@/components/admin/PageHeader";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";

type StudentStatus = "ACTIVE" | "INACTIVE";
type StudentStream = "WEEKDAY" | "WEEKEND";
type SortOption = "updated" | "created" | "az" | "za";
type PageSize = 10 | 25 | 50 | 100;

interface StudentRecord {
  id: string;
  studentId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  facultyId: string;
  facultyName: string;
  degreeProgramId: string;
  degreeProgramName: string;
  intakeId: string;
  intakeName: string;
  intakeCurrentTerm: string;
  stream: StudentStream;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
}

interface FacultyOption {
  id: string;
  code: string;
  name: string;
}

interface DegreeOption {
  id: string;
  code: string;
  name: string;
  facultyCode: string;
}

interface IntakeOption {
  id: string;
  name: string;
  facultyCode: string;
  degreeCode: string;
  currentTerm: string;
  status: string;
}

interface StudentsResponse {
  items: StudentRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface StudentFormState {
  firstName: string;
  lastName: string;
  phone: string;
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
  stream: StudentStream;
  status: StudentStatus;
  studentId: string;
  email: string;
}

interface StudentModalState {
  mode: "add" | "edit";
  targetId?: string;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function sanitizeStudentStatus(value: unknown): StudentStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function sanitizeStudentStream(value: unknown): StudentStream {
  return value === "WEEKEND" ? "WEEKEND" : "WEEKDAY";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toISOString().slice(0, 10);
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function emptyForm(): StudentFormState {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    facultyId: "",
    degreeProgramId: "",
    intakeId: "",
    stream: "WEEKDAY",
    status: "ACTIVE",
    studentId: "",
    email: "",
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function statusVariant(status: StudentStatus) {
  return status === "ACTIVE" ? "success" : "neutral";
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "message" in payload && payload.message
        ? payload.message
        : "Request failed"
    );
  }

  return (payload ?? ({} as T)) as T;
}

function parseStudentsResponse(payload: unknown): StudentsResponse {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];
  const items = rows
    .map((row) => {
      const item = asObject(row);
      if (!item) {
        return null;
      }

      const id = String(item.id ?? item._id ?? "").trim();
      const studentId = String(item.studentId ?? "").trim().toUpperCase();
      const email = String(item.email ?? "").trim().toLowerCase();
      const firstName = collapseSpaces(item.firstName);
      const lastName = collapseSpaces(item.lastName);
      const facultyId = normalizeAcademicCode(item.facultyId);
      const degreeProgramId = normalizeAcademicCode(
        item.degreeProgramId ?? item.degreeId
      );
      const intakeId = String(item.intakeId ?? "").trim();
      const intakeInfo = asObject(item.intake);

      if (!id || !studentId || !email || !firstName || !lastName || !facultyId || !degreeProgramId || !intakeId) {
        return null;
      }

      return {
        id,
        studentId,
        email,
        firstName,
        lastName,
        phone: collapseSpaces(item.phone),
        facultyId,
        facultyName: collapseSpaces(item.facultyName),
        degreeProgramId,
        degreeProgramName: collapseSpaces(item.degreeProgramName),
        intakeId,
        intakeName: collapseSpaces(intakeInfo?.name ?? item.intakeName),
        intakeCurrentTerm: collapseSpaces(intakeInfo?.currentTerm ?? item.currentTerm),
        stream: sanitizeStudentStream(item.stream),
        status: sanitizeStudentStatus(item.status),
        createdAt: String(item.createdAt ?? ""),
        updatedAt: String(item.updatedAt ?? ""),
      } satisfies StudentRecord;
    })
    .filter((item): item is StudentRecord => Boolean(item));

  const total = Math.max(0, Number(root?.total) || items.length);
  const page = Math.max(1, Number(root?.page) || 1);
  const pageSize = [10, 25, 50, 100].includes(Number(root?.pageSize))
    ? (Number(root?.pageSize) as PageSize)
    : 10;

  return {
    items,
    total,
    page,
    pageSize,
  };
}

function parseFaculties(payload: unknown): FacultyOption[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((row) => {
      const item = asObject(row);
      if (!item) {
        return null;
      }

      const code = normalizeAcademicCode(item.code);
      if (!code) {
        return null;
      }

      return {
        id: code,
        code,
        name: collapseSpaces(item.name),
      } satisfies FacultyOption;
    })
    .filter((item): item is FacultyOption => Boolean(item));
}

function parseDegrees(payload: unknown): DegreeOption[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return rows
    .map((row) => {
      const item = asObject(row);
      if (!item) {
        return null;
      }

      const code = normalizeAcademicCode(item.code);
      const facultyCode = normalizeAcademicCode(item.facultyCode);
      if (!code || !facultyCode) {
        return null;
      }

      return {
        id: String(item.id ?? code),
        code,
        name: collapseSpaces(item.name),
        facultyCode,
      } satisfies DegreeOption;
    })
    .filter((item): item is DegreeOption => Boolean(item));
}

function parseIntakes(payload: unknown): IntakeOption[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return rows
    .map((row) => {
      const item = asObject(row);
      if (!item) {
        return null;
      }

      const id = String(item.id ?? "").trim();
      if (!id) {
        return null;
      }

      return {
        id,
        name: collapseSpaces(item.name),
        facultyCode: normalizeAcademicCode(item.facultyCode),
        degreeCode: normalizeAcademicCode(item.degreeCode),
        currentTerm: collapseSpaces(item.currentTerm),
        status: String(item.status ?? "").trim().toUpperCase(),
      } satisfies IntakeOption;
    })
    .filter((item): item is IntakeOption => Boolean(item));
}

export default function StudentsAdminPage() {
  const { toast } = useToast();
  const { setActiveWindow } = useAdminContext();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingDegrees, setIsLoadingDegrees] = useState(false);
  const [isLoadingIntakes, setIsLoadingIntakes] = useState(false);
  const [isLoadingIntakeTerm, setIsLoadingIntakeTerm] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StudentStatus>("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);

  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [degreeOptions, setDegreeOptions] = useState<DegreeOption[]>([]);
  const [intakeOptions, setIntakeOptions] = useState<IntakeOption[]>([]);

  const [modal, setModal] = useState<StudentModalState | null>(null);
  const [form, setForm] = useState<StudentFormState>(emptyForm());
  const [selectedIntakeTerm, setSelectedIntakeTerm] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StudentRecord | null>(null);

  const deferredSearch = useDeferredValue(searchQuery);
  const previewRequestIdRef = useRef(0);
  const intakeTermRequestIdRef = useRef(0);
  const isOverlayOpen = Boolean(modal || deleteTarget);

  const loadStudents = useCallback(
    async (options?: { background?: boolean }) => {
      if (!options?.background) {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          sort: sortBy,
        });
        if (deferredSearch.trim()) {
          params.set("search", deferredSearch.trim());
        }
        if (statusFilter) {
          params.set("status", statusFilter);
        }

        const response = await fetch(`/api/students?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = await readJson<unknown>(response);
        const parsed = parseStudentsResponse(payload);
        setStudents(parsed.items);
        setTotalCount(parsed.total);
      } catch (error) {
        toast({
          title: "Failed",
          message: error instanceof Error ? error.message : "Failed to load students",
          variant: "error",
        });
        setStudents([]);
        setTotalCount(0);
      } finally {
        if (!options?.background) {
          setIsLoading(false);
        }
      }
    },
    [deferredSearch, page, pageSize, sortBy, statusFilter, toast]
  );

  const loadFaculties = useCallback(async () => {
    try {
      const response = await fetch("/api/faculties", { cache: "no-store" });
      const payload = await readJson<unknown>(response);
      setFaculties(parseFaculties(payload));
    } catch {
      setFaculties([]);
    }
  }, []);

  const loadDegrees = useCallback(async (facultyId: string) => {
    const nextFacultyId = normalizeAcademicCode(facultyId);
    if (!nextFacultyId) {
      setDegreeOptions([]);
      return;
    }

    setIsLoadingDegrees(true);
    try {
      const response = await fetch(
        `/api/degrees?facultyId=${encodeURIComponent(nextFacultyId)}&status=ACTIVE`,
        { cache: "no-store" }
      );
      const payload = await readJson<unknown>(response);
      setDegreeOptions(parseDegrees(payload));
    } catch {
      setDegreeOptions([]);
    } finally {
      setIsLoadingDegrees(false);
    }
  }, []);

  const loadIntakes = useCallback(async (facultyId: string, degreeProgramId: string) => {
    const nextDegreeProgramId = normalizeAcademicCode(degreeProgramId);
    if (!nextDegreeProgramId) {
      setIntakeOptions([]);
      return;
    }

    setIsLoadingIntakes(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        sort: "az",
        status: "ACTIVE",
        degreeProgramId: nextDegreeProgramId,
      });
      const nextFacultyId = normalizeAcademicCode(facultyId);
      if (nextFacultyId) {
        params.set("facultyId", nextFacultyId);
      }

      const response = await fetch(`/api/intakes?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await readJson<unknown>(response);
      const parsed = parseIntakes(payload).filter(
        (item) =>
          !nextFacultyId ||
          (item.facultyCode === nextFacultyId &&
            item.degreeCode === nextDegreeProgramId)
      );
      setIntakeOptions(parsed);
    } catch {
      setIntakeOptions([]);
    } finally {
      setIsLoadingIntakes(false);
    }
  }, []);

  const loadIntakeTerm = useCallback(async (intakeId: string) => {
    const nextIntakeId = String(intakeId ?? "").trim();
    if (!nextIntakeId) {
      setSelectedIntakeTerm("");
      return;
    }

    const requestId = intakeTermRequestIdRef.current + 1;
    intakeTermRequestIdRef.current = requestId;
    setIsLoadingIntakeTerm(true);

    try {
      const response = await fetch(
        `/api/intakes/${encodeURIComponent(nextIntakeId)}`,
        { cache: "no-store" }
      );
      const payload = await readJson<unknown>(response);
      const root = asObject(payload);
      const currentTerm = collapseSpaces(root?.currentTerm);

      if (intakeTermRequestIdRef.current !== requestId) {
        return;
      }

      setSelectedIntakeTerm(currentTerm);
    } catch {
      if (intakeTermRequestIdRef.current !== requestId) {
        return;
      }

      const fallbackTerm =
        intakeOptions.find((item) => item.id === nextIntakeId)?.currentTerm ?? "";
      setSelectedIntakeTerm(fallbackTerm);
    } finally {
      if (intakeTermRequestIdRef.current === requestId) {
        setIsLoadingIntakeTerm(false);
      }
    }
  }, [intakeOptions]);

  const loadPreview = useCallback(async (intakeId: string) => {
    const nextIntakeId = String(intakeId ?? "").trim();
    if (!nextIntakeId) {
      setForm((previous) => ({
        ...previous,
        studentId: "",
        email: "",
      }));
      return;
    }

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setIsLoadingPreview(true);

    try {
      const response = await fetch(
        `/api/students/next-id?intakeId=${encodeURIComponent(nextIntakeId)}`,
        { cache: "no-store" }
      );
      const payload = await readJson<unknown>(response);
      const root = asObject(payload);
      const studentIdPreview = String(root?.studentIdPreview ?? "").trim().toUpperCase();
      const emailPreview = String(root?.emailPreview ?? "").trim().toLowerCase();

      if (previewRequestIdRef.current !== requestId) {
        return;
      }

      setForm((previous) =>
        previous.intakeId !== nextIntakeId
          ? previous
          : {
              ...previous,
              studentId: studentIdPreview,
              email: emailPreview,
            }
      );
    } catch (error) {
      if (previewRequestIdRef.current !== requestId) {
        return;
      }

      setForm((previous) => ({
        ...previous,
        studentId: "",
        email: "",
      }));
      toast({
        title: "Failed",
        message:
          error instanceof Error ? error.message : "Failed to generate student ID preview",
        variant: "error",
      });
    } finally {
      if (previewRequestIdRef.current === requestId) {
        setIsLoadingPreview(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    void loadFaculties();
  }, [loadFaculties]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOverlayOpen]);

  useEffect(() => {
    if (!modal) {
      setActiveWindow("List");
      return;
    }

    setActiveWindow(modal.mode === "add" ? "Create" : "Edit");
  }, [modal, setActiveWindow]);

  useEffect(() => {
    return () => {
      setActiveWindow(null);
    };
  }, [setActiveWindow]);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount);

  const openAddModal = () => {
    setModal({ mode: "add" });
    setForm(emptyForm());
    setDegreeOptions([]);
    setIntakeOptions([]);
    setSelectedIntakeTerm("");
    setFormError("");
    setIsLoadingPreview(false);
    setIsLoadingIntakeTerm(false);
  };

  const openEditModal = (student: StudentRecord) => {
    setModal({ mode: "edit", targetId: student.id });
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone,
      facultyId: student.facultyId,
      degreeProgramId: student.degreeProgramId,
      intakeId: student.intakeId,
      stream: student.stream,
      status: student.status,
      studentId: student.studentId,
      email: student.email,
    });
    setFormError("");
    setIsLoadingPreview(false);
    setSelectedIntakeTerm(student.intakeCurrentTerm);
    setIsLoadingIntakeTerm(false);

    void (async () => {
      await loadDegrees(student.facultyId);
      await loadIntakes(student.facultyId, student.degreeProgramId);
      await loadIntakeTerm(student.intakeId);
    })();
  };

  const closeModal = () => {
    if (isSaving) {
      return;
    }

    setModal(null);
    setForm(emptyForm());
    setDegreeOptions([]);
    setIntakeOptions([]);
    setSelectedIntakeTerm("");
    setFormError("");
    setIsLoadingPreview(false);
    setIsLoadingIntakeTerm(false);
  };

  const validateForm = () => {
    if (!collapseSpaces(form.firstName)) return "First name is required";
    if (!collapseSpaces(form.lastName)) return "Last name is required";
    if (!form.facultyId) return "Faculty is required";
    if (!form.degreeProgramId) return "Degree is required";
    if (!form.intakeId) return "Intake is required";
    if (!form.stream) return "Stream is required";
    if (!form.studentId || !form.email) return "Student ID and email preview are required";
    return "";
  };

  const saveStudent = async () => {
    if (!modal) {
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      toast({
        title: "Failed",
        message: validationError,
        variant: "error",
      });
      return;
    }

    const payload = {
      firstName: collapseSpaces(form.firstName),
      lastName: collapseSpaces(form.lastName),
      phone: collapseSpaces(form.phone),
      facultyId: form.facultyId,
      degreeProgramId: form.degreeProgramId,
      intakeId: form.intakeId,
      stream: form.stream,
      status: form.status,
    };

    setIsSaving(true);
    try {
      if (modal.mode === "add") {
        await readJson<unknown>(
          await fetch("/api/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );

        toast({
          title: "Saved",
          message: "Student registered + login created",
          variant: "success",
        });
      } else {
        await readJson<unknown>(
          await fetch(`/api/students/${encodeURIComponent(String(modal.targetId ?? ""))}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );

        toast({
          title: "Saved",
          message: "Student updated successfully",
          variant: "success",
        });
      }

      closeModal();
      await loadStudents({ background: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save student";
      setFormError(message);
      toast({
        title: "Failed",
        message,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      await readJson<unknown>(
        await fetch(`/api/students/${encodeURIComponent(deleteTarget.id)}`, {
          method: "DELETE",
        })
      );
      toast({
        title: "Deleted",
        message: "Student deleted and login deactivated",
        variant: "success",
      });
      setDeleteTarget(null);
      await loadStudents({ background: true });
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to delete student",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedFacultyDegrees = useMemo(
    () =>
      degreeOptions.filter((degree) => degree.facultyCode === form.facultyId),
    [degreeOptions, form.facultyId]
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <Button
            className="h-11 min-w-[164px] justify-center gap-2 rounded-2xl bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] transition-colors hover:bg-[#0339a6]"
            onClick={openAddModal}
          >
            <Plus size={16} /> Add Student
          </Button>
        }
        description="Register students with auto IT number, auto email, and auto login account creation."
        title="Students"
      />

      <Card className={cn("transition-all", isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : "")}> 
        <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_220px_220px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/50" size={16} />
                <Input
                  aria-label="Search students"
                  className="h-12 pl-10"
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by student ID, name, email"
                  value={searchQuery}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Status
              </label>
              <Select
                className="h-12"
                onChange={(event) => {
                  setStatusFilter(event.target.value as "" | StudentStatus);
                  setPage(1);
                }}
                value={statusFilter}
              >
                <option value="">All</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Sort
              </label>
              <Select
                className="h-12"
                onChange={(event) => {
                  setSortBy(event.target.value as SortOption);
                  setPage(1);
                }}
                value={sortBy}
              >
                <option value="updated">Recently Updated</option>
                <option value="created">Recently Added</option>
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-tint px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
              Total Students
            </p>
            <p className="mt-1 text-2xl font-semibold text-heading">{totalCount}</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="border-b border-border bg-tint">
              <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Faculty</th>
                <th className="px-4 py-3">Degree</th>
                <th className="px-4 py-3">Intake</th>
                <th className="px-4 py-3">Stream</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={8}>
                    Loading student records...
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? students.map((student) => (
                    <tr className="border-b border-border/70 transition-colors hover:bg-tint" key={student.id}>
                      <td className="px-4 py-4 font-semibold text-heading">{student.studentId}</td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-heading">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="mt-0.5 text-xs text-text/60">
                          Updated {formatDate(student.updatedAt)}
                        </p>
                        <p className="mt-0.5 text-xs text-text/65">{student.email}</p>
                      </td>
                      <td className="px-4 py-4 text-text/75">
                        {student.facultyId}
                        {student.facultyName ? (
                          <p className="text-xs text-text/58">{student.facultyName}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-text/75">
                        {student.degreeProgramId}
                        {student.degreeProgramName ? (
                          <p className="text-xs text-text/58">{student.degreeProgramName}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-text/75">{student.intakeName || "—"}</td>
                      <td className="px-4 py-4 text-text/75">{student.stream}</td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant(student.status)}>{student.status}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            aria-label={`Edit ${student.studentId}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
                            onClick={() => openEditModal(student)}
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            aria-label={`Delete ${student.studentId}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
                            onClick={() => setDeleteTarget(student)}
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}

              {!isLoading && students.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={8}>
                    No students match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <TablePagination
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value as PageSize);
            setPage(1);
          }}
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          totalItems={totalCount}
        />
      </Card>

      {modal ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              closeModal();
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]"
            role="dialog"
          >
            <div className="overflow-y-auto px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                    {modal.mode === "add" ? "CREATE" : "EDIT"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-heading">
                    {modal.mode === "add" ? "Add Student" : "Edit Student"}
                  </p>
                </div>
                <button
                  aria-label="Close student modal"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  onClick={closeModal}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">First Name</label>
                  <Input
                    className="h-12"
                    disabled={isSaving}
                    onChange={(event) => setForm((previous) => ({ ...previous, firstName: event.target.value }))}
                    value={form.firstName}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Last Name</label>
                  <Input
                    className="h-12"
                    disabled={isSaving}
                    onChange={(event) => setForm((previous) => ({ ...previous, lastName: event.target.value }))}
                    value={form.lastName}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Phone</label>
                  <Input
                    className="h-12"
                    disabled={isSaving}
                    onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))}
                    value={form.phone}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Status</label>
                  <Select
                    className="h-12"
                    disabled={isSaving}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        status: sanitizeStudentStatus(event.target.value),
                      }))
                    }
                    value={form.status}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Faculty</label>
                  <Select
                    className="h-12"
                    disabled={isSaving}
                    onChange={(event) => {
                      const facultyId = normalizeAcademicCode(event.target.value);
                      setForm((previous) => ({
                        ...previous,
                        facultyId,
                        degreeProgramId: "",
                        intakeId: "",
                        studentId: modal.mode === "add" ? "" : previous.studentId,
                        email: modal.mode === "add" ? "" : previous.email,
                      }));
                      setIntakeOptions([]);
                      setSelectedIntakeTerm("");
                      setIsLoadingIntakeTerm(false);
                      void loadDegrees(facultyId);
                    }}
                    value={form.facultyId}
                  >
                    <option value="">Select Faculty</option>
                    {faculties.map((faculty) => (
                      <option key={faculty.code} value={faculty.code}>
                        {faculty.code} - {faculty.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Degree</label>
                  <Select
                    className="h-12"
                    disabled={isSaving || !form.facultyId || isLoadingDegrees}
                    onChange={(event) => {
                      const degreeProgramId = normalizeAcademicCode(event.target.value);
                      setForm((previous) => ({
                        ...previous,
                        degreeProgramId,
                        intakeId: "",
                        studentId: modal.mode === "add" ? "" : previous.studentId,
                        email: modal.mode === "add" ? "" : previous.email,
                      }));
                      setSelectedIntakeTerm("");
                      setIsLoadingIntakeTerm(false);
                      void loadIntakes(form.facultyId, degreeProgramId);
                    }}
                    value={form.degreeProgramId}
                  >
                    <option value="">
                      {isLoadingDegrees ? "Loading..." : "Select Degree"}
                    </option>
                    {selectedFacultyDegrees.map((degree) => (
                      <option key={degree.code} value={degree.code}>
                        {degree.code} - {degree.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Intake</label>
                  <Select
                    className="h-12"
                    disabled={isSaving || !form.degreeProgramId || isLoadingIntakes}
                    onChange={(event) => {
                      const intakeId = String(event.target.value ?? "").trim();
                      setForm((previous) => ({
                        ...previous,
                        intakeId,
                        studentId: modal.mode === "add" ? "" : previous.studentId,
                        email: modal.mode === "add" ? "" : previous.email,
                      }));
                      void loadIntakeTerm(intakeId);
                      if (modal.mode === "add") {
                        void loadPreview(intakeId);
                      }
                    }}
                    value={form.intakeId}
                  >
                    <option value="">
                      {isLoadingIntakes ? "Loading..." : "Select Intake"}
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
                        : isLoadingIntakeTerm
                          ? "Loading..."
                          : selectedIntakeTerm || "—"
                    }
                  />
                  <p className="mt-1 text-xs text-text/60">
                    This is controlled by the Intake term schedule.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Stream</label>
                  <Select
                    className="h-12"
                    disabled={isSaving}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        stream: sanitizeStudentStream(event.target.value),
                      }))
                    }
                    value={form.stream}
                  >
                    <option value="WEEKDAY">WEEKDAY</option>
                    <option value="WEEKEND">WEEKEND</option>
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Student ID (Auto)</label>
                  <Input
                    className="h-12"
                    disabled
                    placeholder={isLoadingPreview ? "Generating..." : "Auto-generated"}
                    value={form.studentId}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Email (Auto)</label>
                  <Input
                    className="h-12"
                    disabled
                    placeholder={isLoadingPreview ? "Generating..." : "Auto-generated"}
                    value={form.email}
                  />
                </div>
              </div>

              {formError ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-white px-6 py-4">
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button
                  className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                  disabled={isSaving}
                  onClick={closeModal}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 min-w-[132px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
                  disabled={isSaving}
                  onClick={() => {
                    void saveStudent();
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting) {
              setDeleteTarget(null);
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]"
            role="dialog"
          >
            <div className="px-6 py-6">
              <p className="text-lg font-semibold text-heading">Delete Student</p>
              <p className="mt-2 text-sm leading-6 text-text/70">
                Are you sure you want to delete student{" "}
                <span className="font-semibold text-heading">
                  {deleteTarget.studentId} ({deleteTarget.firstName} {deleteTarget.lastName})
                </span>
                ? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
              <Button
                className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[132px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700"
                disabled={isDeleting}
                onClick={() => {
                  void confirmDelete();
                }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
