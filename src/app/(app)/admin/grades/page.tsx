"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import PageHeader from "@/components/admin/PageHeader";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { readStoredUser } from "@/lib/rbac";

type EntryView = "entry" | "all";
type PageSize = 10 | 25 | 50 | 100;
type GradeStatus = "pass" | "fail" | "pro-rata" | "repeat";
type GradeLetter =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D+"
  | "D"
  | "F";

interface ModuleOfferingOption {
  id: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  intakeId: string;
  termCode: string;
  status: string;
}

interface EnrollmentStudentRow {
  id: string;
  studentRecordId: string;
  registrationNumber: string;
  studentName: string;
  studentEmail: string;
}

interface GradeRecord {
  id: string;
  studentRecordId: string;
  registrationNumber: string;
  studentName: string;
  moduleOfferingId: string;
  moduleCode: string;
  moduleName: string;
  caMarks: number;
  finalExamMarks: number;
  totalMarks: number;
  gradeLetter: GradeLetter;
  status: GradeStatus;
  academicYear: string;
  semester: 1 | 2;
  gradedByName: string;
  gradedAt: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

interface EntryGradeRow {
  studentId: string;
  registrationNumber: string;
  studentName: string;
  studentEmail: string;
  caMarksInput: string;
  finalExamMarksInput: string;
  remarks: string;
  existingGradeId: string | null;
}

interface ParsedMark {
  empty: boolean;
  invalid: boolean;
  value: number | null;
}

interface GradePreview {
  complete: boolean;
  totalMarks: number | null;
  gradeLetter: GradeLetter | null;
  status: GradeStatus | null;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function defaultAcademicYear(date = new Date()) {
  const month = date.getMonth();
  const year = date.getFullYear();
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

function formatDate(value: string) {
  if (!value) {
    return "Not graded";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not graded";
  }

  return parsed.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  if (!value) {
    return "Not graded";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not graded";
  }

  return parsed.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function semesterFromTermCode(termCode: string): 1 | 2 {
  return termCode.trim().toUpperCase().endsWith("2") ? 2 : 1;
}

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseMarkValue(value: string): ParsedMark {
  const normalized = value.trim();
  if (!normalized) {
    return {
      empty: true,
      invalid: false,
      value: null,
    };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return {
      empty: false,
      invalid: true,
      value: null,
    };
  }

  return {
    empty: false,
    invalid: false,
    value: roundToTwo(parsed),
  };
}

function isMarkInvalid(value: string) {
  return parseMarkValue(value).invalid;
}

function determineGradeLetter(totalMarks: number): GradeLetter {
  if (totalMarks >= 90) return "A+";
  if (totalMarks >= 85) return "A";
  if (totalMarks >= 80) return "A-";
  if (totalMarks >= 75) return "B+";
  if (totalMarks >= 70) return "B";
  if (totalMarks >= 65) return "B-";
  if (totalMarks >= 60) return "C+";
  if (totalMarks >= 55) return "C";
  if (totalMarks >= 50) return "C-";
  if (totalMarks >= 45) return "D+";
  if (totalMarks >= 40) return "D";
  return "F";
}

function determineStatus(
  caMarks: number,
  finalExamMarks: number,
  gradeLetter: GradeLetter
): GradeStatus {
  if (caMarks < 45 && finalExamMarks < 45) {
    return "pro-rata";
  }

  if (caMarks >= 45 && finalExamMarks < 45) {
    return "repeat";
  }

  if (caMarks >= 45 && finalExamMarks >= 45 && gradeLetter !== "F") {
    return "pass";
  }

  return "fail";
}

function buildPreview(caMarksInput: string, finalExamMarksInput: string): GradePreview {
  const caMarks = parseMarkValue(caMarksInput);
  const finalExamMarks = parseMarkValue(finalExamMarksInput);

  if (
    caMarks.invalid ||
    finalExamMarks.invalid ||
    caMarks.empty ||
    finalExamMarks.empty ||
    caMarks.value === null ||
    finalExamMarks.value === null
  ) {
    return {
      complete: false,
      totalMarks: null,
      gradeLetter: null,
      status: null,
    };
  }

  const totalMarks = roundToTwo(caMarks.value * 0.4 + finalExamMarks.value * 0.6);
  const gradeLetter = determineGradeLetter(totalMarks);
  const status = determineStatus(caMarks.value, finalExamMarks.value, gradeLetter);

  return {
    complete: true,
    totalMarks,
    gradeLetter,
    status,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as unknown;
  const body = asObject(payload);

  if (!response.ok) {
    const message =
      collapseSpaces(body?.error ?? body?.message) || "Request failed";
    throw new Error(message);
  }

  if (body && body.success === false) {
    throw new Error(collapseSpaces(body.error) || "Request failed");
  }

  if (body && Object.prototype.hasOwnProperty.call(body, "data")) {
    return body.data as T;
  }

  return payload as T;
}

function parseModuleOfferings(payload: unknown) {
  const body = asObject(payload);
  const rows = Array.isArray(body?.items) ? body.items : [];

  return rows
    .map((row) => {
      const item = asObject(row);
      const id = String(item?._id ?? item?.id ?? "").trim();
      if (!id) {
        return null;
      }

      return {
        id,
        moduleId: collapseSpaces(item?.moduleId),
        moduleCode: collapseSpaces(item?.moduleCode),
        moduleName: collapseSpaces(item?.moduleName),
        intakeId: collapseSpaces(item?.intakeId),
        termCode: collapseSpaces(item?.termCode).toUpperCase(),
        status: collapseSpaces(item?.status).toUpperCase(),
      } satisfies ModuleOfferingOption;
    })
    .filter((row): row is ModuleOfferingOption => Boolean(row))
    .sort((left, right) => offeringLabel(left).localeCompare(offeringLabel(right)));
}

function parseEnrollmentRows(payload: unknown) {
  const body = asObject(payload);
  const rows = Array.isArray(body?.items) ? body.items : [];

  return rows
    .map((row) => {
      const item = asObject(row);
      const student = asObject(item?.student);
      const studentRecordId = String(student?._id ?? student?.id ?? "").trim();
      const registrationNumber = collapseSpaces(
        student?.registrationNumber ?? student?.studentId
      ).toUpperCase();
      const studentName =
        collapseSpaces(student?.fullName) ||
        collapseSpaces(`${collapseSpaces(student?.firstName)} ${collapseSpaces(student?.lastName)}`);

      if (!studentRecordId || !registrationNumber || !studentName) {
        return null;
      }

      return {
        id: String(item?._id ?? item?.id ?? "").trim() || studentRecordId,
        studentRecordId,
        registrationNumber,
        studentName,
        studentEmail: collapseSpaces(student?.email).toLowerCase(),
      } satisfies EnrollmentStudentRow;
    })
    .filter((row): row is EnrollmentStudentRow => Boolean(row))
    .sort((left, right) => left.registrationNumber.localeCompare(right.registrationNumber));
}

function parseGradeRecord(row: unknown): GradeRecord | null {
  const item = asObject(row);
  if (!item) {
    return null;
  }

  const id = String(item._id ?? item.id ?? "").trim();
  const student = asObject(item.studentId);
  const offering = asObject(item.moduleOfferingId);
  const gradedBy = asObject(item.gradedBy);
  const studentRecordId = String(student?._id ?? student?.id ?? "").trim();
  const moduleOfferingId = String(offering?._id ?? offering?.id ?? "").trim();
  const registrationNumber = collapseSpaces(
    student?.registrationNumber ?? student?.studentId
  ).toUpperCase();
  const studentName =
    collapseSpaces(student?.fullName) ||
    collapseSpaces(`${collapseSpaces(student?.firstName)} ${collapseSpaces(student?.lastName)}`);
  const rawStatus = collapseSpaces(item.status) as GradeStatus;
  const rawGradeLetter = collapseSpaces(item.gradeLetter) as GradeLetter;
  const semester = Number(item.semester);

  if (
    !id ||
    !studentRecordId ||
    !moduleOfferingId ||
    !registrationNumber ||
    !studentName ||
    !(semester === 1 || semester === 2)
  ) {
    return null;
  }

  return {
    id,
    studentRecordId,
    registrationNumber,
    studentName,
    moduleOfferingId,
    moduleCode: collapseSpaces(offering?.moduleCode).toUpperCase(),
    moduleName: collapseSpaces(offering?.moduleName),
    caMarks: Number(item.caMarks ?? 0),
    finalExamMarks: Number(item.finalExamMarks ?? 0),
    totalMarks: Number(item.totalMarks ?? 0),
    gradeLetter: rawGradeLetter || "F",
    status: rawStatus || "fail",
    academicYear: collapseSpaces(item.academicYear),
    semester: semester as 1 | 2,
    gradedByName: collapseSpaces(gradedBy?.name ?? gradedBy?.username),
    gradedAt: collapseSpaces(item.gradedAt),
    remarks: collapseSpaces(item.remarks),
    createdAt: collapseSpaces(item.createdAt),
    updatedAt: collapseSpaces(item.updatedAt),
  };
}

function parseGradeRows(payload: unknown) {
  const rows = Array.isArray(payload) ? payload : [];
  return rows
    .map((row) => parseGradeRecord(row))
    .filter((row): row is GradeRecord => Boolean(row));
}

function offeringLabel(offering: ModuleOfferingOption) {
  const semester = semesterFromTermCode(offering.termCode);
  return `${offering.moduleCode} - ${offering.moduleName} (${offering.termCode}, Semester ${semester})`;
}

function statusClasses(status: GradeStatus) {
  if (status === "pass") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "fail") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "pro-rata") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-yellow-200 bg-yellow-50 text-yellow-700";
}

function statusLabel(status: GradeStatus) {
  if (status === "pro-rata") {
    return "Pro-Rata";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusBadge({ status }: { status: GradeStatus }) {
  return <Badge className={statusClasses(status)}>{statusLabel(status)}</Badge>;
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border px-4 py-3",
        tone === "success" && "border-emerald-200 bg-emerald-50/70",
        tone === "danger" && "border-rose-200 bg-rose-50/70",
        tone === "warning" && "border-amber-200 bg-amber-50/70",
        tone === "default" && "border-border bg-tint"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-heading">{value}</p>
    </div>
  );
}

function ConfirmDialog({
  confirmLabel,
  isBusy,
  message,
  onClose,
  onConfirm,
  open,
  title,
  tone = "danger",
}: {
  confirmLabel: string;
  isBusy?: boolean;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  tone?: "danger" | "primary";
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-[28px] border border-border bg-card p-6 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <AlertTriangle size={20} />
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-heading">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-text/70">{message}</p>
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-2xl p-2 text-text/55 transition-colors hover:bg-tint hover:text-heading"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button disabled={isBusy} onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            className={cn(
              tone === "danger" && "bg-rose-600 hover:bg-rose-700",
              tone === "primary" && "bg-[#034aa6] hover:bg-[#0339a6]"
            )}
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy ? <Loader2 className="mr-2 animate-spin" size={16} /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function GradesAdminPage() {
  const { setActiveWindow } = useAdminContext();
  const { toast } = useToast();
  const currentUser = useMemo(() => readStoredUser(), []);

  const [activeView, setActiveView] = useState<EntryView>("entry");

  const [moduleOfferings, setModuleOfferings] = useState<ModuleOfferingOption[]>([]);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
  const [offeringsError, setOfferingsError] = useState("");

  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [entryAcademicYear, setEntryAcademicYear] = useState(defaultAcademicYear);
  const [entrySemester, setEntrySemester] = useState<"" | "1" | "2">("");
  const [entryRows, setEntryRows] = useState<EntryGradeRow[]>([]);
  const [isLoadingEntryRows, setIsLoadingEntryRows] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const [allGrades, setAllGrades] = useState<GradeRecord[]>([]);
  const [isLoadingAllGrades, setIsLoadingAllGrades] = useState(false);
  const [allGradesError, setAllGradesError] = useState("");
  const [allGradesSearch, setAllGradesSearch] = useState("");
  const deferredAllGradesSearch = useDeferredValue(allGradesSearch);
  const [allGradesModuleFilter, setAllGradesModuleFilter] = useState("");
  const [allGradesAcademicYear, setAllGradesAcademicYear] = useState("");
  const [allGradesSemester, setAllGradesSemester] = useState("");
  const [allGradesStatus, setAllGradesStatus] = useState<"" | GradeStatus>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  const [editTarget, setEditTarget] = useState<GradeRecord | null>(null);
  const [editCaMarks, setEditCaMarks] = useState("");
  const [editFinalExamMarks, setEditFinalExamMarks] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<GradeRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedOffering = useMemo(
    () => moduleOfferings.find((item) => item.id === selectedOfferingId) ?? null,
    [moduleOfferings, selectedOfferingId]
  );

  const entryRowsWithPreview = useMemo(
    () =>
      entryRows.map((row) => {
        const caState = parseMarkValue(row.caMarksInput);
        const finalState = parseMarkValue(row.finalExamMarksInput);
        const preview = buildPreview(row.caMarksInput, row.finalExamMarksInput);

        return {
          row,
          caState,
          finalState,
          preview,
        };
      }),
    [entryRows]
  );

  const entryStats = useMemo(() => {
    const totalStudents = entryRowsWithPreview.length;
    let graded = 0;
    let pass = 0;
    let fail = 0;
    let proRata = 0;
    let repeat = 0;
    let classAverageTotal = 0;

    entryRowsWithPreview.forEach(({ preview }) => {
      if (!preview.complete || preview.totalMarks === null || !preview.status) {
        return;
      }

      graded += 1;
      classAverageTotal += preview.totalMarks;

      if (preview.status === "pass") pass += 1;
      if (preview.status === "fail") fail += 1;
      if (preview.status === "pro-rata") proRata += 1;
      if (preview.status === "repeat") repeat += 1;
    });

    return {
      totalStudents,
      graded,
      notYetGraded: Math.max(0, totalStudents - graded),
      pass,
      fail,
      proRata,
      repeat,
      classAverage: graded > 0 ? roundToTwo(classAverageTotal / graded) : null,
    };
  }, [entryRowsWithPreview]);

  const invalidEntryCount = useMemo(
    () =>
      entryRowsWithPreview.filter(({ caState, finalState }) => caState.invalid || finalState.invalid)
        .length,
    [entryRowsWithPreview]
  );

  const savableEntryRows = useMemo(
    () =>
      entryRowsWithPreview
        .filter(
          ({ caState, finalState }) =>
            !caState.invalid &&
            !finalState.invalid &&
            !caState.empty &&
            !finalState.empty &&
            caState.value !== null &&
            finalState.value !== null
        )
        .map(({ row, caState, finalState }) => ({
          studentId: row.studentId,
          caMarks: caState.value as number,
          finalExamMarks: finalState.value as number,
          remarks: row.remarks,
        })),
    [entryRowsWithPreview]
  );

  const editPreview = useMemo(
    () => buildPreview(editCaMarks, editFinalExamMarks),
    [editCaMarks, editFinalExamMarks]
  );
  const editCaState = useMemo(() => parseMarkValue(editCaMarks), [editCaMarks]);
  const editFinalState = useMemo(
    () => parseMarkValue(editFinalExamMarks),
    [editFinalExamMarks]
  );

  const isOverlayOpen = Boolean(editTarget || deleteTarget || clearConfirmOpen);

  const filteredAllGrades = useMemo(() => {
    const search = collapseSpaces(deferredAllGradesSearch).toLowerCase();
    if (!search) {
      return allGrades;
    }

    return allGrades.filter((grade) =>
      `${grade.registrationNumber} ${grade.studentName} ${grade.moduleCode} ${grade.moduleName}`
        .toLowerCase()
        .includes(search)
    );
  }, [allGrades, deferredAllGradesSearch]);

  const pageCount = Math.max(1, Math.ceil(filteredAllGrades.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginatedGrades = filteredAllGrades.slice(
    (safePage - 1) * pageSize,
    (safePage - 1) * pageSize + pageSize
  );

  const loadModuleOfferings = useCallback(async () => {
    setIsLoadingOfferings(true);
    setOfferingsError("");

    try {
      let page = 1;
      let total = 0;
      const collected: ModuleOfferingOption[] = [];

      while (page === 1 || collected.length < total) {
        const response = await fetch(
          `/api/module-offerings?page=${page}&pageSize=100&sort=module`,
          {
            cache: "no-store",
          }
        );
        const payload = await readJson<unknown>(response);
        const payloadObject = asObject(payload);
        const batch = parseModuleOfferings(payload);

        collected.push(...batch);

        const parsedTotal = Number(payloadObject?.total ?? collected.length);
        total =
          Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : collected.length;

        if (batch.length === 0 || collected.length >= total) {
          break;
        }

        page += 1;
      }

      setModuleOfferings(
        Array.from(new Map(collected.map((item) => [item.id, item])).values()).sort((left, right) =>
          offeringLabel(left).localeCompare(offeringLabel(right))
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load module offerings";
      setOfferingsError(message);
      toast({
        title: "Failed to load module offerings",
        message,
        variant: "error",
      });
    } finally {
      setIsLoadingOfferings(false);
    }
  }, [toast]);

  const loadEntryRows = useCallback(
    async (offeringId: string) => {
      if (!offeringId) {
        setEntryRows([]);
        setEntryError("");
        return;
      }

      setIsLoadingEntryRows(true);
      setEntryError("");

      try {
        const [enrollmentResponse, gradeResponse] = await Promise.all([
          fetch(`/api/enrollments?moduleOfferingId=${encodeURIComponent(offeringId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/grades?moduleOfferingId=${encodeURIComponent(offeringId)}`, {
            cache: "no-store",
          }),
        ]);

        const [enrollmentPayload, gradePayload] = await Promise.all([
          readJson<unknown>(enrollmentResponse),
          readJson<unknown>(gradeResponse),
        ]);

        const enrollments = parseEnrollmentRows(enrollmentPayload);
        const grades = parseGradeRows(gradePayload);
        const gradesByStudentId = new Map(grades.map((grade) => [grade.studentRecordId, grade]));

        setEntryRows(
          enrollments.map((student) => {
            const existingGrade = gradesByStudentId.get(student.studentRecordId);

            return {
              studentId: student.studentRecordId,
              registrationNumber: student.registrationNumber,
              studentName: student.studentName,
              studentEmail: student.studentEmail,
              caMarksInput:
                existingGrade && Number.isFinite(existingGrade.caMarks)
                  ? String(existingGrade.caMarks)
                  : "",
              finalExamMarksInput:
                existingGrade && Number.isFinite(existingGrade.finalExamMarks)
                  ? String(existingGrade.finalExamMarks)
                  : "",
              remarks: existingGrade?.remarks ?? "",
              existingGradeId: existingGrade?.id ?? null,
            } satisfies EntryGradeRow;
          })
        );

        const firstGrade = grades[0] ?? null;
        setEntryAcademicYear(firstGrade?.academicYear || defaultAcademicYear());
        setEntrySemester(
          String(firstGrade?.semester ?? semesterFromTermCode(selectedOffering?.termCode ?? "Y1S1")) as
            | ""
            | "1"
            | "2"
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load enrollment grades";
        setEntryRows([]);
        setEntryError(message);
        toast({
          title: "Failed to load grade entry data",
          message,
          variant: "error",
        });
      } finally {
        setIsLoadingEntryRows(false);
      }
    },
    [selectedOffering?.termCode, toast]
  );

  const loadAllGrades = useCallback(async () => {
    setIsLoadingAllGrades(true);
    setAllGradesError("");

    try {
      const params = new URLSearchParams();
      if (allGradesModuleFilter) {
        params.set("moduleOfferingId", allGradesModuleFilter);
      }
      if (allGradesAcademicYear.trim()) {
        params.set("academicYear", allGradesAcademicYear.trim());
      }
      if (allGradesSemester) {
        params.set("semester", allGradesSemester);
      }
      if (allGradesStatus) {
        params.set("status", allGradesStatus);
      }

      const query = params.toString();
      const response = await fetch(query ? `/api/grades?${query}` : "/api/grades", {
        cache: "no-store",
      });
      const payload = await readJson<unknown>(response);
      setAllGrades(parseGradeRows(payload));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load grades";
      setAllGrades([]);
      setAllGradesError(message);
      toast({
        title: "Failed to load grades",
        message,
        variant: "error",
      });
    } finally {
      setIsLoadingAllGrades(false);
    }
  }, [allGradesAcademicYear, allGradesModuleFilter, allGradesSemester, allGradesStatus, toast]);

  useEffect(() => {
    void loadModuleOfferings();
  }, [loadModuleOfferings]);

  useEffect(() => {
    if (!selectedOfferingId) {
      setEntryRows([]);
      setEntryError("");
      return;
    }

    void loadEntryRows(selectedOfferingId);
  }, [loadEntryRows, selectedOfferingId]);

  useEffect(() => {
    if (activeView !== "all") {
      return;
    }

    void loadAllGrades();
  }, [activeView, loadAllGrades]);

  useEffect(() => {
    setPage(1);
  }, [
    deferredAllGradesSearch,
    allGradesAcademicYear,
    allGradesModuleFilter,
    allGradesSemester,
    allGradesStatus,
    pageSize,
  ]);

  useEffect(() => {
    if (!editTarget) {
      setEditCaMarks("");
      setEditFinalExamMarks("");
      setEditRemarks("");
      setEditError("");
      return;
    }

    setEditCaMarks(String(editTarget.caMarks));
    setEditFinalExamMarks(String(editTarget.finalExamMarks));
    setEditRemarks(editTarget.remarks);
    setEditError("");
  }, [editTarget]);

  useEffect(() => {
    setActiveWindow(editTarget ? "Edit" : activeView === "entry" ? "Grade Entry" : "All Grades");
  }, [activeView, editTarget, setActiveWindow]);

  useEffect(() => {
    return () => {
      setActiveWindow(null);
    };
  }, [setActiveWindow]);

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

  const updateEntryRow = useCallback(
    (studentId: string, patch: Partial<EntryGradeRow>) => {
      setEntryRows((previous) =>
        previous.map((row) => (row.studentId === studentId ? { ...row, ...patch } : row))
      );
    },
    []
  );

  const handleSaveAllGrades = useCallback(async () => {
    if (!selectedOfferingId) {
      toast({
        title: "Select a module offering",
        message: "Choose a module offering before saving grades.",
        variant: "error",
      });
      return;
    }

    if (!entryAcademicYear.trim()) {
      toast({
        title: "Academic year is required",
        message: "Enter the academic year before saving grades.",
        variant: "error",
      });
      return;
    }

    if (!(entrySemester === "1" || entrySemester === "2")) {
      toast({
        title: "Semester is required",
        message: "Select semester 1 or 2 before saving grades.",
        variant: "error",
      });
      return;
    }

    if (savableEntryRows.length === 0) {
      toast({
        title: "No complete grades to save",
        message: "Enter both CA and final exam marks for at least one student.",
        variant: "info",
      });
      return;
    }

    if (invalidEntryCount > 0) {
      toast({
        title: "Fix invalid marks first",
        message: "Marks must be numbers between 0 and 100 before saving.",
        variant: "error",
      });
      return;
    }

    setIsSavingAll(true);

    try {
      const response = await fetch("/api/grades/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moduleOfferingId: selectedOfferingId,
          academicYear: entryAcademicYear.trim(),
          semester: Number(entrySemester),
          gradedBy: currentUser?.id,
          grades: savableEntryRows,
        }),
      });

      const result = await readJson<{ created: number; updated: number; total: number }>(
        response
      );

      toast({
        title: "Grades saved successfully",
        message: `Successfully saved grades for ${result.total} students (${result.created} created, ${result.updated} updated)`,
        variant: "success",
      });

      await Promise.all([loadEntryRows(selectedOfferingId), loadAllGrades()]);
    } catch (error) {
      toast({
        title: "Failed to save grades",
        message: error instanceof Error ? error.message : "Bulk save failed",
        variant: "error",
      });
    } finally {
      setIsSavingAll(false);
    }
  }, [
    currentUser?.id,
    entryAcademicYear,
    entrySemester,
    invalidEntryCount,
    loadAllGrades,
    loadEntryRows,
    savableEntryRows,
    selectedOfferingId,
    toast,
  ]);

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget) {
      return;
    }

    const caState = parseMarkValue(editCaMarks);
    const finalState = parseMarkValue(editFinalExamMarks);

    if (caState.empty || caState.invalid || caState.value === null) {
      setEditError("CA marks must be a number between 0 and 100.");
      return;
    }

    if (finalState.empty || finalState.invalid || finalState.value === null) {
      setEditError("Final exam marks must be a number between 0 and 100.");
      return;
    }

    setIsSavingEdit(true);
    setEditError("");

    try {
      const response = await fetch(`/api/grades/${encodeURIComponent(editTarget.id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caMarks: caState.value,
          finalExamMarks: finalState.value,
          remarks: editRemarks,
          gradedBy: currentUser?.id,
        }),
      });

      await readJson<unknown>(response);

      toast({
        title: "Grade updated successfully",
        message: `${editTarget.studentName}'s grade record has been updated.`,
        variant: "success",
      });

      setEditTarget(null);
      await Promise.all([
        loadAllGrades(),
        selectedOfferingId && selectedOfferingId === editTarget.moduleOfferingId
          ? loadEntryRows(selectedOfferingId)
          : Promise.resolve(),
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update grade";
      setEditError(message);
      toast({
        title: "Failed to update grade",
        message,
        variant: "error",
      });
    } finally {
      setIsSavingEdit(false);
    }
  }, [
    currentUser?.id,
    editCaMarks,
    editFinalExamMarks,
    editRemarks,
    editTarget,
    loadAllGrades,
    loadEntryRows,
    selectedOfferingId,
    toast,
  ]);

  const handleDeleteGrade = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/grades/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });

      await readJson<unknown>(response);

      toast({
        title: "Grade deleted successfully",
        message: `${deleteTarget.studentName}'s grade record has been removed.`,
        variant: "success",
      });

      const deletedOfferingId = deleteTarget.moduleOfferingId;
      setDeleteTarget(null);

      await Promise.all([
        loadAllGrades(),
        selectedOfferingId && selectedOfferingId === deletedOfferingId
          ? loadEntryRows(selectedOfferingId)
          : Promise.resolve(),
      ]);
    } catch (error) {
      toast({
        title: "Failed to delete grade",
        message: error instanceof Error ? error.message : "Delete failed",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, loadAllGrades, loadEntryRows, selectedOfferingId, toast]);

  const canSaveAll =
    Boolean(selectedOfferingId) &&
    Boolean(entryAcademicYear.trim()) &&
    (entrySemester === "1" || entrySemester === "2") &&
    savableEntryRows.length > 0 &&
    invalidEntryCount === 0 &&
    !isSavingAll;
  const canSaveEdit =
    Boolean(editTarget) &&
    !editCaState.invalid &&
    !editFinalState.invalid &&
    !editCaState.empty &&
    !editFinalState.empty &&
    !isSavingEdit;

  return (
    <>
      <div className="space-y-5">
        <PageHeader
          description="Capture module grades in bulk, review class performance instantly, and maintain individual records from one screen."
          title="Grade Management"
          actions={
            <div className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-shadow">
              <button
                className={cn(
                  "rounded-2xl px-4 py-2 text-sm font-semibold transition-colors",
                  activeView === "entry"
                    ? "bg-[#034aa6] text-white shadow-[0_8px_20px_rgba(3,74,166,0.24)]"
                    : "text-text/70 hover:bg-tint hover:text-heading"
                )}
                onClick={() => setActiveView("entry")}
                type="button"
              >
                Grade Entry
              </button>
              <button
                className={cn(
                  "rounded-2xl px-4 py-2 text-sm font-semibold transition-colors",
                  activeView === "all"
                    ? "bg-[#034aa6] text-white shadow-[0_8px_20px_rgba(3,74,166,0.24)]"
                    : "text-text/70 hover:bg-tint hover:text-heading"
                )}
                onClick={() => setActiveView("all")}
                type="button"
              >
                All Grades
              </button>
            </div>
          }
        />

        {activeView === "entry" ? (
          <Card accent className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-heading">Grade Entry Workspace</h2>
                <p className="mt-1 text-sm text-text/68">
                  Select a module offering, review enrolled students, and save grades in one batch.
                </p>
              </div>
              <Button
                className="gap-2 self-start"
                onClick={() => {
                  if (!selectedOfferingId) {
                    void loadModuleOfferings();
                    return;
                  }
                  void loadEntryRows(selectedOfferingId);
                }}
                variant="secondary"
              >
                <RefreshCw size={16} />
                Refresh
              </Button>
            </div>

            {isLoadingOfferings ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,0.7fr)]">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,0.7fr)]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                    Module Offering
                  </span>
                  <Select
                    onChange={(event) => setSelectedOfferingId(event.target.value)}
                    value={selectedOfferingId}
                  >
                    <option value="">Select module offering</option>
                    {moduleOfferings.map((offering) => (
                      <option key={offering.id} value={offering.id}>
                        {offeringLabel(offering)}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                    Academic Year
                  </span>
                  <Input
                    onChange={(event) => setEntryAcademicYear(event.target.value)}
                    placeholder="2025/2026"
                    value={entryAcademicYear}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                    Semester
                  </span>
                  <Select
                    onChange={(event) =>
                      setEntrySemester(event.target.value as "" | "1" | "2")
                    }
                    value={entrySemester}
                  >
                    <option value="">Select semester</option>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                  </Select>
                </label>
              </div>
            )}

            {offeringsError ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {offeringsError}
              </div>
            ) : null}

            {selectedOffering ? (
              <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-border bg-tint px-4 py-3 text-sm text-text/70">
                <Badge variant="primary">{selectedOffering.moduleCode}</Badge>
                <span className="font-medium text-heading">{selectedOffering.moduleName}</span>
                <span className="text-text/40">|</span>
                <span>{selectedOffering.termCode}</span>
                <span className="text-text/40">|</span>
                <span>{selectedOffering.intakeId}</span>
              </div>
            ) : null}

            {!selectedOfferingId ? (
              <div className="rounded-[28px] border border-dashed border-border bg-tint px-6 py-14 text-center">
                <ClipboardCheck className="mx-auto text-primary/70" size={32} />
                <h3 className="mt-4 text-lg font-semibold text-heading">Choose a module offering</h3>
                <p className="mt-2 text-sm text-text/68">
                  The grade entry table will load students and any previously saved grades once an
                  offering is selected.
                </p>
              </div>
            ) : isLoadingEntryRows ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton className="h-24" key={index} />
                  ))}
                </div>
                <Skeleton className="h-[420px]" />
              </div>
            ) : entryError ? (
              <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-10">
                <h3 className="text-lg font-semibold text-rose-700">Failed to load grade entry data</h3>
                <p className="mt-2 text-sm text-rose-700/80">{entryError}</p>
                <Button
                  className="mt-4 gap-2"
                  onClick={() => void loadEntryRows(selectedOfferingId)}
                  variant="secondary"
                >
                  <RefreshCw size={16} />
                  Try Again
                </Button>
              </div>
            ) : entryRows.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-border bg-tint px-6 py-14 text-center">
                <h3 className="text-lg font-semibold text-heading">No enrolled students found</h3>
                <p className="mt-2 text-sm text-text/68">
                  This offering does not currently have active student enrollments available for
                  grade entry.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <StatTile label="Total Students" value={String(entryStats.totalStudents)} />
                  <StatTile label="Graded" tone="success" value={String(entryStats.graded)} />
                  <StatTile label="Not Yet Graded" value={String(entryStats.notYetGraded)} />
                  <StatTile label="Pass / Fail" value={`${entryStats.pass} / ${entryStats.fail}`} />
                  <StatTile
                    label="Pro-Rata / Repeat"
                    tone="warning"
                    value={`${entryStats.proRata} / ${entryStats.repeat}`}
                  />
                  <StatTile
                    label="Class Average"
                    value={
                      entryStats.classAverage === null ? "N/A" : `${entryStats.classAverage}%`
                    }
                  />
                </div>

