"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import PageHeader from "@/components/admin/PageHeader";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";
import ConfirmDeleteOfferingModal from "./components/ConfirmDeleteOfferingModal";
import EditOfferingModal, {
  type EditOfferingContext,
  type OfferingStaffItem,
  type OfferingStatus,
  type SyllabusVersion,
} from "./components/EditOfferingModal";

type PageSize = 10 | 25 | 50 | 100;
type SortOption = "updated" | "module" | "term";
type TermCode =
  | "Y1S1"
  | "Y1S2"
  | "Y2S1"
  | "Y2S2"
  | "Y3S1"
  | "Y3S2"
  | "Y4S1"
  | "Y4S2";

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
}

interface OfferingRecord extends EditOfferingContext {
  updatedAt: string;
}

function cn(...classes: Array<string | false | undefined>) {
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

function sanitizeStatus(value: unknown): OfferingStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function sanitizeSyllabus(value: unknown): SyllabusVersion {
  return value === "OLD" ? "OLD" : "NEW";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toISOString().slice(0, 10);
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

function parseStaffArray(value: unknown): OfferingStaffItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const id = String(row.id ?? row._id ?? "").trim();
      if (!id) {
        return null;
      }

      return {
        id,
        fullName: collapseSpaces(row.fullName) || id,
        email: String(row.email ?? "").trim().toLowerCase(),
        status: String(row.status ?? "").trim().toUpperCase(),
      } satisfies OfferingStaffItem;
    })
    .filter((item): item is OfferingStaffItem => Boolean(item));
}

function parseOfferings(payload: unknown): {
  items: OfferingRecord[];
  total: number;
  page: number;
  pageSize: PageSize;
} {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  const items = rows
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const id = String(row.id ?? row._id ?? "").trim();
      const moduleId = String(row.moduleId ?? "").trim();
      const intakeId = String(row.intakeId ?? "").trim();
      if (!id || !moduleId || !intakeId) {
        return null;
      }

      const moduleObject = asObject(row.module);
      const facultyObject = asObject(row.faculty);
      const degreeObject = asObject(row.degree);
      const intakeObject = asObject(row.intake);

      const lecturers = parseStaffArray(row.lecturers);
      const labAssistants = parseStaffArray(row.labAssistants);

      return {
        id,
        facultyId: normalizeAcademicCode(row.facultyId),
        facultyName: collapseSpaces(facultyObject?.name),
        degreeProgramId: normalizeAcademicCode(row.degreeProgramId),
        degreeProgramName: collapseSpaces(degreeObject?.name),
        intakeId,
        intakeName: collapseSpaces(intakeObject?.name),
        termCode: String(row.termCode ?? "").trim().toUpperCase(),
        moduleId,
        moduleCode: String(row.moduleCode ?? moduleObject?.code ?? "").trim().toUpperCase(),
        moduleName: collapseSpaces(row.moduleName ?? moduleObject?.name),
        syllabusVersion: sanitizeSyllabus(row.syllabusVersion),
        status: sanitizeStatus(row.status),
        lecturers,
        labAssistants,
        updatedAt: String(row.updatedAt ?? ""),
      } satisfies OfferingRecord;
    })
    .filter((item): item is OfferingRecord => Boolean(item));

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
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const code = normalizeAcademicCode(row.code);
      if (!code) {
        return null;
      }

      return {
        code,
        name: collapseSpaces(row.name),
      } satisfies FacultyOption;
    })
    .filter((item): item is FacultyOption => Boolean(item));
}

function parseDegrees(payload: unknown): DegreeOption[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return rows
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const code = normalizeAcademicCode(row.code);
      const facultyCode = normalizeAcademicCode(row.facultyCode);
      if (!code || !facultyCode) {
        return null;
      }

      return {
        code,
        name: collapseSpaces(row.name),
        facultyCode,
      } satisfies DegreeOption;
    })
    .filter((item): item is DegreeOption => Boolean(item));
}

