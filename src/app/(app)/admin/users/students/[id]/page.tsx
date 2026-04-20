"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Users2,
  X,
} from "lucide-react";
import AdminSummaryCard from "@/components/admin/AdminSummaryCard";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";
import { useAdminContext } from "@/components/admin/AdminContext";
import ConfirmDeleteEnrollmentModal from "./components/ConfirmDeleteEnrollmentModal";
import EditEnrollmentModal, {
  type EditEnrollmentFormState,
  type EditIntakeOption,
} from "./components/EditEnrollmentModal";

type StudentStatus = "ACTIVE" | "INACTIVE";
type StudentStream = "WEEKDAY" | "WEEKEND";

interface EnrollmentRecord {
  id: string;
  facultyId: string;
  facultyName: string;
  degreeProgramId: string;
  degreeProgramName: string;
  intakeId: string;
  intakeName: string;
  currentTerm: string;
  stream: StudentStream;
  subgroup: string;
  status: StudentStatus;
  updatedAt: string;
}

interface StudentDetailRecord {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: StudentStatus;
  enrollments: EnrollmentRecord[];
  updatedAt: string;
}

interface FacultyOption {
  code: string;
  name: string;
}

interface DegreeOption {
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
}

interface SubgroupOption {
  code: string;
  count: number;
}

interface EnrollmentFormState {
  facultyId: string;
  degreeProgramId: string;
  intakeId: string;
  stream: StudentStream;
  subgroup: string;
  status: StudentStatus;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeStudentStatus(value: unknown): StudentStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function sanitizeStudentStream(value: unknown): StudentStream {
  return value === "WEEKEND" ? "WEEKEND" : "WEEKDAY";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toISOString().slice(0, 10);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function statusVariant(status: StudentStatus) {
  return status === "ACTIVE" ? "success" : "neutral";
}

function emptyEnrollmentForm(): EnrollmentFormState {
  return {
    facultyId: "",
    degreeProgramId: "",
    intakeId: "",
    stream: "WEEKDAY",
    subgroup: "",
    status: "ACTIVE",
  };
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

function parseEnrollment(value: unknown): EnrollmentRecord | null {
  const item = asObject(value);
  if (!item) {
    return null;
  }

  const id = String(item.id ?? item._id ?? "").trim();
  const facultyId = normalizeAcademicCode(item.facultyId);
  const degreeProgramId = normalizeAcademicCode(item.degreeProgramId);
  const intakeId = String(item.intakeId ?? "").trim();

  if (!id || !facultyId || !degreeProgramId || !intakeId) {
    return null;
  }

  return {
    id,
    facultyId,
    facultyName: collapseSpaces(item.facultyName),
    degreeProgramId,
    degreeProgramName: collapseSpaces(item.degreeProgramName),
    intakeId,
    intakeName: collapseSpaces(item.intakeName),
    currentTerm: collapseSpaces(item.currentTerm),
    stream: sanitizeStudentStream(item.stream),
    subgroup: collapseSpaces(item.subgroup),
    status: sanitizeStudentStatus(item.status),
    updatedAt: String(item.updatedAt ?? ""),
  };
}

function parseStudentDetail(payload: unknown): StudentDetailRecord | null {
  const root = asObject(payload);
  if (!root) {
    return null;
  }

  const id = String(root.id ?? root._id ?? "").trim();
  const studentId = String(root.studentId ?? "").trim().toUpperCase();
  const firstName = collapseSpaces(root.firstName);
  const lastName = collapseSpaces(root.lastName);
  const email = String(root.email ?? "").trim().toLowerCase();

  if (!id || !studentId || !firstName || !lastName || !email) {
    return null;
  }

  const rows = Array.isArray(root.enrollments) ? root.enrollments : [];

  return {
    id,
    studentId,
    firstName,
    lastName,
    email,
    phone: collapseSpaces(root.phone),
    status: sanitizeStudentStatus(root.status),
    enrollments: rows
      .map((row) => parseEnrollment(row))
      .filter((row): row is EnrollmentRecord => Boolean(row)),
    updatedAt: String(root.updatedAt ?? ""),
  };
}

function parseEnrollmentsResponse(payload: unknown): EnrollmentRecord[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items)
    ? (root.items as unknown[])
    : Array.isArray(payload)
      ? (payload as unknown[])
      : [];

  return rows
    .map((row) => parseEnrollment(row))
    .filter((row): row is EnrollmentRecord => Boolean(row));
}

function parseFaculties(payload: unknown): FacultyOption[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((row) => {
      const item = asObject(row);
      if (!item) return null;
      const code = normalizeAcademicCode(item.code);
      if (!code) return null;
      return {
        code,
        name: collapseSpaces(item.name),
      };
    })
    .filter((row): row is FacultyOption => Boolean(row));
}

function parseDegrees(payload: unknown): DegreeOption[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return rows
    .map((row) => {
      const item = asObject(row);
      if (!item) return null;
      const code = normalizeAcademicCode(item.code);
      const facultyCode = normalizeAcademicCode(item.facultyCode);
      if (!code || !facultyCode) return null;
      return {
        code,
        name: collapseSpaces(item.name),
        facultyCode,
      };
    })
    .filter((row): row is DegreeOption => Boolean(row));
}

function parseIntakes(payload: unknown): IntakeOption[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return rows
    .map((row) => {
      const item = asObject(row);
      if (!item) return null;
      const id = String(item.id ?? "").trim();
      if (!id) return null;
      return {
        id,
        name: collapseSpaces(item.name),
        facultyCode: normalizeAcademicCode(item.facultyCode),
        degreeCode: normalizeAcademicCode(item.degreeCode),
        currentTerm: collapseSpaces(item.currentTerm),
      };
    })
    .filter((row): row is IntakeOption => Boolean(row));
}

function parseSubgroups(payload: unknown): SubgroupOption[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];
  const grouped = new Map<string, number>();

  rows.forEach((row) => {
    const item = asObject(row);
    if (!item) {
      return;
    }

    const code = collapseSpaces(item.code);
    if (!code) {
      return;
    }

    const count = Math.max(0, Number(item.count) || 0);
    grouped.set(code, (grouped.get(code) ?? 0) + count);
  });

  return Array.from(grouped.entries())
    .sort((left, right) =>
      left[0].localeCompare(right[0], undefined, {
        numeric: true,
        sensitivity: "base",
      })
    )
    .map(([code, count]) => ({ code, count }));
}

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const studentRecordId = String(params?.id ?? "").trim();
  const { toast } = useToast();
  const { setActiveWindow } = useAdminContext();