                <div className="overflow-x-auto rounded-[28px] border border-border">
                  <table className="min-w-full divide-y divide-border text-left text-sm">
                    <thead className="bg-tint">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-heading">#</th>
                        <th className="px-4 py-3 font-semibold text-heading">Student ID</th>
                        <th className="px-4 py-3 font-semibold text-heading">Student Name</th>
                        <th className="px-4 py-3 font-semibold text-heading">CA Marks</th>
                        <th className="px-4 py-3 font-semibold text-heading">Final Exam</th>
                        <th className="px-4 py-3 font-semibold text-heading">Total</th>
                        <th className="px-4 py-3 font-semibold text-heading">Grade</th>
                        <th className="px-4 py-3 font-semibold text-heading">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {entryRowsWithPreview.map(({ row, preview }, index) => (
                        <tr className="align-top" key={row.studentId}>
                          <td className="px-4 py-3 text-text/55">{index + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-heading">{row.registrationNumber}</p>
                            {row.existingGradeId ? (
                              <p className="mt-1 text-xs text-text/55">Existing grade loaded</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-heading">{row.studentName}</p>
                            <p className="mt-1 text-xs text-text/55">{row.studentEmail || "No email"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              className={cn(
                                "min-w-[130px]",
                                isMarkInvalid(row.caMarksInput) &&
                                  "border-rose-300 bg-rose-50 text-rose-700 focus-visible:border-rose-400 focus-visible:ring-rose-200"
                              )}
                              inputMode="decimal"
                              max={100}
                              min={0}
                              onChange={(event) =>
                                updateEntryRow(row.studentId, {
                                  caMarksInput: event.target.value,
                                })
                              }
                              placeholder="0 - 100"
                              type="number"
                              value={row.caMarksInput}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              className={cn(
                                "min-w-[130px]",
                                isMarkInvalid(row.finalExamMarksInput) &&
                                  "border-rose-300 bg-rose-50 text-rose-700 focus-visible:border-rose-400 focus-visible:ring-rose-200"
                              )}
                              inputMode="decimal"
                              max={100}
                              min={0}
                              onChange={(event) =>
                                updateEntryRow(row.studentId, {
                                  finalExamMarksInput: event.target.value,
                                })
                              }
                              placeholder="0 - 100"
                              type="number"
                              value={row.finalExamMarksInput}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-heading">
                              {preview.totalMarks === null ? "—" : `${preview.totalMarks}%`}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex min-w-[44px] justify-center rounded-full border border-border bg-tint px-3 py-1 text-xs font-semibold text-heading">
                              {preview.gradeLetter ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {preview.status ? <StatusBadge status={preview.status} /> : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-text/68">
                    {invalidEntryCount > 0
                      ? `${invalidEntryCount} row${invalidEntryCount === 1 ? "" : "s"} contain invalid marks and must be fixed before saving.`
                      : `${savableEntryRows.length} row${savableEntryRows.length === 1 ? "" : "s"} are ready to save.`}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setClearConfirmOpen(true)}
                      variant="secondary"
                    >
                      Clear All
                    </Button>
                    <Button className="gap-2" disabled={!canSaveAll} onClick={() => void handleSaveAllGrades()}>
                      {isSavingAll ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                      Save All Grades
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        ) : (
          <Card accent className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-heading">All Grades</h2>
                <p className="mt-1 text-sm text-text/68">
                  Search, filter, edit, and remove individual grade records across all offerings.
                </p>
              </div>
              <Button className="gap-2 self-start" onClick={() => void loadAllGrades()} variant="secondary">
                <RefreshCw size={16} />
                Refresh
              </Button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,0.7fr))]">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                  Search Student
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/45" size={16} />
                  <Input
                    aria-label="Search grades"
                    className="pl-10"
                    onChange={(event) => setAllGradesSearch(event.target.value)}
                    placeholder="Student name or ID"
                    value={allGradesSearch}
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                  Module Offering
                </span>
                <Select
                  onChange={(event) => setAllGradesModuleFilter(event.target.value)}
                  value={allGradesModuleFilter}
                >
                  <option value="">All</option>
                  {moduleOfferings.map((offering) => (
                    <option key={offering.id} value={offering.id}>
                      {offeringLabel(offering)}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                  Academic Year
                </span>
                <Input
                  onChange={(event) => setAllGradesAcademicYear(event.target.value)}
                  placeholder="2025/2026"
                  value={allGradesAcademicYear}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                  Semester
                </span>
                <Select
                  onChange={(event) => setAllGradesSemester(event.target.value)}
                  value={allGradesSemester}
                >
                  <option value="">All</option>
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </Select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                  Status
                </span>
                <Select
                  onChange={(event) =>
                    setAllGradesStatus(event.target.value as "" | GradeStatus)
                  }
                  value={allGradesStatus}
                >
                  <option value="">All</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="pro-rata">Pro-Rata</option>
                  <option value="repeat">Repeat</option>
                </Select>
              </label>
            </div>

            {isLoadingAllGrades ? (
              <Skeleton className="h-[460px]" />
            ) : allGradesError ? (
              <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-10">
                <h3 className="text-lg font-semibold text-rose-700">Failed to load grades</h3>
                <p className="mt-2 text-sm text-rose-700/80">{allGradesError}</p>
              </div>
            ) : filteredAllGrades.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-border bg-tint px-6 py-14 text-center">
                <h3 className="text-lg font-semibold text-heading">No grades found</h3>
                <p className="mt-2 text-sm text-text/68">
                  Adjust the filters or save grades from the grade entry view to populate this list.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-[28px] border border-border">
                  <table className="min-w-full divide-y divide-border text-left text-sm">
                    <thead className="bg-tint">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-heading">Student ID</th>
                        <th className="px-4 py-3 font-semibold text-heading">Student Name</th>
                        <th className="px-4 py-3 font-semibold text-heading">Module Code</th>
                        <th className="px-4 py-3 font-semibold text-heading">Module Name</th>
                        <th className="px-4 py-3 font-semibold text-heading">CA</th>
                        <th className="px-4 py-3 font-semibold text-heading">Final</th>
                        <th className="px-4 py-3 font-semibold text-heading">Total</th>
                        <th className="px-4 py-3 font-semibold text-heading">Grade</th>
                        <th className="px-4 py-3 font-semibold text-heading">Status</th>
                        <th className="px-4 py-3 font-semibold text-heading">Graded By</th>
                        <th className="px-4 py-3 font-semibold text-heading">Graded At</th>
                        <th className="px-4 py-3 font-semibold text-heading">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {paginatedGrades.map((grade) => (
                        <tr className="align-top" key={grade.id}>
                          <td className="px-4 py-3 font-semibold text-heading">
                            {grade.registrationNumber}
                          </td>
                          <td className="px-4 py-3">{grade.studentName}</td>
                          <td className="px-4 py-3 font-semibold text-heading">{grade.moduleCode}</td>
                          <td className="px-4 py-3">{grade.moduleName}</td>
                          <td className="px-4 py-3">{grade.caMarks}</td>
                          <td className="px-4 py-3">{grade.finalExamMarks}</td>
                          <td className="px-4 py-3 font-semibold text-heading">{grade.totalMarks}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex min-w-[44px] justify-center rounded-full border border-border bg-tint px-3 py-1 text-xs font-semibold text-heading">
                              {grade.gradeLetter}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={grade.status} />
                          </td>
                          <td className="px-4 py-3">{grade.gradedByName || "System"}</td>
                          <td className="px-4 py-3">{formatDateTime(grade.gradedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                aria-label={`Edit ${grade.studentName}`}
                                className="h-9 w-9 rounded-2xl p-0"
                                onClick={() => setEditTarget(grade)}
                                variant="secondary"
                              >
                                <Pencil size={15} />
                              </Button>
                              <Button
                                aria-label={`Delete ${grade.studentName}`}
                                className="h-9 w-9 rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50"
                                onClick={() => setDeleteTarget(grade)}
                                variant="secondary"
                              >
                                <Trash2 size={15} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <TablePagination
                  onPageChange={setPage}
                  onPageSizeChange={(value) => setPageSize(value as PageSize)}
                  page={safePage}
                  pageCount={pageCount}
                  pageSize={pageSize}
                  totalItems={filteredAllGrades.length}
                />
              </>
            )}
          </Card>
        )}
      </div>

      <ConfirmDialog
        confirmLabel="Clear Grades"
        isBusy={isSavingAll}
        message="This clears all CA and final exam inputs in the current entry table. Saved grades will remain in the database until you overwrite them."
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          setEntryRows((previous) =>
            previous.map((row) => ({
              ...row,
              caMarksInput: "",
              finalExamMarksInput: "",
            }))
          );
          setClearConfirmOpen(false);
        }}
        open={clearConfirmOpen}
        title="Clear all grade inputs?"
      />

      {editTarget ? (
        <div
          className="fixed inset-0 z-[94] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingEdit) {
              setEditTarget(null);
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-[30px] border border-border bg-card p-6 shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-heading">Edit Grade</h2>
                <p className="mt-2 text-sm text-text/68">
                  Update marks for {editTarget.studentName} ({editTarget.registrationNumber}) in{" "}
                  {editTarget.moduleCode}.
                </p>
              </div>
              <button
                aria-label="Close edit grade modal"
                className="rounded-2xl p-2 text-text/55 transition-colors hover:bg-tint hover:text-heading"
                disabled={isSavingEdit}
                onClick={() => setEditTarget(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                  CA Marks
                </span>
                <Input
                  className={cn(
                    editCaState.invalid &&
                      "border-rose-300 bg-rose-50 text-rose-700 focus-visible:border-rose-400 focus-visible:ring-rose-200"
                  )}
                  inputMode="decimal"
                  max={100}
                  min={0}
                  onChange={(event) => setEditCaMarks(event.target.value)}
                  type="number"
                  value={editCaMarks}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                  Final Exam Marks
                </span>
                <Input
                  className={cn(
                    editFinalState.invalid &&
                      "border-rose-300 bg-rose-50 text-rose-700 focus-visible:border-rose-400 focus-visible:ring-rose-200"
                  )}
                  inputMode="decimal"
                  max={100}
                  min={0}
                  onChange={(event) => setEditFinalExamMarks(event.target.value)}
                  type="number"
                  value={editFinalExamMarks}
                />
              </label>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                Remarks
              </span>
              <textarea
                className="min-h-[108px] w-full rounded-[18px] border border-border bg-card px-3.5 py-3 text-sm text-text transition-colors placeholder:text-text/55 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                onChange={(event) => setEditRemarks(event.target.value)}
                placeholder="Optional remarks"
                value={editRemarks}
              />
            </label>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <StatTile
                label="Total"
                value={editPreview.totalMarks === null ? "—" : `${editPreview.totalMarks}%`}
              />
              <StatTile label="Grade" value={editPreview.gradeLetter ?? "—"} />
              <div className="rounded-3xl border border-border bg-tint px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  Status
                </p>
                <div className="mt-3">
                  {editPreview.status ? <StatusBadge status={editPreview.status} /> : "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-border bg-tint px-4 py-3 text-sm text-text/68">
              Last graded on {formatDate(editTarget.gradedAt)} by {editTarget.gradedByName || "System"}.
            </div>

            {editError ? (
              <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {editError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button disabled={isSavingEdit} onClick={() => setEditTarget(null)} variant="secondary">
                Cancel
              </Button>
              <Button className="gap-2" disabled={!canSaveEdit} onClick={() => void handleSaveEdit()}>
                {isSavingEdit ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        confirmLabel="Delete Grade"
        isBusy={isDeleting}
        message={
          deleteTarget
            ? `Delete the grade record for ${deleteTarget.studentName} in ${deleteTarget.moduleCode}? This action cannot be undone.`
            : ""
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteGrade()}
        open={Boolean(deleteTarget)}
        title="Delete this grade?"
      />
    </>
  );
}