function parseIntakes(payload: unknown): IntakeOption[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return rows
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const id = String(row.id ?? row._id ?? "").trim();
      if (!id) {
        return null;
      }

      return {
        id,
        name: collapseSpaces(row.name),
        facultyCode: normalizeAcademicCode(row.facultyCode ?? row.facultyId),
        degreeCode: normalizeAcademicCode(row.degreeCode ?? row.degreeId),
      } satisfies IntakeOption;
    })
    .filter((item): item is IntakeOption => Boolean(item));
}

function parseEligibleStaff(payload: unknown): OfferingStaffItem[] {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];
  return parseStaffArray(rows);
}

const TERM_OPTIONS: TermCode[] = [
  "Y1S1",
  "Y1S2",
  "Y2S1",
  "Y2S2",
  "Y3S1",
  "Y3S2",
  "Y4S1",
  "Y4S2",
];

export default function ModuleOfferingsPage() {
  const { setActiveWindow } = useAdminContext();
  const { toast } = useToast();

  const [items, setItems] = useState<OfferingRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingLecturers, setIsLoadingLecturers] = useState(false);
  const [isLoadingLabAssistants, setIsLoadingLabAssistants] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [degreeFilter, setDegreeFilter] = useState("");
  const [intakeFilter, setIntakeFilter] = useState("");
  const [termFilter, setTermFilter] = useState<"" | TermCode>("");
  const [statusFilter, setStatusFilter] = useState<"" | OfferingStatus>("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [intakes, setIntakes] = useState<IntakeOption[]>([]);

  const [editTarget, setEditTarget] = useState<OfferingRecord | null>(null);
  const [formSyllabusVersion, setFormSyllabusVersion] = useState<SyllabusVersion>("NEW");
  const [formLecturerIds, setFormLecturerIds] = useState<string[]>([]);
  const [formLabAssistantIds, setFormLabAssistantIds] = useState<string[]>([]);
  const [eligibleLecturers, setEligibleLecturers] = useState<OfferingStaffItem[]>([]);
  const [eligibleLabAssistants, setEligibleLabAssistants] = useState<OfferingStaffItem[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<OfferingRecord | null>(null);

  const deferredSearch = useDeferredValue(searchQuery);
  const isOverlayOpen = Boolean(editTarget || deleteTarget);

  const loadOfferings = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: sortBy,
      });
      if (deferredSearch.trim()) {
        params.set("search", deferredSearch.trim());
      }
      if (facultyFilter) {
        params.set("facultyId", facultyFilter);
      }
      if (degreeFilter) {
        params.set("degreeProgramId", degreeFilter);
      }
      if (intakeFilter) {
        params.set("intakeId", intakeFilter);
      }
      if (termFilter) {
        params.set("termCode", termFilter);
      }
      if (statusFilter) {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/module-offerings?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await readJson<unknown>(response);
      const parsed = parseOfferings(payload);
      setItems(parsed.items);
      setTotalCount(parsed.total);
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to load module offerings",
        variant: "error",
      });
      setItems([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    deferredSearch,
    degreeFilter,
    facultyFilter,
    intakeFilter,
    page,
    pageSize,
    sortBy,
    statusFilter,
    termFilter,
    toast,
  ]);

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
    const code = normalizeAcademicCode(facultyId);
    if (!code) {
      setDegrees([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/degrees?facultyId=${encodeURIComponent(code)}&status=ACTIVE`,
        { cache: "no-store" }
      );
      const payload = await readJson<unknown>(response);
      setDegrees(parseDegrees(payload));
    } catch {
      setDegrees([]);
    }
  }, []);

  const loadIntakes = useCallback(async (facultyId: string, degreeId: string) => {
    const degreeCode = normalizeAcademicCode(degreeId);
    if (!degreeCode) {
      setIntakes([]);
      return;
    }

    const params = new URLSearchParams({
      page: "1",
      pageSize: "100",
      sort: "az",
      degreeProgramId: degreeCode,
    });
    const facultyCode = normalizeAcademicCode(facultyId);
    if (facultyCode) {
      params.set("facultyId", facultyCode);
    }

    try {
      const response = await fetch(`/api/intakes?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await readJson<unknown>(response);
      setIntakes(parseIntakes(payload));
    } catch {
      setIntakes([]);
    }
  }, []);

  const loadEligibleLecturers = useCallback(async (offering: OfferingRecord) => {
    setIsLoadingLecturers(true);
    try {
      const params = new URLSearchParams({
        facultyId: offering.facultyId,
        degreeId: offering.degreeProgramId,
        moduleId: offering.moduleId,
      });
      const response = await fetch(`/api/lecturers/eligible?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await readJson<unknown>(response);
      setEligibleLecturers(parseEligibleStaff(payload));
    } catch {
      setEligibleLecturers([]);
    } finally {
      setIsLoadingLecturers(false);
    }
  }, []);

  const loadEligibleLabAssistants = useCallback(async (offering: OfferingRecord) => {
    setIsLoadingLabAssistants(true);
    try {
      const params = new URLSearchParams({
        facultyId: offering.facultyId,
        degreeId: offering.degreeProgramId,
        moduleId: offering.moduleId,
      });
      const response = await fetch(
        `/api/lab-assistants/eligible?${params.toString()}`,
        {
          cache: "no-store",
        }
      );
      const payload = await readJson<unknown>(response);
      setEligibleLabAssistants(parseEligibleStaff(payload));
    } catch {
      setEligibleLabAssistants([]);
    } finally {
      setIsLoadingLabAssistants(false);
    }
  }, []);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  useEffect(() => {
    void loadFaculties();
  }, [loadFaculties]);

  useEffect(() => {
    if (!facultyFilter) {
      setDegrees([]);
      setDegreeFilter("");
      setIntakes([]);
      setIntakeFilter("");
      return;
    }

    setDegreeFilter("");
    setIntakes([]);
    setIntakeFilter("");
    void loadDegrees(facultyFilter);
  }, [facultyFilter, loadDegrees]);

  useEffect(() => {
    if (!degreeFilter) {
      setIntakes([]);
      setIntakeFilter("");
      return;
    }

    setIntakeFilter("");
    void loadIntakes(facultyFilter, degreeFilter);
  }, [degreeFilter, facultyFilter, loadIntakes]);

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
    if (!editTarget) {
      setActiveWindow("List");
      return;
    }

    setActiveWindow("Edit");
  }, [editTarget, setActiveWindow]);

  useEffect(() => {
    return () => {
      setActiveWindow(null);
    };
  }, [setActiveWindow]);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount);

  const openEditModal = (offering: OfferingRecord) => {
    setEditTarget(offering);
    setFormSyllabusVersion(offering.syllabusVersion);
    setFormLecturerIds(offering.lecturers.map((row) => row.id));
    setFormLabAssistantIds(offering.labAssistants.map((row) => row.id));
    setEligibleLecturers([]);
    setEligibleLabAssistants([]);
    void loadEligibleLecturers(offering);
    void loadEligibleLabAssistants(offering);
  };

  const closeEditModal = () => {
    if (isSaving) {
      return;
    }

    setEditTarget(null);
    setEligibleLecturers([]);
    setEligibleLabAssistants([]);
  };

  const toggleLecturer = (lecturerId: string) => {
    setFormLecturerIds((previous) =>
      previous.includes(lecturerId)
        ? previous.filter((item) => item !== lecturerId)
        : [...previous, lecturerId]
    );
  };

  const toggleLabAssistant = (labAssistantId: string) => {
    setFormLabAssistantIds((previous) =>
      previous.includes(labAssistantId)
        ? previous.filter((item) => item !== labAssistantId)
        : [...previous, labAssistantId]
    );
  };

  const saveOffering = async () => {
    if (!editTarget) {
      return;
    }

    setIsSaving(true);
    try {
      await readJson<unknown>(
        await fetch(`/api/module-offerings/${encodeURIComponent(editTarget.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            syllabusVersion: formSyllabusVersion,
            assignedLecturerIds: formLecturerIds,
            assignedLabAssistantIds: formLabAssistantIds,
          }),
        })
      );

      toast({
        title: "Saved",
        message: "Offering updated",
        variant: "success",
      });
      closeEditModal();
      await loadOfferings();
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to update offering",
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
        await fetch(`/api/module-offerings/${encodeURIComponent(deleteTarget.id)}`, {
          method: "DELETE",
        })
      );
      toast({
        title: "Deleted",
        message: "Module offering deleted",
        variant: "success",
      });
      setDeleteTarget(null);
      await loadOfferings();
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to delete offering",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDegreeOptions = useMemo(
    () => degrees.filter((item) => !facultyFilter || item.facultyCode === facultyFilter),
    [degrees, facultyFilter]
  );

  const filteredIntakeOptions = useMemo(
    () =>
      intakes.filter(
        (item) =>
          (!facultyFilter || item.facultyCode === facultyFilter) &&
          (!degreeFilter || item.degreeCode === degreeFilter)
      ),
    [degreeFilter, facultyFilter, intakes]
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <Button
            className="h-11 min-w-[188px] justify-center gap-2 rounded-2xl bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
            onClick={() =>
              toast({
                title: "Info",
                message: "Offerings are auto-created from intake module sync.",
                variant: "info",
              })
            }
          >
            <Plus size={16} />
            Add Module Offering
          </Button>
        }
        description="Assign lecturers and lab assistants to term-based module offerings."
        title="Module Offerings"
      />

      <Card
        className={cn(
          "transition-all",
          isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : ""
        )}
      >
        <div className="flex flex-col gap-4 border-b border-border pb-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(6,minmax(0,1fr))_220px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Search
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/50"
                  size={16}
                />
                <Input
                  className="h-12 pl-10"
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search module code or name"
                  value={searchQuery}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Faculty
              </label>
              <Select
                className="h-12"
                onChange={(event) => {
                  setFacultyFilter(normalizeAcademicCode(event.target.value));
                  setPage(1);
                }}
                value={facultyFilter}
              >
                <option value="">All</option>
                {faculties.map((faculty) => (
                  <option key={faculty.code} value={faculty.code}>
                    {faculty.code}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Degree
              </label>
              <Select
                className="h-12"
                disabled={!facultyFilter}
                onChange={(event) => {
                  setDegreeFilter(normalizeAcademicCode(event.target.value));
                  setPage(1);
                }}
                value={degreeFilter}
              >
                <option value="">All</option>
                {filteredDegreeOptions.map((degree) => (
                  <option key={degree.code} value={degree.code}>
                    {degree.code}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Intake
              </label>
              <Select
                className="h-12"
                disabled={!degreeFilter}
                onChange={(event) => {
                  setIntakeFilter(String(event.target.value ?? "").trim());
                  setPage(1);
                }}
                value={intakeFilter}
              >
                <option value="">All</option>
                {filteredIntakeOptions.map((intake) => (
                  <option key={intake.id} value={intake.id}>
                    {intake.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Term
              </label>
              <Select
                className="h-12"
                onChange={(event) => {
                  const value = String(event.target.value ?? "")
                    .trim()
                    .toUpperCase() as "" | TermCode;
                  setTermFilter(value);
                  setPage(1);
                }}
                value={termFilter}
              >
                <option value="">All</option>
                {TERM_OPTIONS.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Status
              </label>
              <Select
                className="h-12"
                onChange={(event) => {
                  setStatusFilter(event.target.value as "" | OfferingStatus);
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
                <option value="module">Module Code</option>
                <option value="term">Term</option>
              </Select>
            </div>

            <div className="rounded-2xl border border-border bg-tint px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                Total Offerings
              </p>
              <p className="mt-1 text-2xl font-semibold text-heading">{totalCount}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1340px] text-left text-sm">
            <thead className="border-b border-border bg-tint">
              <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Faculty</th>
                <th className="px-4 py-3">Degree</th>
                <th className="px-4 py-3">Intake</th>
                <th className="px-4 py-3">Term</th>
                <th className="px-4 py-3">Syllabus</th>
                <th className="px-4 py-3">Lecturers</th>
                <th className="px-4 py-3">Lab Assistants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={10}>
                    Loading module offerings...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={10}>
                    No module offerings match the current filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr className="border-b border-border/70 hover:bg-tint" key={item.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-heading">{item.moduleCode}</p>
                      <p className="text-text/78">{item.moduleName}</p>
                      <p className="mt-1 text-xs text-text/60">
                        Updated {formatDate(item.updatedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-text/78">{item.facultyId || "—"}</td>
                    <td className="px-4 py-4 text-text/78">{item.degreeProgramId || "—"}</td>
                    <td className="px-4 py-4 text-text/78">{item.intakeName || item.intakeId}</td>
                    <td className="px-4 py-4 text-text/78">{item.termCode || "—"}</td>
                    <td className="px-4 py-4">
                      <Badge variant={item.syllabusVersion === "OLD" ? "warning" : "primary"}>
                        {item.syllabusVersion}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-text/78">
                      <p className="font-semibold text-heading">{item.lecturers.length}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {item.lecturers.slice(0, 2).map((lecturer) => (
                          <span
                            className="rounded-full border border-border bg-tint px-2 py-0.5 text-xs text-text/70"
                            key={lecturer.id}
                          >
                            {lecturer.fullName}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-text/78">
                      <p className="font-semibold text-heading">{item.labAssistants.length}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {item.labAssistants.slice(0, 2).map((labAssistant) => (
                          <span
                            className="rounded-full border border-border bg-tint px-2 py-0.5 text-xs text-text/70"
                            key={labAssistant.id}
                          >
                            {labAssistant.fullName}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={item.status === "ACTIVE" ? "success" : "neutral"}>
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          aria-label={`Edit ${item.moduleCode} offering`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
                          onClick={() => openEditModal(item)}
                          type="button"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          aria-label={`Delete ${item.moduleCode} offering`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
                          onClick={() => setDeleteTarget(item)}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
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

      <EditOfferingModal
        key={editTarget?.id ?? "offering-modal"}
        assignedLabAssistantIds={formLabAssistantIds}
        assignedLecturerIds={formLecturerIds}
        eligibleLabAssistants={eligibleLabAssistants}
        eligibleLecturers={eligibleLecturers}
        loadingLabAssistants={isLoadingLabAssistants}
        loadingLecturers={isLoadingLecturers}
        offering={editTarget}
        onClose={closeEditModal}
        onSave={() => {
          void saveOffering();
        }}
        onSyllabusVersionChange={setFormSyllabusVersion}
        onToggleLabAssistant={toggleLabAssistant}
        onToggleLecturer={toggleLecturer}
        open={Boolean(editTarget)}
        saving={isSaving}
        syllabusVersion={formSyllabusVersion}
      />

      <ConfirmDeleteOfferingModal
        deleting={isDeleting}
        message="This will remove the module offering assignment for this intake term."
        onClose={() => {
          if (isDeleting) {
            return;
          }

          setDeleteTarget(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
        open={Boolean(deleteTarget)}
        targetLabel={
          deleteTarget
            ? `${deleteTarget.moduleCode} / ${deleteTarget.intakeName || deleteTarget.intakeId} / ${deleteTarget.termCode}`
            : ""
        }
        title="Delete module offering?"
      />

      {isSaving || isDeleting ? (
        <div className="pointer-events-none fixed bottom-4 left-4 z-[98] inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text/70 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
          <Loader2 className="animate-spin" size={14} />
          Processing...
        </div>
      ) : null}
    </div>
  );
}