  const [student, setStudent] = useState<StudentDetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(true);
  const [enrollmentsError, setEnrollmentsError] = useState("");

  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [intakes, setIntakes] = useState<IntakeOption[]>([]);
  const [subgroupOptions, setSubgroupOptions] = useState<SubgroupOption[]>([]);

  const [form, setForm] = useState<EnrollmentFormState>(emptyEnrollmentForm());
  const [selectedIntakeTerm, setSelectedIntakeTerm] = useState("");
  const [isLoadingDegrees, setIsLoadingDegrees] = useState(false);
  const [isLoadingIntakes, setIsLoadingIntakes] = useState(false);
  const [isLoadingTerm, setIsLoadingTerm] = useState(false);
  const [isLoadingSubgroups, setIsLoadingSubgroups] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editTarget, setEditTarget] = useState<EnrollmentRecord | null>(null);
  const [editForm, setEditForm] = useState<EditEnrollmentFormState>({
    facultyId: "",
    facultyName: "",
    degreeProgramId: "",
    degreeProgramName: "",
    intakeId: "",
    stream: "WEEKDAY",
    subgroup: "",
    status: "ACTIVE",
  });
  const [editFormError, setEditFormError] = useState("");
  const [editIntakeOptions, setEditIntakeOptions] = useState<EditIntakeOption[]>(
    []
  );
  const [selectedEditIntakeTerm, setSelectedEditIntakeTerm] = useState("");
  const [isLoadingEditIntakes, setIsLoadingEditIntakes] = useState(false);
  const [isLoadingEditTerm, setIsLoadingEditTerm] = useState(false);
  const [editSubgroupOptions, setEditSubgroupOptions] = useState<SubgroupOption[]>([]);
  const [isLoadingEditSubgroups, setIsLoadingEditSubgroups] = useState(false);
  const [isUpdatingEnrollment, setIsUpdatingEnrollment] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<EnrollmentRecord | null>(null);
  const [isDeletingEnrollment, setIsDeletingEnrollment] = useState(false);

  const termRequestIdRef = useRef(0);
  const editTermRequestIdRef = useRef(0);
  const subgroupRequestIdRef = useRef(0);
  const editSubgroupRequestIdRef = useRef(0);

  const loadStudent = useCallback(async () => {
    if (!studentRecordId) {
      setError("Student id is missing");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/students/${encodeURIComponent(studentRecordId)}`, {
        cache: "no-store",
      });
      const payload = await readJson<unknown>(response);
      const parsed = parseStudentDetail(payload);
      if (!parsed) {
        throw new Error("Failed to parse student profile");
      }

      setStudent(parsed);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load profile";
      setError(message);
      setStudent(null);
    } finally {
      setIsLoading(false);
    }
  }, [studentRecordId]);

  const loadEnrollments = useCallback(async () => {
    if (!studentRecordId) {
      setEnrollmentsError("Failed to load enrollments");
      setIsLoadingEnrollments(false);
      return;
    }

    setIsLoadingEnrollments(true);
    setEnrollmentsError("");
    try {
      const response = await fetch(
        `/api/students/${encodeURIComponent(studentRecordId)}/enrollments`,
        {
          cache: "no-store",
        }
      );
      const payload = await readJson<unknown>(response);
      setEnrollments(parseEnrollmentsResponse(payload));
    } catch {
      setEnrollments([]);
      setEnrollmentsError("Failed to load enrollments");
    } finally {
      setIsLoadingEnrollments(false);
    }
  }, [studentRecordId]);

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
      setDegrees([]);
      return;
    }

    setIsLoadingDegrees(true);
    try {
      const response = await fetch(
        `/api/degrees?facultyId=${encodeURIComponent(nextFacultyId)}&status=ACTIVE`,
        { cache: "no-store" }
      );
      const payload = await readJson<unknown>(response);
      setDegrees(parseDegrees(payload));
    } catch {
      setDegrees([]);
    } finally {
      setIsLoadingDegrees(false);
    }
  }, []);

  const loadIntakes = useCallback(async (facultyId: string, degreeProgramId: string) => {
    const nextDegreeProgramId = normalizeAcademicCode(degreeProgramId);
    if (!nextDegreeProgramId) {
      setIntakes([]);
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
      setIntakes(parseIntakes(payload));
    } catch {
      setIntakes([]);
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

    const requestId = termRequestIdRef.current + 1;
    termRequestIdRef.current = requestId;
    setIsLoadingTerm(true);

    try {
      const response = await fetch(`/api/intakes/${encodeURIComponent(nextIntakeId)}`, {
        cache: "no-store",
      });
      const payload = await readJson<unknown>(response);
      const root = asObject(payload);
      const currentTerm = collapseSpaces(root?.currentTerm);

      if (termRequestIdRef.current !== requestId) {
        return;
      }

      setSelectedIntakeTerm(currentTerm);
    } catch {
      if (termRequestIdRef.current !== requestId) {
        return;
      }

      const fallback = intakes.find((item) => item.id === nextIntakeId)?.currentTerm ?? "";
      setSelectedIntakeTerm(fallback);
    } finally {
      if (termRequestIdRef.current === requestId) {
        setIsLoadingTerm(false);
      }
    }
  }, [intakes]);

  const loadSubgroups = useCallback(
    async (input: {
      intakeId: string;
      facultyId?: string;
      degreeProgramId?: string;
      stream?: StudentStream;
    }) => {
      const intakeId = String(input.intakeId ?? "").trim();
      if (!intakeId) {
        setSubgroupOptions([]);
        return;
      }

      const requestId = subgroupRequestIdRef.current + 1;
      subgroupRequestIdRef.current = requestId;
      setIsLoadingSubgroups(true);

      try {
        const params = new URLSearchParams();
        const facultyId = normalizeAcademicCode(input.facultyId);
        const degreeProgramId = normalizeAcademicCode(input.degreeProgramId);
        if (facultyId) {
          params.set("facultyId", facultyId);
        }
        if (degreeProgramId) {
          params.set("degreeProgramId", degreeProgramId);
        }
        if (input.stream === "WEEKDAY" || input.stream === "WEEKEND") {
          params.set("stream", input.stream);
        }
        params.set("status", "ACTIVE");

        const response = await fetch(
          `/api/intakes/${encodeURIComponent(intakeId)}/subgroups?${params.toString()}`,
          { cache: "no-store" }
        );
        const payload = await readJson<unknown>(response);
        if (subgroupRequestIdRef.current !== requestId) {
          return;
        }

        const nextOptions = parseSubgroups(payload);
        setSubgroupOptions(nextOptions);
        setForm((previous) => {
          if (previous.intakeId !== intakeId) {
            return previous;
          }

          const subgroup = collapseSpaces(previous.subgroup);
          if (!subgroup || nextOptions.some((item) => item.code === subgroup)) {
            return previous;
          }

          return {
            ...previous,
            subgroup: "",
          };
        });
      } catch {
        if (subgroupRequestIdRef.current !== requestId) {
          return;
        }

        setSubgroupOptions([]);
      } finally {
        if (subgroupRequestIdRef.current === requestId) {
          setIsLoadingSubgroups(false);
        }
      }
    },
    []
  );

  const loadEditIntakes = useCallback(
    async (
      facultyId: string,
      degreeProgramId: string,
      currentEnrollment?: EnrollmentRecord | null
    ) => {
      const nextDegreeProgramId = normalizeAcademicCode(degreeProgramId);
      if (!nextDegreeProgramId) {
        setEditIntakeOptions([]);
        return;
      }

      setIsLoadingEditIntakes(true);
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
        const options = parseIntakes(payload).map((item) => ({
          id: item.id,
          name: item.name,
          currentTerm: item.currentTerm,
        }));

        if (
          currentEnrollment &&
          !options.some((option) => option.id === currentEnrollment.intakeId)
        ) {
          options.unshift({
            id: currentEnrollment.intakeId,
            name: currentEnrollment.intakeName || currentEnrollment.intakeId,
            currentTerm: currentEnrollment.currentTerm,
          });
        }

        setEditIntakeOptions(options);
      } catch {
        if (currentEnrollment) {
          setEditIntakeOptions([
            {
              id: currentEnrollment.intakeId,
              name: currentEnrollment.intakeName || currentEnrollment.intakeId,
              currentTerm: currentEnrollment.currentTerm,
            },
          ]);
        } else {
          setEditIntakeOptions([]);
        }
      } finally {
        setIsLoadingEditIntakes(false);
      }
    },
    []
  );

  const loadEditIntakeTerm = useCallback(async (intakeId: string) => {
    const nextIntakeId = String(intakeId ?? "").trim();
    if (!nextIntakeId) {
      setSelectedEditIntakeTerm("");
      return;
    }

    const requestId = editTermRequestIdRef.current + 1;
    editTermRequestIdRef.current = requestId;
    setIsLoadingEditTerm(true);

    try {
      const response = await fetch(`/api/intakes/${encodeURIComponent(nextIntakeId)}`, {
        cache: "no-store",
      });
      const payload = await readJson<unknown>(response);
      const root = asObject(payload);
      const currentTerm = collapseSpaces(root?.currentTerm);

      if (editTermRequestIdRef.current !== requestId) {
        return;
      }

      setSelectedEditIntakeTerm(currentTerm);
    } catch {
      if (editTermRequestIdRef.current !== requestId) {
        return;
      }

      const fallback =
        editIntakeOptions.find((item) => item.id === nextIntakeId)?.currentTerm ?? "";
      setSelectedEditIntakeTerm(fallback);
    } finally {
      if (editTermRequestIdRef.current === requestId) {
        setIsLoadingEditTerm(false);
      }
    }
  }, [editIntakeOptions]);

  const loadEditSubgroups = useCallback(
    async (input: {
      intakeId: string;
      facultyId?: string;
      degreeProgramId?: string;
      stream?: StudentStream;
    }) => {
      const intakeId = String(input.intakeId ?? "").trim();
      if (!intakeId) {
        setEditSubgroupOptions([]);
        return;
      }

      const requestId = editSubgroupRequestIdRef.current + 1;
      editSubgroupRequestIdRef.current = requestId;
      setIsLoadingEditSubgroups(true);

      try {
        const params = new URLSearchParams();
        const facultyId = normalizeAcademicCode(input.facultyId);
        const degreeProgramId = normalizeAcademicCode(input.degreeProgramId);
        if (facultyId) {
          params.set("facultyId", facultyId);
        }
        if (degreeProgramId) {
          params.set("degreeProgramId", degreeProgramId);
        }
        if (input.stream === "WEEKDAY" || input.stream === "WEEKEND") {
          params.set("stream", input.stream);
        }

        const response = await fetch(
          `/api/intakes/${encodeURIComponent(intakeId)}/subgroups?${params.toString()}`,
          { cache: "no-store" }
        );
        const payload = await readJson<unknown>(response);
        if (editSubgroupRequestIdRef.current !== requestId) {
          return;
        }

        const nextOptions = parseSubgroups(payload);
        setEditSubgroupOptions(nextOptions);
        setEditForm((previous) => {
          if (previous.intakeId !== intakeId) {
            return previous;
          }

          const subgroup = collapseSpaces(previous.subgroup);
          if (!subgroup || nextOptions.some((item) => item.code === subgroup)) {
            return previous;
          }

          return {
            ...previous,
            subgroup: "",
          };
        });
      } catch {
        if (editSubgroupRequestIdRef.current !== requestId) {
          return;
        }

        setEditSubgroupOptions([]);
      } finally {
        if (editSubgroupRequestIdRef.current === requestId) {
          setIsLoadingEditSubgroups(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    setActiveWindow("Profile");
    void loadStudent();
    void loadEnrollments();
    void loadFaculties();

    return () => {
      setActiveWindow(null);
    };
  }, [loadFaculties, loadEnrollments, loadStudent, setActiveWindow]);

  useEffect(() => {
    if (!isModalOpen && !editTarget && !deleteTarget) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [deleteTarget, editTarget, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen || !form.intakeId) {
      setSubgroupOptions([]);
      return;
    }

    void loadSubgroups({
      intakeId: form.intakeId,
      facultyId: form.facultyId,
      degreeProgramId: form.degreeProgramId,
      stream: form.stream,
    });
  }, [
    form.degreeProgramId,
    form.facultyId,
    form.intakeId,
    form.stream,
    isModalOpen,
    loadSubgroups,
  ]);

  useEffect(() => {
    if (!editTarget || !editForm.intakeId) {
      setEditSubgroupOptions([]);
      return;
    }

    void loadEditSubgroups({
      intakeId: editForm.intakeId,
      facultyId: editForm.facultyId,
      degreeProgramId: editForm.degreeProgramId,
      stream: editForm.stream,
    });
  }, [
    editForm.degreeProgramId,
    editForm.facultyId,
    editForm.intakeId,
    editForm.stream,
    editTarget,
    loadEditSubgroups,
  ]);

  const selectedFacultyDegrees = useMemo(
    () => degrees.filter((item) => !form.facultyId || item.facultyCode === form.facultyId),
    [degrees, form.facultyId]
  );

  const openEnrollmentModal = () => {
    setForm(emptyEnrollmentForm());
    setDegrees([]);
    setIntakes([]);
    setSubgroupOptions([]);
    setIsLoadingSubgroups(false);
    setSelectedIntakeTerm("");
    setFormError("");
    setIsModalOpen(true);
  };

  const closeEnrollmentModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setFormError("");
  };

  const openEditEnrollmentModal = (enrollment: EnrollmentRecord) => {
    setEditTarget(enrollment);
    setEditForm({
      facultyId: enrollment.facultyId,
      facultyName: enrollment.facultyName,
      degreeProgramId: enrollment.degreeProgramId,
      degreeProgramName: enrollment.degreeProgramName,
      intakeId: enrollment.intakeId,
      stream: enrollment.stream,
      subgroup: enrollment.subgroup,
      status: enrollment.status,
    });
    setEditFormError("");
    setSelectedEditIntakeTerm(enrollment.currentTerm);
    setEditSubgroupOptions([]);
    setIsLoadingEditSubgroups(false);
    void loadEditIntakes(enrollment.facultyId, enrollment.degreeProgramId, enrollment);
    void loadEditIntakeTerm(enrollment.intakeId);
  };

  const closeEditEnrollmentModal = () => {
    if (isUpdatingEnrollment) {
      return;
    }

    setEditTarget(null);
    setEditForm({
      facultyId: "",
      facultyName: "",
      degreeProgramId: "",
      degreeProgramName: "",
      intakeId: "",
      stream: "WEEKDAY",
      subgroup: "",
      status: "ACTIVE",
    });
    setEditFormError("");
    setSelectedEditIntakeTerm("");
    setEditIntakeOptions([]);
    setEditSubgroupOptions([]);
    setIsLoadingEditSubgroups(false);
  };

  const saveEnrollment = async () => {
    if (!studentRecordId) {
      return;
    }

    if (!form.facultyId || !form.degreeProgramId || !form.intakeId || !form.stream) {
      setFormError("Faculty, degree, intake, and stream are required");
      return;
    }
    const subgroup = collapseSpaces(form.subgroup);
    if (subgroup && !subgroupOptions.some((item) => item.code === subgroup)) {
      setFormError("Select subgroup from the list");
      return;
    }

    setIsSaving(true);
    try {
      await readJson<unknown>(
        await fetch(`/api/students/${encodeURIComponent(studentRecordId)}/enrollments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facultyId: form.facultyId,
            degreeProgramId: form.degreeProgramId,
            intakeId: form.intakeId,
            stream: form.stream,
            subgroup: collapseSpaces(form.subgroup) || null,
            status: form.status,
          }),
        })
      );

      toast({
        title: "Saved",
        message: "Enrollment added",
        variant: "success",
      });

      closeEnrollmentModal();
      await loadEnrollments();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to add enrollment";
      const friendlyMessage = message.toLowerCase().includes("already enrolled")
        ? "Student already enrolled in this intake"
        : message;
      setFormError(friendlyMessage);
      toast({ title: "Failed", message: friendlyMessage, variant: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const saveEditedEnrollment = async () => {
    if (!editTarget) {
      return;
    }

    if (!editForm.intakeId || !editForm.stream) {
      setEditFormError("Intake and stream are required");
      return;
    }
    const subgroup = collapseSpaces(editForm.subgroup);
    if (subgroup && !editSubgroupOptions.some((item) => item.code === subgroup)) {
      setEditFormError("Select subgroup from the list");
      return;
    }

    setIsUpdatingEnrollment(true);
    try {
      await readJson<unknown>(
        await fetch(`/api/enrollments/${encodeURIComponent(editTarget.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intakeId: editForm.intakeId,
            stream: editForm.stream,
            subgroup: collapseSpaces(editForm.subgroup) || null,
            status: editForm.status,
          }),
        })
      );

      toast({
        title: "Saved",
        message: "Enrollment updated",
        variant: "success",
      });
      closeEditEnrollmentModal();
      await loadEnrollments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update enrollment";
      const friendlyMessage = message.toLowerCase().includes("already enrolled")
        ? "Student already enrolled in this intake"
        : message;
      setEditFormError(friendlyMessage);
      toast({
        title: "Failed",
        message: friendlyMessage,
        variant: "error",
      });
    } finally {
      setIsUpdatingEnrollment(false);
    }
  };

  const confirmDeleteEnrollment = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeletingEnrollment(true);
    try {
      await readJson<unknown>(
        await fetch(`/api/enrollments/${encodeURIComponent(deleteTarget.id)}`, {
          method: "DELETE",
        })
      );
      toast({
        title: "Deleted",
        message: "Enrollment deleted",
        variant: "success",
      });
      setDeleteTarget(null);
      await loadEnrollments();
    } catch (error) {
      toast({
        title: "Failed",
        message:
          error instanceof Error ? error.message : "Failed to delete enrollment",
        variant: "error",
      });
    } finally {
      setIsDeletingEnrollment(false);
    }
  };

  const contentBlurClass =
    isModalOpen || Boolean(editTarget) || Boolean(deleteTarget)
      ? "pointer-events-none opacity-45 blur-[1px]"
      : "";
  const activeEnrollmentCount = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status === "ACTIVE").length,
    [enrollments]
  );
  const latestEnrollmentUpdate = useMemo(
    () =>
      enrollments.reduce<string | null>((latest, enrollment) => {
        if (!enrollment.updatedAt) return latest;
        if (!latest || enrollment.updatedAt.localeCompare(latest) > 0) {
          return enrollment.updatedAt;
        }
        return latest;
      }, null),
    [enrollments]
  );
  const latestVisibleUpdate =
    student?.updatedAt && latestEnrollmentUpdate
      ? student.updatedAt.localeCompare(latestEnrollmentUpdate) > 0
        ? student.updatedAt
        : latestEnrollmentUpdate
      : student?.updatedAt ?? latestEnrollmentUpdate ?? null;
  const studentName = student ? `${student.firstName} ${student.lastName}` : "Student Profile";

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <div className="flex justify-end">
        <Link
          className="inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-medium text-heading transition-colors hover:bg-slate-50"
          href="/admin/users/students"
        >
          <ArrowLeft size={16} /> Back
        </Link>
      </div>

      {isLoading ? (
        <Card className={contentBlurClass}>
          <p className="py-10 text-center text-text/65">Loading profile...</p>
        </Card>
      ) : error ? (
        <Card className={contentBlurClass}>
          <p className="py-10 text-center text-red-700">{error}</p>
        </Card>
      ) : student ? (
        <>
          <section
            className={cn(
              "grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]",
              contentBlurClass
            )}
          >
            <Card accent className="p-6 lg:p-7">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <Badge variant="neutral">User Management</Badge>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                      {studentName}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                      Student profile overview with identity, academic enrollment coverage, and
                      current status in the updated admin directory surface.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:items-end">
                    <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[190px]">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                        Student ID
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                        {student.studentId}
                      </p>
                      <p className="mt-1 text-sm text-text/60">Profile details loaded for this user</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-[24px] border border-border bg-white/78 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                      Email
                    </p>
                    <p className="mt-2 text-sm text-text/78">{student.email}</p>
                  </div>
                  <div className="rounded-[24px] border border-border bg-white/78 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                      Phone
                    </p>
                    <p className="mt-2 text-sm text-text/78">{student.phone || "-"}</p>
                  </div>
                  <div className="rounded-[24px] border border-border bg-white/78 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                      Status
                    </p>
                    <div className="mt-2">
                      <Badge variant={statusVariant(student.status)}>{student.status}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-text/60">
                      Updated {formatDate(student.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminSummaryCard
                detail="Profile identity loaded for the selected student record."
                icon={GraduationCap}
                label="Student Status"
                tone="sky"
                value={student.status}
              />
              <AdminSummaryCard
                detail={`${activeEnrollmentCount.toLocaleString()} active enrollments currently enabled`}
                icon={CheckCircle2}
                label="Active Enrollments"
                tone="green"
                value={activeEnrollmentCount.toLocaleString()}
              />
              <AdminSummaryCard
                detail={`${enrollments.length.toLocaleString()} program enrollments linked to this profile`}
                icon={Users2}
                label="Total Enrollments"
                tone="violet"
                value={enrollments.length.toLocaleString()}
              />
              <AdminSummaryCard
                detail={
                  latestVisibleUpdate
                    ? "Most recent visible profile or enrollment change"
                    : "No recent student updates available"
                }
                icon={Clock3}
                label="Latest Update"
                tone="amber"
                value={formatShortDate(latestVisibleUpdate)}
              />
            </div>
          </section>

          <Card className={cn("overflow-hidden p-0", contentBlurClass)}>
            <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-heading">Enrollment Records</p>
                <p className="mt-1 text-sm text-text/68">
                  Review every linked faculty, program, intake, stream, subgroup, and status from a
                  cleaner table surface.
                </p>
              </div>
              <Button className="h-11 gap-2 px-5" onClick={openEnrollmentModal}>
                <Plus size={16} /> Add Enrollment
              </Button>
            </div>

            <div className="px-4 py-4 sm:px-6 sm:py-6">
              <div className="overflow-hidden rounded-[28px] border border-border bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] text-left text-sm">
                    <thead className="bg-[rgba(255,255,255,0.82)]">
                      <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                        <th className="px-5 py-4">Faculty</th>
                        <th className="px-5 py-4">Degree</th>
                        <th className="px-5 py-4">Intake</th>
                        <th className="px-5 py-4">Semester</th>
                        <th className="px-5 py-4">Stream</th>
                        <th className="px-5 py-4">Subgroup</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Updated</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {isLoadingEnrollments ? (
                        <tr>
                          <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={9}>
                            Loading enrollments...
                          </td>
                        </tr>
                      ) : enrollmentsError ? (
                        <tr>
                          <td className="px-5 py-8" colSpan={9}>
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                              <p className="text-sm font-medium text-red-700">
                                Failed to load enrollments
                              </p>
                              <Button
                                className="h-10 min-w-[96px] border-red-300 bg-white px-4 text-red-700 hover:bg-red-100"
                                onClick={() => {
                                  void loadEnrollments();
                                }}
                                variant="secondary"
                              >
                                Retry
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ) : enrollments.length > 0 ? (
                        enrollments.map((enrollment) => (
                          <tr className="transition-colors duration-200 hover:bg-white/70" key={enrollment.id}>
                            <td className="px-5 py-4">{enrollment.facultyId}</td>
                            <td className="px-5 py-4">{enrollment.degreeProgramId}</td>
                            <td className="px-5 py-4">{enrollment.intakeName || enrollment.intakeId}</td>
                            <td className="px-5 py-4">{enrollment.currentTerm || "-"}</td>
                            <td className="px-5 py-4">{enrollment.stream}</td>
                            <td className="px-5 py-4">{enrollment.subgroup || "-"}</td>
                            <td className="px-5 py-4">
                              <Badge variant={statusVariant(enrollment.status)}>
                                {enrollment.status}
                              </Badge>
                            </td>
                            <td className="px-5 py-4">{formatDate(enrollment.updatedAt)}</td>
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  aria-label="Edit enrollment"
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-heading hover:shadow-shadow"
                                  onClick={() => openEditEnrollmentModal(enrollment)}
                                  type="button"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  aria-label="Delete enrollment"
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-red-200 hover:bg-white hover:text-red-600 hover:shadow-shadow"
                                  onClick={() => setDeleteTarget(enrollment)}
                                  type="button"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={9}>
                            No enrollments added yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : null}

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              closeEnrollmentModal();
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
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">Create</p>
                  <p className="mt-1 text-2xl font-semibold text-heading">Add Enrollment</p>
                </div>
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading"
                  disabled={isSaving}
                  onClick={closeEnrollmentModal}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                        subgroup: "",
                      }));
                      setSelectedIntakeTerm("");
                      setIntakes([]);
                      setSubgroupOptions([]);
                      setIsLoadingSubgroups(false);
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
                        subgroup: "",
                      }));
                      setSelectedIntakeTerm("");
                      setSubgroupOptions([]);
                      setIsLoadingSubgroups(false);
                      void loadIntakes(form.facultyId, degreeProgramId);
                    }}
                    value={form.degreeProgramId}
                  >
                    <option value="">{isLoadingDegrees ? "Loading..." : "Select Degree"}</option>
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
                        subgroup: "",
                      }));
                      setSubgroupOptions([]);
                      void loadIntakeTerm(intakeId);
                    }}
                    value={form.intakeId}
                  >
                    <option value="">{isLoadingIntakes ? "Loading..." : "Select Intake"}</option>
                    {intakes.map((intake) => (
                      <option key={intake.id} value={intake.id}>
                        {intake.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Current Semester</label>
                  <Input
                    className="h-12"
                    disabled
                    value={!form.intakeId ? "Select an intake" : isLoadingTerm ? "Loading..." : selectedIntakeTerm || "-"}
                  />
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
                        subgroup: "",
                      }))
                    }
                    value={form.stream}
                  >
                    <option value="WEEKDAY">WEEKDAY</option>
                    <option value="WEEKEND">WEEKEND</option>
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">Subgroup</label>
                  <Select
                    className="h-12"
                    disabled={isSaving || !form.intakeId}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        subgroup: String(event.target.value ?? "").trim(),
                      }))
                    }
                    value={collapseSpaces(form.subgroup)}
                  >
                    <option value="">
                      {isLoadingSubgroups
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
                  disabled={isSaving}
                  onClick={closeEnrollmentModal}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 min-w-[132px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
                  disabled={isSaving}
                  onClick={() => {
                    void saveEnrollment();
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

      <EditEnrollmentModal
        form={editForm}
        formError={editFormError}
        intakeOptions={editIntakeOptions}
        loadingIntakes={isLoadingEditIntakes}
        loadingSubgroups={isLoadingEditSubgroups}
        loadingTerm={isLoadingEditTerm}
        subgroupOptions={editSubgroupOptions}
        onChange={(patch) =>
          setEditForm((previous) => ({
            ...previous,
            ...patch,
          }))
        }
        onClose={closeEditEnrollmentModal}
        onIntakeChange={(intakeId) => {
          void loadEditIntakeTerm(intakeId);
        }}
        onSave={() => {
          void saveEditedEnrollment();
        }}
        open={Boolean(editTarget)}
        saving={isUpdatingEnrollment}
        selectedIntakeTerm={selectedEditIntakeTerm}
      />

      <ConfirmDeleteEnrollmentModal
        deleting={isDeletingEnrollment}
        onClose={() => {
          if (isDeletingEnrollment) {
            return;
          }

          setDeleteTarget(null);
        }}
        onConfirm={() => {
          void confirmDeleteEnrollment();
        }}
        open={Boolean(deleteTarget)}
        target={
          deleteTarget
            ? {
                facultyId: deleteTarget.facultyId,
                degreeProgramId: deleteTarget.degreeProgramId,
                intakeId: deleteTarget.intakeId,
                intakeName: deleteTarget.intakeName,
              }
            : null
        }
      />
    </div>
  );
}
